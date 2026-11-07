import { Button } from "@heroui/react"
import { SignIn } from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import mascotLook from "../assets/mascot-look.webp"
import { wheel } from "../data"
import { btnPrimary, field, panel } from "../ui"

export const Route = createFileRoute("/login")({
	validateSearch: (s: Record<string, unknown>): { next?: string } =>
		typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? { next: s.next } : {},
	component: Login,
})

function Login() {
	const { next } = Route.useSearch()
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [busy, setBusy] = useState(false)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		setBusy(true)
		try {
			await wheel.login(password)
			location.assign(next ?? "/")
		} catch (err) {
			setError((err as Error).message)
			setBusy(false)
		}
	}

	return (
		<form onSubmit={submit} className={`${panel} mx-auto mt-[15vh] flex max-w-sm flex-col items-center gap-4 p-8`}>
			<img src={mascotLook} alt="" className="w-28" />
			<h1 className="text-2xl font-extrabold">วงล้อของที่ระลึก</h1>
			<input
				type="password"
				autoFocus
				required
				aria-label="รหัสผ่าน"
				placeholder="รหัสผ่าน"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				className={field}
			/>
			{error && <p className="text-sm font-semibold text-red-700">{error}</p>}
			<Button type="submit" isDisabled={busy} className={btnPrimary}>
				<SignIn />
				เข้าสู่ระบบ
			</Button>
		</form>
	)
}
