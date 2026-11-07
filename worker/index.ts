import { desc, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"

import { pick, type Item, type State } from "../shared/wheel"
import { items, settings, spins } from "./schema"

const COOKIE = "wheel"
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"]

const getDb = (env: Env) => drizzle(env.DB)
type Db = ReturnType<typeof getDb>

// validation

const bad = (msg: string) => new HTTPException(400, { message: msg })
const int = (v: unknown, field: string, max: number) => {
	if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) throw bad(`${field}: จำนวนเต็ม 0-${max}`)
	return v as number
}
function parseItem(b: Record<string, unknown>) {
	const out: Partial<typeof items.$inferInsert> = {}
	if ("name" in b) {
		if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 60) throw bad("ชื่อ: 1-60 ตัวอักษร")
		out.name = b.name.trim()
	}
	if ("weight" in b) out.weight = int(b.weight, "น้ำหนัก", 10000)
	if ("stock" in b) out.stock = int(b.stock, "สต็อก", 100000)
	return out
}

// reads

const loadItems = (db: Db): Promise<Item[]> => db.select().from(items).orderBy(items.id)

async function state(db: Db): Promise<State> {
	const [list, headline] = await Promise.all([
		loadItems(db),
		db.select().from(settings).where(eq(settings.key, "headline")).get(),
	])
	return { items: list, headline: headline?.value ?? "" }
}

async function one(db: Db, id: string) {
	const row = await db
		.select()
		.from(items)
		.where(eq(items.id, Number(id)))
		.get()
	if (!row) throw new HTTPException(404, { message: "ไม่พบของรางวัล" })
	return row
}

// auth: one shared password (secret APP_PASSWORD) for the TV and admin. The cookie is signed with the password
// itself, so changing the secret logs every device out.

const sha = async (s: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))

const requireLogin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
	if (!(await getSignedCookie(c, c.env.APP_PASSWORD, COOKIE))) return c.json({ error: "unauthenticated" }, 401)
	await next()
})

// routes

const api = new Hono<{ Bindings: Env }>()
	.use(requireLogin)
	.get("/me", (c) => c.body(null, 204))
	.get("/state", async (c) => c.json(await state(getDb(c.env))))
	.post("/spin", async (c) => {
		const pool = await loadItems(getDb(c.env))
		const won = pick(pool, Math.random())
		if (!won) throw bad("ของรางวัลหมดแล้ว")
		// D1 batch = one transaction. changes() is the previous statement's row count, so the spin is only logged if
		// the decrement happened (it can't, if another spin took the last one in between)
		const [dec, log] = await c.env.DB.batch([
			c.env.DB.prepare("UPDATE items SET stock = stock - 1 WHERE id = ? AND stock > 0").bind(won.id),
			c.env.DB.prepare(
				"INSERT INTO spins (item_id, item_name) SELECT id, name FROM items WHERE id = ? AND changes() = 1"
			).bind(won.id),
		])
		if (!dec.meta.changes) throw new HTTPException(409, { message: "ลองหมุนอีกครั้ง" })
		// pool = the items as they were before this spin, which is the wheel the TV should land on
		return c.json({ itemId: won.id, spinId: log.meta.last_row_id, items: pool })
	})
	.put("/settings", async (c) => {
		const { headline } = await c.req.json<{ headline: unknown }>()
		if (typeof headline !== "string" || headline.length > 200) throw bad("ข้อความ: ไม่เกิน 200 ตัวอักษร")
		const value = headline.trim()
		await getDb(c.env)
			.insert(settings)
			.values({ key: "headline", value })
			.onConflictDoUpdate({ target: settings.key, set: { value } })
		return c.json(await state(getDb(c.env)))
	})
	.post("/items", async (c) => {
		const fields = parseItem(await c.req.json())
		if (!fields.name) throw bad("ชื่อ: 1-60 ตัวอักษร")
		const [row] = await getDb(c.env)
			.insert(items)
			.values({ ...fields, name: fields.name })
			.returning()
		return c.json(row, 201)
	})
	.patch("/items/:id", async (c) => {
		const db = getDb(c.env)
		const before = await one(db, c.req.param("id"))
		const fields = parseItem(await c.req.json())
		if (Object.keys(fields).length) await db.update(items).set(fields).where(eq(items.id, before.id))
		return c.json(await one(db, String(before.id)))
	})
	.delete("/items/:id", async (c) => {
		const db = getDb(c.env)
		const row = await one(db, c.req.param("id"))
		await db.delete(items).where(eq(items.id, row.id))
		if (row.image) await c.env.BUCKET.delete(row.image)
		return c.body(null, 204)
	})
	// raw image body; a new key per upload so the immutable cache never serves a stale photo
	.put("/items/:id/image", async (c) => {
		const db = getDb(c.env)
		const row = await one(db, c.req.param("id"))
		const type = c.req.header("content-type") ?? ""
		if (!IMAGE_TYPES.includes(type)) throw bad("รูป: webp, jpeg หรือ png")
		const body = await c.req.arrayBuffer()
		if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) throw bad("รูป: ไม่เกิน 2 MB")
		const key = `items/${row.id}-${Date.now().toString(36)}`
		await c.env.BUCKET.put(key, body, { httpMetadata: { contentType: type } })
		await db.update(items).set({ image: key }).where(eq(items.id, row.id))
		if (row.image) await c.env.BUCKET.delete(row.image)
		return c.json(await one(db, String(row.id)))
	})
	.get("/spins", async (c) => c.json(await getDb(c.env).select().from(spins).orderBy(desc(spins.id)).limit(300)))
	.post("/spins/:id/void", async (c) => {
		const id = Number(c.req.param("id"))
		// same changes() guard as /spin: the stock only comes back the first time a spin is voided
		const [v] = await c.env.DB.batch([
			c.env.DB.prepare("UPDATE spins SET voided = 1 WHERE id = ? AND voided = 0").bind(id),
			c.env.DB.prepare(
				"UPDATE items SET stock = stock + 1 WHERE id = (SELECT item_id FROM spins WHERE id = ?) AND changes() = 1"
			).bind(id),
		])
		if (!v.meta.changes) throw bad("ยกเลิกไปแล้ว หรือไม่พบรายการ")
		return c.body(null, 204)
	})

const app = new Hono<{ Bindings: Env }>()
	.basePath("/api")
	.post("/login", async (c) => {
		const ip = c.req.header("cf-connecting-ip") ?? "local"
		if (!(await c.env.LOGIN_LIMIT.limit({ key: ip })).success)
			throw new HTTPException(429, { message: "ลองบ่อยเกินไป รอสักครู่" })
		const { password } = await c.req.json<{ password: unknown }>()
		const ok =
			typeof password === "string" && crypto.subtle.timingSafeEqual(await sha(password), await sha(c.env.APP_PASSWORD))
		if (!ok) throw new HTTPException(401, { message: "รหัสผ่านไม่ถูกต้อง" })
		await setSignedCookie(c, COOKIE, "1", c.env.APP_PASSWORD, {
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 7,
		})
		return c.body(null, 204)
	})
	.post("/logout", (c) => {
		deleteCookie(c, COOKIE, { path: "/", secure: true })
		return c.body(null, 204)
	})
	// public: merch photos aren't secret, and <img> stays cacheable
	.get("/img/:key{.+}", async (c) => {
		const obj = await c.env.BUCKET.get(c.req.param("key"))
		if (!obj) return c.notFound()
		return c.body(obj.body, 200, {
			"content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
			etag: obj.httpEtag,
		})
	})
	.route("/", api)

app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
	console.error(err)
	return c.json({ error: "internal error" }, 500)
})

export default app
