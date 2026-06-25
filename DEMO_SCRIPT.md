# circuit.rocks — 2-Minute Demo Script

**≈150 wpm. Each beat = route to open + words to say + timestamp.**
Chat kept short; admin management carries the weight.

---

## Beat 1 — The problem `(0:00–0:15)` · open `/`

> "A maker finds a great tutorial — fifteen parts listed. Then comes the slog: fifteen tabs, checking stock, guessing substitutes. Most quit right there. That abandonment is what we kill."

## Beat 2 — The customer magic, fast `(0:15–0:48)` · `/build`

> "This is the Build Assistant. You just say what you want — *'a smart plant monitor'* — paste a parts list straight from the tutorial, or **snap a photo** of a schematic. The instant the list is ready, every line resolves against our live inventory: each part becomes a real, in-stock component, green for in stock, amber for low, gaps shown honestly. One total. **Add all to cart.** Done. Inspiration to a ready-to-buy cart in seconds."

*(Type prompt → resolved card appears → Add all → cart drawer.)*

## Beat 3 — The turn `(0:48–1:00)` · log in at `/login`

> "But that 'in stock' badge isn't a guess. It's real — because behind the storefront is a full operations console. This is what powers it."

## Beat 4 — Full admin management `(1:00–1:48)` · walk the sidebar

> **`/dashboard`** — "Live revenue, orders, low-stock at a glance."
>
> **`/products` + `/raw-materials`** — "The catalog: finished products customers buy, and the raw components underneath them."
>
> **`/inventory` → `/warehouses` → `/transfers`** — "Here's the engine. Stock is tracked **per warehouse**, not one fuzzy number — and you move it between locations with transfers. *This* is the exact number the chat reads when it tells a customer 'in stock.'"
>
> **`/boms` + `/build-orders`** — "We don't just resell — we manufacture. A Bill of Materials defines a kit, a build order consumes the parts and produces it. Inventory updates automatically."
>
> **`/orders`** — "And every cart from that assistant lands here, ready to fulfill."

## Beat 5 — Close `(1:48–2:00)`

> "So it's one loop: real inventory makes the storefront honest, the storefront turns inspiration into orders, and orders flow right back into ops. That's circuit.rocks."

---

## Click-path cheat sheet

| # | Route | Show |
|---|-------|------|
| 1 | `/` | storefront home |
| 2 | `/build` | idea / paste / photo → resolved in-stock card → Add all |
| 3 | `/login` | `admin@circuit.rocks` · `admin12345` |
| 4 | `/dashboard` | metrics overview |
| 5 | `/products`, `/raw-materials` | catalog depth |
| 6 | `/inventory`, `/warehouses`, `/transfers` | multi-warehouse stock (powers the badge) |
| 7 | `/boms`, `/build-orders` | manufacturing |
| 8 | `/orders` | fulfillment |

## Pre-demo checklist

- Backend up (`cd backend && pnpm start:dev`), Postgres `circuit-pg` on **5433** running.
- `GROQ_API_KEY` set (Gemini fallback `GEMINI_API_KEY`) — else chat 503s.
- `pnpm seed:demo` run → matcher has stocked Variants + admin data populated.
- Admin seeded login: `admin@circuit.rocks` / `admin12345`.
- Pre-test one prompt that resolves clean (e.g. *"weather station"*) — avoid a live miss on camera.

---

_Time: ~2:00 even. To cut to 90s, trim admin to dashboard + inventory/warehouses + orders._
