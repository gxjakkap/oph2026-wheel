import { Button } from "@heroui/react"
import { ArrowCounterClockwise, Image, Plus, SignOut, SpinnerGap, Trash } from "@phosphor-icons/react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"

import { odds } from "../../shared/wheel"
import { imgUrl, requireLogin, wheel, type Item, type Spin } from "../data"
import { btn, btnDanger, btnPrimary, field, label, panel } from "../ui"

export const Route = createFileRoute("/admin")({
	beforeLoad: requireLogin,
	loader: async () => {
		const [state, spins] = await Promise.all([wheel.state(), wheel.spins()])
		return { ...state, spins }
	},
	component: Admin,
})

// runs an API call, then reloads the page data; errors go to alert() (staff on a phone mid-event)
function useAction() {
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true)
		try {
			await fn()
			await router.invalidate()
		} catch (e) {
			alert((e as Error).message)
		} finally {
			setBusy(false)
		}
	}
	return [busy, run] as const
}

// phones and canvases differ; shrink to 600px webp (png where the browser can't encode webp)
async function shrink(file: File) {
	const bmp = await createImageBitmap(file)
	const s = Math.min(1, 600 / Math.max(bmp.width, bmp.height))
	const canvas = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s))
	canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
	return canvas.convertToBlob({ type: "image/webp", quality: 0.85 })
}

function Admin() {
	const { items, headline, spins } = Route.useLoaderData()
	const share = odds(items)
	const left = items.reduce((s, i) => s + i.stock, 0)

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
			<nav className={`${panel} flex flex-wrap items-center gap-3 p-3`}>
				<span className="mr-2 font-extrabold">จัดการวงล้อ</span>
				<Link to="/" className={btn}>
					ไปหน้าวงล้อ
				</Link>
				<span className="ml-auto text-sm text-navy/70">เหลือทั้งหมด {left} ชิ้น</span>
				<button
					onClick={() => wheel.logout().then(() => location.assign("/login"))}
					className="inline-flex items-center gap-1 text-sm font-semibold text-lilac hover:underline">
					<SignOut />
					ออกจากระบบ
				</button>
			</nav>

			<Headline key={headline} initial={headline} />

			<section className={`${panel} flex flex-col gap-3`}>
				<h2 className="text-xl font-extrabold">ของรางวัล</h2>
				<p className="text-sm text-navy/70">โอกาส = น้ำหนัก ÷ น้ำหนักรวมของที่ยังมีสต็อก ของที่สต็อกหมดหรือน้ำหนัก 0 จะไม่อยู่บนวงล้อ</p>
				{items.map((i) => (
					<ItemRow key={`${i.id}:${i.name}:${i.weight}:${i.stock}:${i.image}`} item={i} chance={share.get(i.id)} />
				))}
				<NewItem />
			</section>

			<section className={`${panel} flex flex-col gap-2`}>
				<h2 className="text-xl font-extrabold">ประวัติการหมุน</h2>
				<p className="text-sm text-navy/70">ยกเลิกรายการที่ไม่นับ (เช่น กดหมุนเกิน) เพื่อคืนสต็อก</p>
				{spins.length === 0 && <p className="text-navy/60">ยังไม่มีการหมุน</p>}
				<ul className="flex flex-col divide-y-2 divide-navy/10">
					{spins.map((s) => (
						<SpinRow key={s.id} spin={s} />
					))}
				</ul>
			</section>
		</div>
	)
}

function Headline({ initial }: { initial: string }) {
	const [text, setText] = useState(initial)
	const [busy, run] = useAction()
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				run(() => wheel.setHeadline(text))
			}}
			className={`${panel} flex flex-col gap-3 sm:flex-row sm:items-end`}>
			<label className={`${label} flex-1`}>
				ข้อความบนจอ (เช่น ราคา)
				<input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} className={field} />
			</label>
			<Button type="submit" isDisabled={busy || text === initial} className={btnPrimary}>
				บันทึก
			</Button>
		</form>
	)
}

const num = (v: string) => (v === "" ? 0 : Number(v))

function ItemRow({ item, chance }: { item: Item; chance?: number }) {
	const [draft, setDraft] = useState({ name: item.name, weight: item.weight, stock: item.stock })
	const [busy, run] = useAction()
	const dirty = draft.name !== item.name || draft.weight !== item.weight || draft.stock !== item.stock

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				run(() => wheel.updateItem(item.id, draft))
			}}
			className="grid grid-cols-[4.5rem_1fr] items-end gap-3 rounded-2xl border-2 border-navy bg-white p-3 sm:grid-cols-[4.5rem_1fr_6rem_6rem_4.5rem_auto]">
			<label
				className="relative row-span-2 flex size-18 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-navy/40 bg-cream sm:row-span-1"
				title="เปลี่ยนรูป">
				{item.image ? (
					<img src={imgUrl(item.image)} alt="" className="size-full object-cover" />
				) : (
					<Image size="1.8em" className="text-navy/40" />
				)}
				{busy && <SpinnerGap className="absolute animate-spin text-plum" size="1.8em" />}
				<input
					type="file"
					accept="image/*"
					className="sr-only"
					aria-label={`รูปของ ${item.name}`}
					onChange={(e) => {
						const file = e.target.files?.[0]
						if (file) run(async () => wheel.uploadImage(item.id, await shrink(file)))
					}}
				/>
			</label>
			<label className={label}>
				ชื่อ
				<input
					value={draft.name}
					required
					maxLength={60}
					onChange={(e) => setDraft({ ...draft, name: e.target.value })}
					className={field}
				/>
			</label>
			<div className="col-start-2 grid grid-cols-3 gap-3 sm:contents">
				<label className={label}>
					น้ำหนัก
					<input
						type="number"
						min={0}
						max={10000}
						required
						value={draft.weight}
						onChange={(e) => setDraft({ ...draft, weight: num(e.target.value) })}
						className={field}
					/>
				</label>
				<label className={label}>
					สต็อก
					<input
						type="number"
						min={0}
						max={100000}
						required
						value={draft.stock}
						onChange={(e) => setDraft({ ...draft, stock: num(e.target.value) })}
						className={field}
					/>
				</label>
				<div className={label}>
					โอกาส
					<span className="py-2 font-extrabold">{chance === undefined ? "—" : `${(chance * 100).toFixed(1)}%`}</span>
				</div>
			</div>
			<div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
				<Button type="submit" isDisabled={busy || !dirty} className={btnPrimary}>
					บันทึก
				</Button>
				<Button
					isDisabled={busy}
					onPress={() => confirm(`ลบ "${item.name}"?`) && run(() => wheel.removeItem(item.id))}
					aria-label={`ลบ ${item.name}`}
					className={btnDanger}>
					<Trash />
				</Button>
			</div>
		</form>
	)
}

function NewItem() {
	const [name, setName] = useState("")
	const [busy, run] = useAction()
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				run(async () => {
					await wheel.addItem({ name, weight: 1, stock: 0 })
					setName("")
				})
			}}
			className="flex gap-2">
			<input
				value={name}
				required
				maxLength={60}
				placeholder="ชื่อของรางวัลใหม่"
				aria-label="ชื่อของรางวัลใหม่"
				onChange={(e) => setName(e.target.value)}
				className={field}
			/>
			<Button type="submit" isDisabled={busy} className={`${btnPrimary} shrink-0`}>
				<Plus />
				เพิ่ม
			</Button>
		</form>
	)
}

function SpinRow({ spin }: { spin: Spin }) {
	const [busy, run] = useAction()
	return (
		<li className={`flex items-center gap-3 py-2 ${spin.voided ? "text-navy/40 line-through" : ""}`}>
			<span className="w-20 shrink-0 font-mono text-sm">
				{new Date(spin.at).toLocaleTimeString("th", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
			</span>
			<span className="flex-1 font-semibold">{spin.itemName}</span>
			{spin.voided ? (
				<span className="text-sm no-underline">ยกเลิกแล้ว</span>
			) : (
				<Button
					isDisabled={busy}
					onPress={() => confirm(`ยกเลิกการหมุนนี้และคืน "${spin.itemName}" 1 ชิ้น?`) && run(() => wheel.voidSpin(spin.id))}
					className={btn}>
					<ArrowCounterClockwise />
					ยกเลิก
				</Button>
			)}
		</li>
	)
}
