# WizardSite Matching Service (FastAPI)

Wraps the repo-root recommendation engine behind the `MatchResponse` contract the
Next.js app expects. The web app proxies here when `MATCHING_SERVICE_URL` is set;
otherwise it falls back to its built-in TypeScript matcher.

Given a sunglasses product URL **already in `../../specs.json`**, it returns the
reference frame plus its top cheaper, spec-similar look-alikes — each with
brand/model, price, link, image, and a 0–100 match score.

## How it fits together

```
POST /match {url}
      │
      ▼
 main.py ──> engine.py ──────────────┐   (adds repo root to sys.path)
      │         │                     │
      │         │   reuses, verbatim: │
      │         ├── match.py          │  find_target / recommend
      │         ├── features.py       │  spec similarity
      │         ├── imagesim.py       │  CLIP image similarity (cached)
      │         └── descsim.py        │  style-profile similarity (cached)
      │
      └──> catalog_adapter.py  snake_case spec dict → camelCase Sunglasses/SunglassMatch
                 │
                 ▼
             models.py  (Pydantic contract, mirrors src/lib/types.ts 1:1)
```

- **`engine.py`** loads `specs.json` and builds the full similarity matrix **once
  at startup**, so every request is just a target lookup + a row sort (fast).
- **`catalog_adapter.py`** is the pure translation layer (enum mapping, mm
  parsing, image selection). No I/O, no engine imports — easy to reason about.
- **`models.py`** is the canonical contract. `mock_data.py` / `matcher.py` remain
  only as the TS-mirror reference; the live service no longer uses them.

A URL **not** in the catalog returns `404`, which the web app treats as a signal
to fall back to its local matcher — the UI never breaks.

## Configuration (env)

| Var                 | Default                 | Notes                                   |
| ------------------- | ----------------------- | --------------------------------------- |
| `MATCH_MODE`        | `blended`               | `blended` \| `spec-only` \| `desc-only` |
| `MATCH_ALPHA`       | `0.4`                   | image (CLIP) weight in blended mode     |
| `MATCH_TEXT`        | `0.2`                   | description (style) weight              |
| `MATCH_TOP_N`       | `3`                     | matches returned per request            |
| `ALLOWED_ORIGINS`   | `http://localhost:3000` | CORS origins (comma-separated)          |

`blended` mode uses the cached CLIP + description embeddings in the repo root
(`clip_embeddings.json`, `desc_embeddings.json`). If those signals are
unavailable the engine degrades gracefully to spec similarity. `spec-only` needs
nothing but `numpy` and is the lightest option.

## Run locally

The engine reuses the repo root's Python environment (numpy + sentence-transformers
etc. are already installed there). From this folder:

```bash
uvicorn main:app --port 8001
```

> Port `8001`, not `8000`: this machine already runs an unrelated service on
> `8000`. `WizardSite/.env.local` points the web app at `8001` to match.

Then (re)start the web app so it picks up `MATCHING_SERVICE_URL`:

```bash
cd ..        # WizardSite/
pnpm dev
```

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /match` → body `{ "url": "https://…" }` → `MatchResponse`

```bash
curl -s -X POST http://localhost:8001/match \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.glassesusa.com/tortoise-large/burberry-be4423-tortoise/46-006392.html"}' | jq
```
