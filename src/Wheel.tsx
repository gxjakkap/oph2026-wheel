import { imgUrl, type Item } from "./data"

export const SPIN_MS = 6500

// slice colours around the wheel; text colour picked to stay readable on each
const COLORS = [
	["var(--color-plum)", "var(--color-cream)"],
	["var(--color-sun)", "var(--color-navy)"],
	["var(--color-lilac)", "var(--color-cream)"],
	["var(--color-teal)", "var(--color-navy)"],
]
const R = 440
const point = (r: number, deg: number) => {
	const a = (deg * Math.PI) / 180
	return `${r * Math.sin(a)} ${-r * Math.cos(a)}`
}

// ids = slices clockwise from 12 o'clock; rotation in degrees, animated by CSS
export function Wheel({ ids, items, rotation }: { ids: number[]; items: Map<number, Item>; rotation: number }) {
	const n = ids.length
	const step = 360 / n
	// colours cycle by slice; with n % 4 == 1 the last slice would match the first, so it takes the second colour
	const color = (i: number) => COLORS[i === n - 1 && n % 4 === 1 && n > 1 ? 1 : i % 4]

	return (
		<svg viewBox="-500 -500 1000 1000" className="size-full drop-shadow-[10px_10px_0_var(--color-navy)]">
			<defs>
				<clipPath id="photo">
					<circle cx="0" cy={-R + 78} r="52" />
				</clipPath>
			</defs>
			<circle r={R + 40} fill="var(--color-navy)" />
			{/* rim bulbs */}
			{Array.from({ length: 24 }, (_, i) => (
				<circle
					key={i}
					cx={(R + 20) * Math.sin((i * Math.PI) / 12)}
					cy={(R + 20) * Math.cos((i * Math.PI) / 12)}
					r="7"
					fill={i % 2 ? "var(--color-sun)" : "var(--color-cream)"}
				/>
			))}
			<g
				style={{
					transform: `rotate(${rotation}deg)`,
					transition: `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.2, 1)`,
				}}>
				{n === 0 && <circle r={R} fill="var(--color-lilac)" stroke="var(--color-navy)" strokeWidth="6" />}
				{ids.map((id, i) => {
					const item = items.get(id)!
					const [bg, fg] = color(i)
					return (
						<g key={i}>
							<path
								d={
									n === 1
										? `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`
										: `M 0 0 L ${point(R, i * step)} A ${R} ${R} 0 ${step > 180 ? 1 : 0} 1 ${point(R, (i + 1) * step)} Z`
								}
								fill={bg}
								stroke="var(--color-navy)"
								strokeWidth="6"
								strokeLinejoin="round"
							/>
							{/* label along the slice's centre line: photo at the rim, name reading outwards */}
							<g transform={`rotate(${(i + 0.5) * step})`}>
								{item.image && (
									<>
										<circle cy={-R + 78} r="56" fill="var(--color-cream)" stroke="var(--color-navy)" strokeWidth="4" />
										<image
											href={imgUrl(item.image)}
											x="-52"
											y={-R + 26}
											width="104"
											height="104"
											clipPath="url(#photo)"
											preserveAspectRatio="xMidYMid slice"
										/>
									</>
								)}
								<text
									transform="rotate(-90)"
									x="110"
									y="10"
									fill={fg}
									fontSize="28"
									fontWeight="800"
									textLength={item.name.length > 9 ? (item.image ? 190 : 290) : undefined}
									lengthAdjust="spacingAndGlyphs">
									{item.name}
								</text>
							</g>
						</g>
					)
				})}
			</g>
			{/* pointer at 12 o'clock */}
			<path
				d={`M -34 ${-R - 52} L 34 ${-R - 52} L 0 ${-R + 18} Z`}
				fill="var(--color-sun)"
				stroke="var(--color-navy)"
				strokeWidth="8"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
