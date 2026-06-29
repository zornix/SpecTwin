# Spectra

Paste a link to any pair of sunglasses and Spectra surfaces spec-for-spec
alternatives that cost less — *pay for the optics, not the logo*.

The UI works end-to-end against the **real matching engine**: paste a GlassesUSA
listing and the FastAPI service (`/service`) ranks cheaper, spec-similar twins
from a ~1,500-frame catalog. With no backend running it still works, falling back
to a typed local matcher. Everything is swapped behind a single seam
(`src/lib/api.ts`).

## Stack

- **Next.js (App Router) + React + TypeScript**, **Tailwind v4**, **shadcn/ui**
  (radix-nova, re-themed to a dark-luxe / editorial palette)
- **Fraunces** (display serif) + **Geist** (body) via `next/font`
- **Lenis** smooth scroll · **Framer Motion** reveals · **three.js / R3F** hero
- **lucide-react** icons · **zod** validation
- Optional **FastAPI** matching service (`/service`)

## Run the web app

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

That's it — the app uses the built-in TypeScript matcher and needs no backend.

### Screens

| Route                 | What it is                                                   |
| --------------------- | ----------------------------------------------------------- |
| `/`                   | Entry: scroll-driven hero, search bar, how-it-works, preview |
| `/results?url=…`      | Source summary + ranked grid of cheaper matches             |
| `/compare/[id]?url=…` | Side-by-side spec diff, savings callout, retailer CTA       |
| `/methodology`        | How matching works, scoring weights, FAQ                    |
| `POST /api/match`     | `{ url } → { source, matches[] }` (same engine as the pages) |

## The hero three.js seam

The hero is **wired but empty** — drop your scene into
`src/components/hero/hero-canvas.tsx` (look for `DROP YOUR THREE.JS SCENE HERE`).
Scroll progress (`0 → 1` across the hero) is available every frame via
`heroScroll.progress` (`src/components/hero/use-hero-scroll.ts`), already read
inside `useFrame` — no re-renders.

## The matching seam

`getMatches(url)` in `src/lib/api.ts` is the single entry point used by both the
pages and the API route:

- **No env set** → runs the local TS matcher (`src/lib/matcher.ts`)
- **`MATCHING_SERVICE_URL` set** → proxies to the FastAPI service, with the local
  matcher as an automatic fallback if it's down

### Run the real engine (recommended for the demo)

The FastAPI service wraps the repo-root recommendation stack over the live
`specs.json` catalog. It reuses the root project's Python environment:

```bash
cd service
uvicorn main:app --port 8001
```

`MATCHING_SERVICE_URL=http://localhost:8001` is already set in `.env.local`
(port `8001` because `8000` is taken on this machine). Restart `pnpm dev` and
results come from Python — the footer reads **"FastAPI engine · live catalog."**

Demo URLs (all in the catalog, wired into the search bar's *Try* chips):

```
https://www.glassesusa.com/tortoisegreen-large/persol-po3333s-elio-tortoise-green/46-008316.html
https://www.glassesusa.com/tortoise-large/burberry-be4423-tortoise/46-006392.html
https://www.glassesusa.com/blackgray-medium/burberry-be4492-black-gray/46-010139.html
```

See [`service/README.md`](service/README.md) for architecture and env tunables.

## Deploy

- **Web** → Vercel (zero-config). Set `MATCHING_SERVICE_URL` only if you deploy
  the Python service.
- **Service** → any host (Render / Fly / Railway). It's a standard
  `uvicorn main:app` ASGI app.

## Notes

- The app is **locked to dark mode** (`ThemeProvider` `forcedTheme="dark"`).
- Cards render the **real product photo** (`frame-photo.tsx`) when the model
  carries an `imageUrl`, falling back to the on-brand SVG illustration
  (`product-image.tsx`) if it's missing or fails to load.
- Prices/specs come from public GlassesUSA listings (via `specs.json`) and may be
  out of date.
