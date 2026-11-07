import { Button } from "@heroui/react"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { live, slices } from "../../shared/wheel"
import logos from "../assets/logos.webp"
import mascotLook from "../assets/mascot-look.webp"
import title from "../assets/title.webp"
import { imgUrl, requireLogin, wheel, type Item, type State } from "../data"
import { SPIN_MS, Wheel } from "../Wheel"

export const Route = createFileRoute("/")({
	beforeLoad: requireLogin,
	loader: wheel.state,
	component: Tv,
})

type Phase =
	| { kind: "idle" }
	| { kind: "drawing" }
	| { kind: "spinning"; won: Item }
	| { kind: "result"; won: Item }
	| { kind: "error"; msg: string }

function Tv() {
	const [state, setState] = useState<State>(Route.useLoaderData())
	const [rotation, setRotation] = useState(0)
	const [phase, setPhase] = useState<Phase>({ kind: "idle" })

	const byId = useMemo(() => new Map(state.items.map((i) => [i.id, i])), [state.items])
	const ids = useMemo(() => slices(state.items), [state.items])
	const busy = phase.kind === "drawing" || phase.kind === "spinning" || phase.kind === "result"

	const refresh = useCallback(() => wheel.state().then(setState, () => {}), [])

	// pick up admin edits (stock, weights, headline) while idle
	useEffect(() => {
		if (busy) return
		const t = setInterval(refresh, 15000)
		return () => clearInterval(t)
	}, [busy, refresh])

	// a ref, not `busy`: a click and a Space in the same tick would both see a stale busy=false and spin twice
	const lock = useRef(false)
	const spin = useCallback(async () => {
		if (lock.current) return
		lock.current = true
		setPhase({ kind: "drawing" })
		try {
			const res = await wheel.spin()
			// land on the wheel the server drew from, so a just-sold-out prize still has its slice
			const pool = slices(res.items)
			const mine = pool.flatMap((id, i) => (id === res.itemId ? [i] : []))
			const step = 360 / pool.length
			const at = (mine[Math.floor(Math.random() * mine.length)] + 0.5 + (Math.random() - 0.5) * 0.7) * step
			setState((s) => ({ ...s, items: res.items }))
			setPhase({ kind: "spinning", won: res.items.find((i) => i.id === res.itemId)! })
			// at least 6 full turns, ending with that point under the pointer
			setRotation((r) => r - (r % 360) + 360 * 6 + ((360 - at) % 360))
			setTimeout(() => setPhase((p) => (p.kind === "spinning" ? { kind: "result", won: p.won } : p)), SPIN_MS + 300)
		} catch (e) {
			lock.current = false
			setPhase({ kind: "error", msg: (e as Error).message })
			refresh()
		}
	}, [refresh])

	const close = useCallback(() => {
		lock.current = false
		setPhase({ kind: "idle" })
		refresh()
	}, [refresh])

	// Space / Enter spins, or closes the result
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== " " && e.key !== "Enter") return
			e.preventDefault()
			if (phase.kind === "result") close()
			else spin()
		}
		addEventListener("keydown", onKey)
		return () => removeEventListener("keydown", onKey)
	}, [phase.kind, spin, close])

	const soldOut = live(state.items).length === 0
	const prizes = state.items.filter((i) => i.weight > 0)

	return (
		<div className="flex h-dvh flex-col overflow-hidden px-[3vw] py-[2vh]">
			<header className="flex items-center justify-between gap-6">
				<img src={title} alt="CPE Open House 2026" className="h-[13vh] w-auto" />
				{state.headline && (
					<p className="rounded-full border-3 border-navy bg-sun px-8 py-3 text-[clamp(1.5rem,2.6vw,3rem)] font-extrabold text-navy shadow-[5px_5px_0_var(--color-navy)]">
						{state.headline}
					</p>
				)}
				<img src={logos} alt="KMUTT · CPE · KMUTT Engineering Open House" className="h-[8vh] w-auto rounded-xl" />
			</header>

			<main className="flex min-h-0 flex-1 items-center justify-center gap-[4vw] pt-[2vh]">
				<div className="relative aspect-square h-full max-w-[60vw]">
					<Wheel ids={ids} items={byId} rotation={rotation} />
					<Button
						onPress={spin}
						// unfocused, so Space only reaches the window listener and never presses the button too
						preventFocusOnPress
						isDisabled={busy || soldOut}
						aria-label="หมุนวงล้อ"
						className="absolute top-1/2 left-1/2 size-[24%] -translate-1/2 rounded-full border-[0.6vh] border-navy bg-sun text-[clamp(1.5rem,3.5vh,3.5rem)] font-extrabold text-navy shadow-[0.6vh_0.6vh_0_var(--color-navy)] data-[pressed=true]:translate-[-48%] data-[disabled=true]:opacity-100">
						{soldOut ? "หมดแล้ว" : busy ? "..." : "หมุน!"}
					</Button>
				</div>

				<aside className="flex max-h-full w-[26vw] flex-col gap-3 rounded-3xl border-3 border-navy bg-cream p-5 text-navy shadow-[5px_5px_0_var(--color-navy)]">
					<h2 className="text-[clamp(1.5rem,2vw,2.5rem)] font-extrabold">ของรางวัล</h2>
					<ul className="flex min-h-0 flex-col gap-2 overflow-hidden">
						{prizes.map((i) => (
							<li
								key={i.id}
								className={`flex items-center gap-3 rounded-2xl border-2 border-navy bg-white p-2 ${i.stock ? "" : "opacity-50 grayscale"}`}>
								{i.image ? (
									<img src={imgUrl(i.image)} alt="" className="size-[7vh] shrink-0 rounded-xl object-cover" />
								) : (
									<div className="size-[7vh] shrink-0 rounded-xl bg-lilac/30" />
								)}
								<span className="text-[clamp(1rem,1.4vw,1.75rem)] font-bold">{i.name}</span>
								{!i.stock && (
									<span className="ml-auto shrink-0 rounded-full bg-navy px-3 py-1 font-extrabold text-cream">หมด</span>
								)}
							</li>
						))}
					</ul>
				</aside>
			</main>

			{phase.kind === "error" && (
				<button
					onClick={() => setPhase({ kind: "idle" })}
					className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border-3 border-navy bg-cream px-6 py-3 text-xl font-bold text-red-700 shadow-[5px_5px_0_var(--color-navy)]">
					{phase.msg} (แตะเพื่อปิด)
				</button>
			)}

			{phase.kind === "result" && <Result won={phase.won} onClose={close} />}
		</div>
	)
}

const CONFETTI = ["var(--color-sun)", "var(--color-teal)", "var(--color-lilac)", "var(--color-cream)"]
// random once per page load; the same shower replays each win
const pieces = Array.from({ length: 80 }, (_, i) => ({
	left: Math.random() * 100,
	delay: Math.random() * 2,
	duration: 2.5 + Math.random() * 2,
	color: CONFETTI[i % CONFETTI.length],
}))

function Result({ won, onClose }: { won: Item; onClose: () => void }) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="won"
			onClick={onClose}
			className="fixed inset-0 z-10 flex cursor-pointer items-center justify-center overflow-hidden bg-navy/70">
			{pieces.map((p, i) => (
				<span
					key={i}
					aria-hidden
					className="absolute -top-8 h-6 w-3 rounded-sm motion-reduce:hidden"
					style={{
						left: `${p.left}%`,
						background: p.color,
						animation: `confetti ${p.duration}s linear ${p.delay}s infinite`,
					}}
				/>
			))}
			<div className="relative flex flex-col items-center gap-4 rounded-[3rem] border-[6px] border-navy bg-cream px-[5vw] py-[4vh] text-center text-navy shadow-[12px_12px_0_var(--color-navy)]">
				<img src={mascotLook} alt="" className="absolute -top-[9vh] -left-[6vh] h-[18vh] -rotate-12" />
				<p className="text-[clamp(2rem,4vh,4rem)] font-extrabold text-plum">ยินดีด้วย! ได้รับ</p>
				{won.image && (
					<img
						src={imgUrl(won.image)}
						alt=""
						className="size-[40vh] rounded-3xl border-4 border-navy bg-white object-cover"
					/>
				)}
				<p id="won" className="text-[clamp(2.5rem,7vh,6rem)] leading-tight font-extrabold">
					{won.name}
				</p>
				<p className="text-[clamp(1rem,2vh,1.5rem)] font-semibold text-navy/60">แตะหรือกด Space เพื่อปิด</p>
			</div>
		</div>
	)
}
