import { expect, test } from "bun:test"

import { type Item, odds, pick, slices } from "./wheel"

const item = (id: number, weight: number, stock = 5): Item => ({ id, name: `#${id}`, weight, stock, image: null })
const items = [item(1, 50), item(2, 30), item(3, 15), item(4, 5), item(5, 10, 0), item(6, 0)]

test("pick follows weights and skips sold-out / zero-weight items", () => {
	const won = new Map<number, number>()
	const n = 10000
	for (let k = 0; k < n; k++) {
		const id = pick(items, k / n)!.id
		won.set(id, (won.get(id) ?? 0) + 1)
	}
	expect([...won]).toEqual([
		[1, 5000],
		[2, 3000],
		[3, 1500],
		[4, 500],
	])
	expect(pick([item(1, 5, 0)], 0.5)).toBeUndefined()
})

test("odds are shares of live weight", () => {
	expect(odds(items).get(1)).toBe(0.5)
	expect(odds(items).has(5)).toBe(false)
})

test("slices: proportional repeats, at least one each, copies spread", () => {
	const s = slices(items)
	const count = (id: number) => s.filter((x) => x === id).length
	expect([count(1), count(2), count(3), count(4), count(5), count(6)]).toEqual([8, 5, 2, 1, 0, 0])
	// the 50% item alternates rather than clumping
	expect(s.slice(0, 4)).not.toEqual([1, 1, 1, 1])
	expect(slices([item(1, 1)])).toEqual(Array(16).fill(1))
	expect(slices([])).toEqual([])
})
