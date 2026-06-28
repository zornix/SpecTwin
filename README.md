# Wizardry

Scrapes **sunglasses specifications** from GlassesUSA and recommends **cheaper
look-alikes** for expensive branded frames. All fetching goes through the
[You.com Contents API](https://documentation.you.com/) — which returns clean,
LLM-ready Markdown from a URL (no raw HTML, no headless browser, and it
transparently clears the site's Reblaze anti-bot challenge that blocks plain
HTTP scrapers).

## How it works

```
/sunglasses listing ─▶ harvest_listings ─▶ sunglasses_urls.json  (+ listings.json: price, image)
                          (paginate ?p=N,
                           parse grid cards)
                                  │
                                  ▼
sunglasses_urls.json ─▶ scrape1 ─▶ parser.parse_sunglasses ─▶ specs.json
                        (You.com Markdown   (specs + price/image
                         per product page)   joined from listings.json)
                                  │
                                  ▼
specs.json ─▶ match ─▶ cheaper look-alikes
              (spec similarity + CLIP image similarity)
```

1. **Harvest** — `harvest_listings.py` walks the `/sunglasses` grid page by page
   (`?p=N`), parsing each card into `{url, price, original_price, image}`. This
   is the site's own authoritative sunglasses set, and it's the *only* place a
   **price** is exposed (detail pages don't carry one). Partial renders are
   retried so the walk doesn't stop short. → `sunglasses_urls.json`, `listings.json`.
2. **Scrape** — `scrape1.py` fetches each product page's Markdown and
   `parser.py` pulls out the *Frame Measurements* table (lens/bridge/temple), the
   key/value *spec* table (size, gender, material, type, shape, color), the
   breadcrumb (brand/model), description, images, and the "Including:" list —
   then joins in the listing's price/thumbnail. Incremental & resumable.
   → `specs.json`.
3. **Match** — `match.py` blends spec similarity (`features.py`: z-scored
   measurements + shape/rim/material token overlap) with visual similarity
   (`imagesim.py`: CLIP `clip-ViT-B-32` image embeddings) and, for a target
   frame, returns the most similar items priced below it.

## File structure

| File | Responsibility |
| --- | --- |
| `harvest_listings.py` | Paginate the `/sunglasses` grid → product URLs + price/image |
| `listing_parse.py` | Pure listing-card parser (`{url, price, original_price, image}`) |
| `scrape1.py` | Orchestrator (load URLs → fetch → parse → join price → write) |
| `config.py` | Loads `YOU_API_KEY` from the environment or `.env` |
| `you_client.py` | Thin wrapper over the You.com Contents API (Markdown fetch) |
| `parser.py` | Pure Markdown → `SunglassesSpecifications` parsing logic |
| `spec.py` | Pydantic models (`SunglassesSpecifications`, `FrameMeasurements`) |
| `features.py` | Spec → numeric/categorical feature vectors + similarity |
| `imagesim.py` | CLIP image embeddings + visual similarity (cached) |
| `match.py` | Recommend cheaper look-alikes for a target frame |
| `sunglasses_urls.json` | Harvested product URL list (drives `scrape1.py`) |
| `listings.json` | Per-URL price / original_price / thumbnail from the grid |
| `specs.json` | Generated output (gitignored) |
| `.env` | `YOU_API_KEY=...` (gitignored — never commit) |

## Setup

```bash
pip install youdotcom pydantic                       # scraping
pip install sentence-transformers pillow scikit-learn # matching (CLIP image similarity)
```

Put your key in `Wizardry/.env`:

```
YOU_API_KEY=ydc-sk-...
```

(Optional) tune the per-URL crawl timeout: `YOU_CRAWL_TIMEOUT=30`.

## Usage

```bash
cd Wizardry

# 1. Harvest the sunglasses catalog from the /sunglasses listing
python harvest_listings.py                 # walk to exhaustion
python harvest_listings.py --max-pages 6   # or cap pages while testing

# 2. Scrape specs for the harvested URLs (incremental & resumable)
python scrape1.py                          # all unscraped URLs
python scrape1.py --limit 50               # next 50 only (cost control)
python scrape1.py "https://www.glassesusa.com/black-medium/revel-slater/32-p6543.html"

# 3. Recommend cheaper look-alikes
python match.py                            # list the catalog (index, price, name)
python match.py --target ray-ban-rb2132    # match by index or url/brand substring
python match.py --target 12 --alpha 0.6    # weight visual (CLIP) similarity higher
python match.py --target 12 --spec-only    # skip image download / CLIP
```

Each step prints a summary line per item; specs are saved to `specs.json`.

## Notes

- The Contents API occasionally returns a **partial** page (some JS-rendered
  sections, like the measurements table, may be missing on a given crawl).
  Re-running typically fills them in; raising `YOU_CRAWL_TIMEOUT` helps too.
- Pages behind logins / 404s return `null` content; those are reported as
  `[FAIL]` and skipped, per the API's partial-failure behavior.
- Unmapped spec rows are preserved under `extra_attributes` so nothing is lost.
