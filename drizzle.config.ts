import { defineConfig } from "drizzle-kit"

// generates SQL into migrations/, applied with `wrangler d1 migrations apply`
export default defineConfig({ dialect: "sqlite", schema: "./worker/schema.ts", out: "./migrations" })
