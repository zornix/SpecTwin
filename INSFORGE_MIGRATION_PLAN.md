# InsForge migration plan — Wizardry

> Plan only. No code changed yet. Goal: replace the local-JSON state layer with the
> already-provisioned (but empty) InsForge project **SpecTwin**, and turn the O(n²)
> in-memory match into a pgvector query.

## Target architecture

```
 harvest (You.com)        scrape (You.com)            match
       │                        │                        │
       ▼                        ▼                        ▼
   upsert rows ──────▶  upsert specs + embedding ──▶  pgvector NN query
   (url,price,image)     + image → storage bucket      + price filter
       │                        │                        │
       └──────────── public.frames (one table) ──────────┘
                     + frame-images (one bucket)
```

**Collapses 5 artifacts into 1 table + 1 bucket:**

| Today (gitignored JSON/dirs) | Becomes |
|---|---|
| `sunglasses_urls.json` (worklist) | `SELECT source_url FROM frames WHERE specs_scraped_at IS NULL` |
| `listings.json` (url→price/image) | columns on `frames` |
| `specs.json` (85 records) | rows in `frames` |
| `clip_embeddings.json` (979 KB) | `frames.clip_embedding vector(512)` |
| `image_cache/` (blobs) | `frame-images` storage bucket |

## 1. Schema — one migration

`npx @insforge/cli db migrations new create-frames`, then put this in the file
(`migrations/<ts>_create-frames.sql`). No `BEGIN/COMMIT` — backend wraps it.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.frames (
  id              BIGSERIAL PRIMARY KEY,
  source_url      TEXT NOT NULL UNIQUE,           -- natural key (was the JSON dict key)
  -- listing-grid fields (stage 1)
  price           DOUBLE PRECISION,
  original_price  DOUBLE PRECISION,
  -- spec fields (stage 2)
  title           TEXT,
  product_name    TEXT,
  brand           TEXT,
  description      TEXT,
  shape           TEXT,
  size            TEXT,
  material        TEXT,
  rim_type        TEXT,
  color           TEXT,
  gender          TEXT,
  -- measurements: keep raw jsonb for fidelity, AND pre-parse mm floats for matching
  measurements    JSONB,                          -- {"lens_width":"48 mm / 1.89\"", ...}
  lens_width_mm   DOUBLE PRECISION,
  lens_height_mm  DOUBLE PRECISION,
  bridge_width_mm DOUBLE PRECISION,
  temple_length_mm DOUBLE PRECISION,
  -- images
  image_urls      JSONB DEFAULT '[]'::jsonb,      -- all source URLs (primary first)
  primary_image_url  TEXT,                        -- InsForge Storage public URL
  primary_image_key  TEXT,                        -- Storage key (for delete/re-upload)
  -- misc
  included_items   JSONB DEFAULT '[]'::jsonb,
  extra_attributes JSONB DEFAULT '{}'::jsonb,
  -- CLIP visual embedding (clip-ViT-B-32 → 512 dims, L2-normalized)
  clip_embedding  vector(512),
  -- pipeline bookkeeping (replaces the "skip already-scraped" set logic)
  specs_scraped_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- metadata filters used by match (price floor, optional shape/gender narrowing)
CREATE INDEX frames_price_idx ON public.frames (price);
CREATE INDEX frames_shape_idx ON public.frames (shape);

-- ANN index for image similarity (safe to create on an empty table)
CREATE INDEX frames_clip_embedding_hnsw_idx
  ON public.frames USING hnsw (clip_embedding vector_cosine_ops);
```

Design notes:
- `source_url UNIQUE` makes scraping an **upsert** (`ON CONFLICT (source_url)`), which
  replaces `scrape1.py`'s manual `done = {r["source_url"]…}` dedup and the
  resumability skip-logic. The harvest→scrape join (`listings.get(url)`) becomes
  "update the same row".
- `lens_*_mm` columns pre-parse what `features._mm()` re-parses on every match run.
  Raw `measurements` jsonb kept so nothing is lost (per AGENTS.md "nothing lost").
- The "drop-and-rescrape to fill missing measurements" recipe from the README
  becomes `UPDATE frames SET specs_scraped_at = NULL WHERE lens_width_mm IS NULL`
  then re-run scrape — no file surgery.

## 2. Storage bucket

```bash
npx @insforge/cli storage buckets create frame-images --public
```

`imagesim`'s download step uploads the primary image once and stores
`primary_image_url` + `primary_image_key` on the row (persist **both** per InsForge
storage rules). Replaces `image_cache/` and stops depending on source URLs that rot.

## 3. Match as a query, not a recompute

Keep the **spec blend in Python** (`features.py` is fine and keeps `alpha`
tunable), but let the DB do the expensive part — image ANN + price filter — via an
RPC, returning a small candidate pool to blend locally.

Add to the same (or a second) migration:

```sql
CREATE OR REPLACE FUNCTION public.match_cheaper(
  target_embedding vector(512),
  max_price        DOUBLE PRECISION,
  match_count      INT DEFAULT 50
)
RETURNS TABLE (id BIGINT, source_url TEXT, image_similarity DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT f.id, f.source_url,
         1 - (f.clip_embedding <=> target_embedding) AS image_similarity
  FROM public.frames f
  WHERE f.clip_embedding IS NOT NULL
    AND (max_price IS NULL OR f.price < max_price)
  ORDER BY f.clip_embedding <=> target_embedding
  LIMIT match_count;
$$;
```

`match.py` then: fetch target → call `match_cheaper` → fetch those ~50 rows →
blend `alpha*image + (1-alpha)*spec` over the small pool with existing
`features.spec_similarity_matrix`. This removes the full `(n×n)` image matrix and
the 979 KB embedding file; scales past 85.

> Note: at 85 rows the current code is already fast. The win is **state hygiene +
> scalability**, not present-day latency. If the catalog stays small, you can even
> skip the RPC and just `SELECT * WHERE price < target` and blend everything — but
> the RPC is the path that scales.

## 4. Python ↔ InsForge (the real integration cost)

`@insforge/sdk` is **JS/TS** — this pipeline is Python. So Python talks to the
backend over its **PostgREST-compatible REST API** + Storage REST, using the
**admin API key** (`ik_…` in `.insforge/project.json`), not the SDK.

Add one thin helper, mirroring `you_client.py`:

- `insforge_client.py` — `upsert_frames(rows)`, `fetch_unscraped_urls()`,
  `update_specs(url, spec)`, `upload_image(bytes) -> (url,key)`, `rpc_match(vec, price, n)`.
  All `requests` calls with `Authorization`/`apikey` header from a new
  `INSFORGE_API_KEY` env var (alongside `YOU_API_KEY` in `.env`).

> ⚠ Confirm exact REST paths/auth header from the `insforge-debug` skill before
> writing the helper — don't hardcode guessed endpoints. The vector→JSON wire format
> is a plain `number[]` (`clip_embedding: [0.12, …]`).

### Per-file fate

| File | Change |
|---|---|
| `harvest_listings.py` | write rows via `upsert_frames()` instead of dumping `sunglasses_urls.json`/`listings.json` |
| `scrape1.py` | worklist = `fetch_unscraped_urls()`; result = `update_specs()` upsert; drop file read/write + dedup-set logic |
| `imagesim.py` | embed once, `upload_image()` → store `clip_embedding` on the row; delete the JSON cache + `image_cache/` |
| `match.py` | call `rpc_match()` for candidates, blend pool in Python |
| `features.py` | unchanged (still does spec blend); can read `lens_*_mm` columns instead of regex-parsing |
| `spec.py`, `parser.py`, `listing_parse.py`, `link_extract.py`, `you_client.py`, `config.py` | unchanged |

## 5. One-time backfill

Before touching the scrapers, load the existing 85 records so nothing is re-spent
on You.com:

1. Apply the migration (empty table).
2. Script: read `specs.json` → `upsert_frames()` (maps each record to a row,
   parses mm into the `*_mm` columns).
3. Read `clip_embeddings.json` → set `clip_embedding` per row by image URL.
4. (Optional) upload cached `image_cache/` blobs to `frame-images`.

Idempotent via `source_url` upsert — safe to re-run.

## 6. Sequence

1. `db migrations new create-frames` → paste schema + RPC → `db migrations up --all`.
2. `storage buckets create frame-images --public`.
3. Add `INSFORGE_API_KEY` to `.env`; write `insforge_client.py`.
4. Backfill from existing JSON (§5) — verify `SELECT count(*) = 85`.
5. Port `match.py` first (read-only; validate recommendations match today's output).
6. Port `scrape1.py`, then `harvest_listings.py`, then `imagesim.py`.
7. Delete JSON artifacts from `.gitignore` once nothing reads them.

## Decisions / caveats to confirm before building

- **RLS**: this is a single-tenant admin pipeline, no end users. Plan uses the admin
  key and **no per-user RLS** (the `vector.md` `owner_id`/`auth.uid()` example does
  not apply). If a user-facing app is ever added, add a permissive read policy then.
- **CLIP stays local.** InsForge's AI gateway (OpenRouter) doesn't host
  `clip-ViT-B-32` image embeddings — keep `sentence-transformers` locally; InsForge
  only **stores** the vectors. (Text-embedding RAG via the gateway is a *different*
  feature, not what this matcher needs.)
- **Scraping stays.** You.com Contents API is still the fetch layer. Optional later:
  move harvest into an InsForge **edge function on a cron schedule** for hands-off
  re-crawls.
- **JS-vs-Python**: accept the REST-helper approach, or (bigger lift) rewrite the
  pipeline in TS to use the first-class SDK. Recommend REST helper.

## What this does NOT fix
- Partial You.com renders / missing measurements — same transient issue, just
  re-queried via `specs_scraped_at IS NULL` instead of file edits.
- Match quality / weights — untouched; identical scoring, different storage.
```
