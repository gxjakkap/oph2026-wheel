import { IconContext } from "@phosphor-icons/react"
import { createRootRoute, Link, Outlet } from "@tanstack/react-router"

import mascotAbove from "../assets/mascot-above.webp"

export const Route = createRootRoute({
	component: () => (
		// icons: bold to match the thick outlines, text-sized, decorative (always beside a text label)
		<IconContext.Provider value={{ weight: "bold", size: "1.15em", "aria-hidden": true }}>
			<Outlet />
		</IconContext.Provider>
	),
	notFoundComponent: () => (
		<div className="flex flex-col items-center gap-4 py-16 text-center text-cream">
			<img src={mascotAbove} alt="" className="w-40" />
			<p className="text-2xl font-extrabold">ไม่พบหน้านี้</p>
			<Link to="/" className="font-semibold underline underline-offset-4">
				กลับไปที่วงล้อ
			</Link>
		</div>
	),
})
