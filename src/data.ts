import { redirect } from "@tanstack/react-router"

import type { Item, Spin, State } from "../shared/wheel"

export type { Item, Spin, State } from "../shared/wheel"

export class ApiError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const res = await fetch(`/api${path}`, {
		...init,
		headers: init?.json === undefined ? init?.headers : { "content-type": "application/json", ...init?.headers },
		body: init?.json === undefined ? init?.body : JSON.stringify(init.json),
	})
	if (res.status === 204) return undefined as T
	const body = await res.json().catch(() => ({}))
	if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText)
	return body as T
}

export const imgUrl = (key: string) => `/api/img/${key}`

// beforeLoad for every page but /login; the API enforces the same cookie
export async function requireLogin({ location }: { location: { href: string } }) {
	try {
		await api("/me")
	} catch (e) {
		if (e instanceof ApiError && e.status === 401) throw redirect({ to: "/login", search: { next: location.href } })
		throw e
	}
}

export const wheel = {
	login: (password: string) => api<void>("/login", { method: "POST", json: { password } }),
	logout: () => api<void>("/logout", { method: "POST" }),
	state: () => api<State>("/state"),
	spin: () => api<{ itemId: number; spinId: number; items: Item[] }>("/spin", { method: "POST" }),
	setHeadline: (headline: string) => api<State>("/settings", { method: "PUT", json: { headline } }),
	addItem: (body: Partial<Item>) => api<Item>("/items", { method: "POST", json: body }),
	updateItem: (id: number, body: Partial<Item>) => api<Item>(`/items/${id}`, { method: "PATCH", json: body }),
	removeItem: (id: number) => api<void>(`/items/${id}`, { method: "DELETE" }),
	uploadImage: (id: number, image: Blob) =>
		api<Item>(`/items/${id}/image`, { method: "PUT", body: image, headers: { "content-type": image.type } }),
	spins: () => api<Spin[]>("/spins"),
	voidSpin: (id: number) => api<void>(`/spins/${id}/void`, { method: "POST" }),
}
