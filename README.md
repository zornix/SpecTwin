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

## Stage 3 — Match (`match.py` + `features.py` + `imagesim.py`)

Scores every pair of frames on two signals and blends them:

```
score = alpha · image_similarity + (1 − alpha) · spec_similarity
```

- **Spec similarity** (`features.py`) — z-scored frame **measurements**
  (lens width/height, bridge, temple) via a Gaussian on distance, plus weighted
  **categorical** overlap: `shape` (0.45) ≫ `rim_type` (0.20) > `material` (0.15)
  > `gender` (0.08) > `size` (0.07) > `color` (0.05).
- **Image similarity** (`imagesim.py`) — cosine of **CLIP** (`clip-ViT-B-32`)
  embeddings of each product's primary photo. Images and embeddings are cached
  (`image_cache/`, `clip_embeddings.json`), so re-runs are cheap. If the model or
  network is unavailable, matching degrades gracefully to spec-only.

For a chosen target it returns the most similar items **priced below it**.

```bash
python match.py                            # list catalog (index, price, name, shape)
python match.py --target ray-ban-rb2132    # match by url/brand/name substring …
python match.py --target 12                # … or by catalog index
python match.py --target 12 --alpha 0.6    # weight visual (CLIP) similarity higher
python match.py --target 12 --top 10       # more results
python match.py --target 12 --spec-only    # skip image download / CLIP
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
| `match.py` | **Stage 3** — recommend cheaper look-alikes for a target |
| `misc/` | Superseded sitemap-filtering approach (see `misc/README.md`) |

**Generated artifacts** (all gitignored): `sunglasses_urls.json`, `listings.json`,
`specs.json`, `clip_embeddings.json`, `image_cache/`.

---

## Setup

```bash
pip install youdotcom pydantic                        # scraping
pip install sentence-transformers pillow scikit-learn requests  # matching (CLIP)
```

Put your key in `Wizardry/.env` (gitignored — never commit):

```
YOU_API_KEY=ydc-sk-...
YOU_CRAWL_TIMEOUT=30        # optional, per-URL crawl timeout
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
