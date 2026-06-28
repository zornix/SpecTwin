# Wizardry

Scrapes **sunglasses specifications** from GlassesUSA and recommends **cheaper
look-alikes** for expensive branded frames.

All fetching goes through the [You.com Contents API](https://documentation.you.com/),
which returns clean, LLM-ready Markdown from a URL — no raw HTML, no headless
browser, and it transparently clears the site's **Reblaze anti-bot challenge**
that blocks plain HTTP scrapers (`curl`/Playwright get a JS challenge, HTTP 247).

---

## The pipeline at a glance

```
 /sunglasses listing                    each product page                 specs.json
 (paginated ?p=N)                       (You.com Markdown)
        │                                      │                               │
        ▼                                      ▼                               ▼
┌─────────────────┐   urls + price   ┌──────────────────┐   specs   ┌────────────────────┐
│ harvest_listings│ ───────────────▶ │     scrape1      │ ────────▶ │       match        │
│  (listing_parse)│  sunglasses_     │     (parser)     │           │ (features+imagesim)│
│                 │  urls.json       │                  │           │                    │
│                 │  listings.json   │                  │           │  cheaper look-alike│
└─────────────────┘ ─ ─ ─ ─ ─ ─ ─ ─▶ └──────────────────┘           └────────────────────┘
   price + image  └────── joined by URL ──────┘
```

Three commands, three stages:

```bash
cd Wizardry
python harvest_listings.py     # 1. collect sunglasses URLs + prices
python scrape1.py              # 2. scrape full specs for each URL
python match.py --target <id>  # 3. recommend cheaper look-alikes
```

---

## Stage 1 — Harvest (`harvest_listings.py` + `listing_parse.py`)

Walks the `/sunglasses` grid page by page (`?p=2`, `?p=3`, …). The listing is the
site's **own authoritative sunglasses set** (product URLs themselves carry no
"is-sunglasses" marker, so you can't reliably filter the sitemap — see `misc/`).

Critically, **the listing grid is the only place a price appears.** Detail pages
do *not* show a price. So each grid card is parsed into:

```json
{ "url": "...", "price": 94.0, "original_price": 145.0, "image": "https://…_1.jpg" }
```

Output:
- `sunglasses_urls.json` — `{"urls": [...]}`, the worklist for stage 2.
- `listings.json` — `{url: {url, price, original_price, image}}`, joined back in stage 2.

Robustness: the Contents API occasionally returns a **truncated render** (a few
KB, no grid). Those are retried (`MIN_RENDER_BYTES`, `PAGE_RETRIES`) rather than
mistaken for the end of the listing. The walk stops after `EMPTY_STREAK_LIMIT`
consecutive fully-rendered pages add nothing new.

```bash
python harvest_listings.py                 # walk to exhaustion
python harvest_listings.py --max-pages 6   # cap pages while testing
python harvest_listings.py --listing https://www.glassesusa.com/mens-sunglasses
```

## Stage 2 — Scrape (`scrape1.py` + `parser.py` + `spec.py`)

For every URL, fetches the product page's Markdown and parses it into a
`SunglassesSpecifications` record, then **joins in the price + thumbnail** from
`listings.json` by URL. Incremental & resumable — already-scraped URLs are
skipped, and results are flushed every batch, so you can stop/re-run freely.

```bash
python scrape1.py                  # scrape all unscraped URLs
python scrape1.py --limit 50       # next 50 only (cost control)
python scrape1.py --restart        # ignore existing specs.json, start over
python scrape1.py "https://www.glassesusa.com/black-medium/revel-slater/32-p6543.html"
```

Output → `specs.json` (a JSON list of records; see schema below).

## Stage 3 — Match (`match.py` + `features.py` + `imagesim.py` + `descsim.py`)

Scores every pair of frames on **three** signals and blends them:

```
score = w_img · image_similarity + w_text · description_similarity + w_spec · spec_similarity
```

where `w_img = --alpha`, `w_text = --text-weight`, and `w_spec` is the remainder
(`1 − w_img − w_text`). Any optional signal that is unavailable is dropped and the
remaining weights are renormalized, so matching always degrades gracefully.

- **Spec similarity** (`features.py`) — z-scored frame **measurements**
  (lens width/height, bridge, temple) via a Gaussian on distance, plus weighted
  **categorical** overlap: `shape` (0.45) ≫ `rim_type` (0.20) > `material` (0.15)
  > `gender` (0.08) > `size` (0.07) > `color` (0.05).
- **Image similarity** (`imagesim.py`) — cosine of **CLIP** (`clip-ViT-B-32`)
  embeddings of each product's primary photo. Images and embeddings are cached
  (`image_cache/`, `clip_embeddings.json`), so re-runs are cheap. Embeddings are
  filled in **parallel** — downloads run across a thread pool and the CLIP encode
  runs in batches, flushing the cache atomically as batches land (resumable). It
  fills in lazily during a match, or you can backfill the whole catalog up front:

  ```bash
  python imagesim.py                  # embed every catalog image (parallel)
  python imagesim.py --workers 32     # more concurrent downloads (default 16)
  python imagesim.py --batch-size 128 # larger CLIP encode batches (default 64)
  python imagesim.py --limit 200      # only the next 200 missing (time cap)
  ```
- **Description similarity** (`descsim.py` + `style_profile.py`) — cosine of
  **sentence-transformer** (`all-MiniLM-L6-v2`) embeddings of each frame's
  **style profile**. The raw marketing blurb is first normalized by a small LLM
  (`style_profile.py`, via the InsForge AI gateway / OpenRouter) into a
  **brand-agnostic** description of the frame's *aesthetic* — silhouette, vibe,
  era influences, who it suits — so the signal captures *style*, not brand
  mentions or specs already covered above. Profiles and embeddings are cached
  (`style_profiles.json`, `desc_embeddings.json`). If a frame has no profile yet
  the raw description is embedded as a fallback; if the model is unavailable the
  signal is dropped.

For a chosen target it returns the most similar items **priced below it**.

```bash
python match.py                              # list catalog (index, price, name, shape)
python match.py --target ray-ban-rb2132      # match by url/brand/name substring …
python match.py --target 12                  # … or by catalog index
python match.py --target 12 --alpha 0.6      # weight visual (CLIP) similarity higher
python match.py --target 12 --text-weight 0.4  # add description-style similarity
python match.py --target 12 --desc-only      # match purely on description style
python match.py --target 12 --top 10         # more results
python match.py --target 12 --spec-only      # skip image download / CLIP
```

> **One-time profile build.** Description matching reads style profiles from
> `style_profiles.json`. Generate them (incremental & resumable, cached by
> description hash) with:
>
> ```bash
> npx @insforge/cli ai setup        # writes OPENROUTER_API_KEY to .env.local (once)
> python style_profile.py           # normalize every description (parallel, resumable)
> python style_profile.py --workers 16   # more concurrent LLM calls (default 8)
> python style_profile.py --limit 50      # only the next 50 missing (cap cost)
> python style_profile.py --show 3        # inspect raw vs. normalized profile for index 3
> ```
>
> Generation runs a thread pool of concurrent LLM calls and flushes the cache
> atomically as profiles land, so it is safe to stop (`Ctrl-C`) and resume.
>
> Until a frame is profiled, its raw description is used as a (noisier) fallback,
> so matching still works before the full build completes.

### The final ranking score

Every candidate is ranked by **one number in `[0, 1]`** — the blended similarity
to the target produced by `combined_similarity` (`match.py`). **Price is not part
of the score**; it only acts as a *filter* afterwards (see below).

**1. Top-level blend.** The three signals are combined into a weighted average
that *renormalizes* whenever a signal is missing, so the score is always on a
`[0, 1]` scale regardless of which signals are available:

```
            w_img · image_sim  +  w_text · desc_sim  +  w_spec · spec_sim
score  =   ───────────────────────────────────────────────────────────────
                          w_img  +  w_text  +  w_spec

  w_img  = alpha            (image / CLIP weight)
  w_text = text_weight      (style-profile weight)
  w_spec = 1 − w_img − w_text   (remainder; spec weight)
```

If a signal can't be computed (no model/network, or its weight is 0) its term is
dropped from both numerator and denominator — i.e. the remaining weights are
renormalized rather than the score silently shrinking.

**2. Default weights.** The **frontend entry point** (`recommend_api.py`) defaults
to **`alpha = 0.4`, `text_weight = 0.2`** — i.e. all three signals on, with style
as a light refiner. The `match.py` CLI keeps a simpler `alpha = 0.5`,
`text_weight = 0.0` (spec+image) default for quick experimentation.

| Mode | Invocation | `w_img` | `w_text` | `w_spec` |
| --- | --- | --- | --- | --- |
| **`recommend_api` default** | (no flags) | 0.4 | 0.2 | 0.4 |
| **`match.py` default** | (no flags) | 0.5 | 0.0 | 0.5 |
| spec-leaning variant | `--alpha 0.35 --text-weight 0.2` | 0.35 | 0.2 | 0.45 |
| `--spec-only` | spec signal only | — | — | 1.0 |
| `--desc-only` | style signal only | — | 1.0 | — |

So the production ranking is **`0.4 · image_sim + 0.2 · desc_sim + 0.4 · spec_sim`**.
The style signal is weighted as a light **refiner** (0.2): the style profile
partially overlaps `shape` already in the spec signal, so it nudges ties toward
frames with the same *aesthetic* without overriding the hard physical signals.
Style-profile coverage is ~complete (1501/1502 frames), so the signal is reliable
for nearly every target.

**3. What each signal is.**

- **`image_sim`** — cosine similarity of **CLIP** (`clip-ViT-B-32`) embeddings of
  the two primary photos (`imagesim.py`).
- **`desc_sim`** — cosine similarity of **sentence-transformer**
  (`all-MiniLM-L6-v2`) embeddings of the brand-agnostic **style profiles**
  (`descsim.py` + `style_profile.py`).
- **`spec_sim`** — itself a **50/50 sub-blend** (`features.py`,
  `spec_similarity_matrix`):

  ```
  spec_sim = 0.5 · numeric_sim + 0.5 · categorical_sim
  ```

  - **`numeric_sim`** — the four measurements (lens width/height, bridge, temple)
    are **z-scored** across the catalog, then similarity is a **Gaussian on
    Euclidean distance**: `exp(−distance / 2)`. Missing measurements are imputed
    with the column mean.
  - **`categorical_sim`** — a **weighted Jaccard overlap** of token sets, with
    shape dominating because it defines the silhouette:

    | Field | Weight |
    | --- | --- |
    | `shape` | 0.45 |
    | `rim_type` | 0.20 |
    | `material` | 0.15 |
    | `gender` | 0.08 |
    | `size` | 0.07 |
    | `color` | 0.05 |

    For each field the score adds `weight · |A ∩ B| / |A ∪ B|`; fields where
    *neither* frame has a value are treated as neutral (skipped), and the total is
    normalized by the summed weights of the fields that counted.

**4. Price is a filter, not a term.** `recommend()` sorts candidates by `score`
descending, removes the target itself, then — when `cheaper_only=True` (the
default) — **skips any candidate priced `≥` the target** before taking the top-N.
Two candidates are therefore ordered purely by similarity; how *much* cheaper one
is never changes its rank. The `savings` field in the payload is display-only.

> **Cross-mode caveat.** Scores are only comparable *within* one weighting. A
> `--spec-only` score and a blended score live on different scales, so pick one
> weighting for the live flow and keep it consistent.

### Frontend entry point (`recommend_api.py`)

`match.py` is a CLI that prints text. `recommend_api.py` wraps the same blended
matching (`combined_similarity` + `recommend`) behind a single function that
takes a **catalog URL** and returns a **JSON payload** ready to render — each
candidate carries `image`, `price`, `url`, `brand`, `name`, and a normalized
`similarity` score (plus `savings` vs. the target). A known URL resolves from
the cache with no scraping/embedding at request time, so it's safe to call from
an API handler. It defaults to the production blend
**`0.4 image + 0.2 style + 0.4 spec`** (see *The final ranking score* above).

```python
from recommend_api import recommend_by_url
payload = recommend_by_url(url, top_n=3)                  # default 0.4/0.2/0.4 blend
payload = recommend_by_url(url, top_n=3, alpha=0.35, text_weight=0.2)  # spec-leaning
```

```bash
python recommend_api.py --pretty <url>                 # default blend (image+style+spec)
python recommend_api.py --alpha 0.35 --text-weight 0.2 <url>  # spec-leaning variant
python recommend_api.py --spec-only <url>              # no CLIP download
python recommend_api.py --include-pricier <url>        # rank by similarity, ignore price
```

Payload shape (`ok:false` with an `error` code on catalog-empty / URL-not-found):

```json
{
  "ok": true,
  "query_url": "https://www.glassesusa.com/.../46-000638.html",
  "weights": { "mode": "blended", "image": 0.4, "description": 0.2, "spec": 0.4 },
  "cheaper_only": true,
  "target":  { "url": "...", "brand": "Oakley", "name": "...", "price": 184.0, "image": "...", "shape": "Square, Wrap" },
  "count": 3,
  "candidates": [
    { "rank": 1, "url": "...", "brand": "Oakley", "name": "Oakley OO9497 Briza Black, Gray",
      "price": 150.0, "image": "...", "shape": "Square", "similarity": 0.9077, "savings": 34.0 }
  ]
}
```

### Catalog-wide dupe finder (`find_dupes.py`)

`match.py` answers *"given one target, show cheaper look-alikes."* `find_dupes.py`
flips that around and scans the **whole catalog** to surface the best
**designer → cheaper-dupe** opportunities in one pass.

A pair must clear four hard gates — **same shape** (identical shape token-set),
**same rim_type** (full-rim/semi-rimless/rimless is a big visual difference, so
it's required by default; relax with `--any-rim`), **dimensionally close** (small
Euclidean distance over the four mm measurements), and **meaningfully cheaper**
while still stylish (a minimum saving + a price floor so junk frames don't
surface). Survivors are then ranked by an overall **fit score** that blends:

```
fit = 0.6 · measurement_closeness + 0.4 · (rim_type · 0.5 + color · 0.3 + size · 0.2)
```

so among the same-rim survivors, matching `color` and `size` push a candidate up
the list. The rim/size/color columns flag each attribute: `✓` exact, `~`
partial overlap, `✗` differs (rim is always `✓` unless `--any-rim`). Premium
targets are recognised designer brands
(`PREMIUM_BRANDS`) or anything at/above `--price-floor`. Pure spec signal, so it
covers all 1502 frames without needing CLIP image embeddings.

Each branded frame lists its top **`--per-target`** alternatives (default 3), so
you see several cheaper options per designer frame, not just the single closest.

```bash
python find_dupes.py                       # top designer→dupe opportunities
python find_dupes.py --per-target 5        # list up to 5 look-alikes per frame
python find_dupes.py --top 40              # show more branded frames
python find_dupes.py --brand Versace       # only targets from this brand
python find_dupes.py --max-mm 3            # tighter "same measurements" tolerance
python find_dupes.py --loose-shape         # match overlapping (not identical) shape
python find_dupes.py --any-rim             # relax the default same-rim_type gate
python find_dupes.py --require-size        # also hard-require same size …
python find_dupes.py --require-color       # … and a shared color
python find_dupes.py --report dupes.md     # also write a Markdown report
```

Example output:

```
  1. Versace VE4471B Shiny Black  $665  [Cat Eye]
     -> Calvin Klein CK22532S Shiny Black  $300  (save $365, fit 1.00, Δ0.0mm)
        rim ✓  size ✓  color ✓   (Full-Rim/Average/Shiny Black vs Full-Rim/Average/Shiny Black)
        meas (lw/lh/br/tl mm)  56.0 / 47.0 / 16.0 / 140.0  vs  56.0 / 47.0 / 16.0 / 140.0
```

Example output:

```
Target: Versace VE2225 (Aviator, $480)
Cheaper look-alikes (alpha=0.5, spec+image):
  0.888  Ray-Ban Caravan (Aviator metal, $191)  -$289
  …
```

---

## What gets collected per pair of sunglasses

Every record in `specs.json` is a `SunglassesSpecifications` object
(`spec.py`). **Yes — measurements, size, material, shape and type are all
captured on every profile**, alongside price and images:

| Field | Source on page | Example | Coverage* |
| --- | --- | --- | --- |
| `source_url` | — | `…/32-p6543.html` | 85/85 |
| `brand`, `product_name` | breadcrumb / title | `Ray-Ban`, `Revel Slater` | 85/85 |
| `shape` | spec table → **Shape** | `Square` | 85/85 |
| `size` | spec table → **Size** | `Wide` | 85/85 |
| `material` | spec table → **Material** | `Plastic` | 85/85 |
| `rim_type` | spec table → **Type** | `Full-Rim` | 85/85 |
| `color` | spec table → **Color** | `Black` | 85/85 |
| `gender` | spec table → **Gender** | `Men` | 85/85 |
| `measurements.lens_width` | Frame Measurements | `48 mm / 1.89"` | 73/85 |
| `measurements.lens_height` | Frame Measurements | `34 mm / 1.34"` | 73/85 |
| `measurements.bridge_width` | Frame Measurements | `23 mm / 0.91"` | 73/85 |
| `measurements.temple_length` | Frame Measurements | `145 mm / 5.71"` | 73/85 |
| `price` | **listing grid** (stage 1) | `94.0` | 85/85 |
| `original_price` | listing grid (if on sale) | `145.0` | varies |
| `image_urls` | detail page + listing thumb | `[".../32-p6543-u_1.jpg", …]` | 85/85 |
| `description` | product description | free text | most |
| `included_items` | "Including:" list | `["Case", "Cloth"]` | varies |
| `extra_attributes` | any unmapped spec row | `{...}` | varies |

\* Coverage on the current 85-record sample. Measurements sit at 73/85 because
the Contents API sometimes omits the JS-rendered measurements table on a given
crawl. `scrape1.py` skips URLs it has already scraped, so to re-pull a page whose
measurements came back empty, delete that record from `specs.json` (or run
`--restart`) and scrape again.

### Answering the specific questions

- **Where are image URLs stored?** In each record's **`image_urls`** list inside
  `specs.json` (primary image first). The same primary URL is what `imagesim.py`
  downloads into `image_cache/` and embeds with CLIP. The listing-card thumbnail
  is also kept in `listings.json` and seeded into `image_urls` during the join.
- **What specs are collected?** The full table above — the six categorical spec
  fields (`shape`, `size`, `material`, `rim_type` [the page's "Type"], `color`,
  `gender`), the four `measurements`, plus brand/name, price, images, description,
  and included items.
- **Are the four measurements + size, material, shape and type added to every
  profile?** Yes. The block you quoted —

  ```
  Lens Width:    48 mm / 1.89"
  Lens Height:   34 mm / 1.34"
  Bridge Width:  23 mm / 0.91"
  Temple Length: 145 mm / 5.71"
  ```

  maps to `measurements.{lens_width, lens_height, bridge_width, temple_length}`
  (stored as the original `"48 mm / 1.89\""` strings; `features.py` parses the
  leading mm number for similarity). `size`→`size`, `material`→`material`,
  `shape`→`shape`, and the page's **"Type"** field →`rim_type`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `harvest_listings.py` | **Stage 1** — paginate `/sunglasses`, emit URLs + price/image |
| `listing_parse.py` | Pure listing-card parser (`{url, price, original_price, image}`) |
| `link_extract.py` | `product_url()` recognizer (shared with the old approach) |
| `scrape1.py` | **Stage 2** — load URLs → fetch → parse → join price → write |
| `parser.py` | Pure Markdown → `SunglassesSpecifications` parsing |
| `spec.py` | Pydantic models (`SunglassesSpecifications`, `FrameMeasurements`) |
| `you_client.py` | Thin wrapper over the You.com Contents API |
| `config.py` | Loads `YOU_API_KEY` from env / `.env` |
| `features.py` | **Stage 3** — spec → feature vectors + spec similarity |
| `imagesim.py` | **Stage 3** — CLIP image embeddings + visual similarity (cached) |
| `style_profile.py` | **Stage 3** — LLM-normalize descriptions → brand-agnostic style profiles (cached) |
| `descsim.py` | **Stage 3** — sentence-transformer description embeddings + similarity (cached) |
| `match.py` | **Stage 3** — recommend cheaper look-alikes for a single target |
| `recommend_api.py` | **Stage 3** — URL → top-N look-alikes as a frontend-ready JSON payload |
| `find_dupes.py` | **Stage 3** — catalog-wide scan: designer frames → cheaper same-shape dupes |
| `misc/` | Superseded sitemap-filtering approach (see `misc/README.md`) |

**Generated artifacts**: `sunglasses_urls.json`, `listings.json`, `specs.json`,
`clip_embeddings.json`, `image_cache/`, `style_profiles.json`,
`desc_embeddings.json`. The OpenRouter key lives in `.env.local` (gitignored).

---

## Setup

```bash
pip install youdotcom pydantic                        # scraping
pip install sentence-transformers pillow scikit-learn requests  # matching (CLIP + text)
pip install openai                                     # description normalization (OpenRouter)
```

Put your You.com key in `Wizardry/.env` (gitignored — never commit):

```
YOU_API_KEY=ydc-sk-...
YOU_CRAWL_TIMEOUT=30        # optional, per-URL crawl timeout
```

For **description matching**, the OpenRouter key (InsForge AI gateway) is fetched
into `.env.local` by the CLI — no manual copy needed:

```bash
npx @insforge/cli ai setup   # writes OPENROUTER_API_KEY to .env.local
# optional overrides (read by config.py):
#   OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini   # model used to normalize descriptions
```

---

## Notes

- Each You.com request costs credits (≈1 per listing page in stage 1, 1 per
  product in stage 2). Use `--max-pages` / `--limit` to control spend; both
  stages are resumable.
- A **partial** page render can omit JS sections (e.g. the measurements table);
  re-running typically fills them in, and raising `YOU_CRAWL_TIMEOUT` helps.
- Pages behind logins / 404s return `null` content — reported as `[FAIL]` and
  skipped.
- Unmapped spec rows are preserved under `extra_attributes` so nothing is lost.

---

## Troubleshooting — missing measurements

The `measurements` table (lens width/height, bridge, temple) is JS-rendered, so
the Contents API sometimes returns a product page **without it** (the page
otherwise parses fine — shape/size/material/etc. are still captured). Those
records land in `specs.json` with `measurements` fields set to `null`, which
weakens spec matching for that frame.

**Why it happens:** a partial / truncated render of that one page on that one
crawl. It is transient — the same URL usually renders fully on a retry.

**How to find the gaps:**

```bash
python3 -c "import json; d=json.load(open('specs.json')); \
print(sum(1 for r in d if not (r.get('measurements') or {}).get('lens_width')), \
'of', len(d), 'records missing measurements')"
```

**How to fix it.** `scrape1.py` skips any URL already in `specs.json` (it dedups
by `source_url`), so a plain re-run won't re-pull them — passing the URL as an
argument is skipped for the same reason. You first have to **drop the incomplete
records**, then scrape again so they're treated as unscraped:

```bash
# 1. Remove records whose measurements are incomplete (keeps everything else).
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("specs.json")
recs = json.loads(p.read_text())
fields = ("lens_width", "lens_height", "bridge_width", "temple_length")
full = lambda r: all((r.get("measurements") or {}).get(f) for f in fields)
keep = [r for r in recs if full(r)]
print(f"dropping {len(recs) - len(keep)} record(s) with missing measurements")
p.write_text(json.dumps(keep, indent=2, ensure_ascii=False))
PY

# 2. Re-scrape — only the dropped URLs are now "unscraped", so this re-fetches
#    just them (cheap: ~1 credit each), and the fuller render fills them in.
python scrape1.py
```

Repeat if a few are still partial. If a specific URL *never* renders its table
after several tries, raise the crawl timeout for that pass:

```bash
YOU_CRAWL_TIMEOUT=45 python scrape1.py
```

> Prefer the drop-and-rescrape recipe over `--restart` — `--restart` rebuilds the
> **entire** catalog from scratch (re-spending a credit on every product),
> whereas dropping only the incomplete rows re-fetches the handful that need it.
