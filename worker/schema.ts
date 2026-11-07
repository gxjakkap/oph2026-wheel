import { sql } from "drizzle-orm"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

const now = sql`(unixepoch() * 1000)`

export const items = sqliteTable(
	"items",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		// relative chance; 0 takes the item off the wheel without losing its stock count
		weight: integer("weight").notNull().default(1),
		stock: integer("stock").notNull().default(0),
		// R2 key, served at /api/img/<key>
		image: text("image"),
	},
	(t) => [check("items_stock_check", sql`${t.stock} >= 0`), check("items_weight_check", sql`${t.weight} >= 0`)]
)

// one row per spin; voiding gives the stock back
export const spins = sqliteTable("spins", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	at: integer("at", { mode: "timestamp_ms" }).notNull().default(now),
	itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
	itemName: text("item_name").notNull(), // name at the time, kept if the item is deleted
	voided: integer("voided", { mode: "boolean" }).notNull().default(false),
})

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
})
