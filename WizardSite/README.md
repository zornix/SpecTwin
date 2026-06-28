# Spectra

Paste a link to any pair of sunglasses and Spectra surfaces spec-for-spec
alternatives that cost less — *pay for the optics, not the logo*.

This repo is the **scaffold**: a gorgeous, canonical, scrollable site with the
full UI working end-to-end on typed mock data. The real scraping/matching brains
swap in later behind a single seam (`src/lib/api.ts`).

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

### Optional: run the FastAPI engine

```bash
cd service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

```bash
# repo root
echo "MATCHING_SERVICE_URL=http://localhost:8000" >> .env.local
# restart pnpm dev — results now come from Python
```

See [`service/README.md`](service/README.md) for details. The Python
`models` / `mock_data` / `matcher` modules mirror their TS counterparts in
`src/lib/`.

## Deploy

- **Web** → Vercel (zero-config). Set `MATCHING_SERVICE_URL` only if you deploy
  the Python service.
- **Service** → any host (Render / Fly / Railway). It's a standard
  `uvicorn main:app` ASGI app.

## Notes

- The app is **locked to dark mode** (`ThemeProvider` `forcedTheme="dark"`).
- Product images are **on-brand SVG illustrations** (`product-image.tsx`) so the
  demo never shows a broken image; `imageUrl` is reserved for real photography.
- All prices/specs are **illustrative mock data**.
