export type Item = { id: number; name: string; weight: number; stock: number; image: string | null }
export type Spin = { id: number; at: string; itemId: number | null; itemName: string; voided: boolean }
export type State = { items: Item[]; headline: string }

export const SLICES = 16

// on the wheel = can be won: in stock and a weight above 0
export const live = (items: Item[]) => items.filter((i) => i.weight > 0 && i.stock > 0)

// chance per item id, as the server draws it: weight / sum of live weights
export function odds(items: Item[]) {
	const pool = live(items)
	const total = pool.reduce((s, i) => s + i.weight, 0)
	return new Map(pool.map((i) => [i.id, i.weight / total]))
}

// weighted draw over live items; r in [0, 1)
export function pick(items: Item[], r: number) {
	const pool = live(items)
	let x = r * pool.reduce((s, i) => s + i.weight, 0)
	for (const i of pool) if ((x -= i.weight) < 0) return i
	return pool.at(-1)
}

// the wheel's slices (item ids, clockwise from the top): each live item repeated max(1, round(SLICES × share)) times,
// copies spread evenly by sorting on (k + 0.5) / copies, so they rarely sit side by side. Deterministic, so the wheel
// only changes when the items do.
export function slices(items: Item[]) {
	const share = odds(items)
	return live(items)
		.flatMap((i, n) => {
			const copies = Math.max(1, Math.round(SLICES * share.get(i.id)!))
			return Array.from({ length: copies }, (_, k) => ({ id: i.id, key: (k + 0.5) / copies, n }))
		})
		.sort((a, b) => a.key - b.key || a.n - b.n)
		.map((s) => s.id)
}
