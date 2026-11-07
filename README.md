# oph2026-wheel

Merch wheel of fortune for the CPE KMUTT Open House 2026 stall → wheel.cpesu.com

One Cloudflare Worker (`oph2026-wheel`) serves the React SPA and the Hono API at `/api/*`.
Items, spins and the headline live in D1; merch photos in R2 (served by the worker at `/api/img/<key>`).
Payment happens at the stall; the app only spins and counts stock.

- `/` — the TV page: wheel + prize list. The customer clicks หมุน! (or Space); Space/click closes the result.
- `/admin` — items (name, weight, stock, photo), the headline, and the spin log with ยกเลิก (void → stock back).
- `/login` — one shared password (`APP_PASSWORD`) for both. Changing the secret logs every device out.

Each spin draws server-side: chance = weight ÷ sum of weights of items with stock > 0, and the stock drops in the
same D1 transaction. The wheel shows 16 slices, each item repeated in proportion to its chance (min 1).

## Local dev

```sh
bun install
cp .dev.vars.example .dev.vars   # APP_PASSWORD=dev
bun run db:migrate:local
bun run dev                      # http://localhost:5173
bun test                         # odds / slice layout
```

## Schema changes

Edit `worker/schema.ts`, then `bun run db:generate` and `bun run db:migrate:local` / `db:migrate:remote`.

## First deploy

```sh
bunx wrangler d1 create oph2026-wheel     # put the database_id into wrangler.jsonc
bunx wrangler r2 bucket create oph2026-wheel
bun run db:migrate:remote
bunx wrangler secret put APP_PASSWORD
```

Then Workers Builds (git integration): build command `bun run build`, deploy command `bunx wrangler deploy`.
