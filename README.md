# Wizardry

Scrapes and parses **sunglasses specifications** from product pages using the
[You.com Contents API](https://documentation.you.com/) — which extracts clean,
LLM-ready Markdown from a URL (no raw HTML, no headless browser).

## How it works

```
urls.json ──▶ you_client.fetch_pages ──▶ parser.parse_sunglasses ──▶ specs.json
              (You.com Contents API,      (Markdown → pydantic
               Markdown per URL)           SunglassesSpecifications)
```

1. **Fetch** — `you_client.py` sends URLs (batched, max 10/request) to the
   Contents API and gets back clean Markdown for each page.
2. **Parse** — `parser.py` reads that Markdown (no network) and pulls out the
   two tables GlassesUSA-style pages expose:
   - a *Frame Measurements* table (lens width/height, bridge, temple), and
   - a key/value *spec* table (size, gender, material, type, shape, color, …),
   plus the breadcrumb (brand/model), the marketing description, and the
   "Including:" list.
3. **Output** — results are validated into the `SunglassesSpecifications`
   pydantic model and written to `specs.json`.

## File structure

| File | Responsibility |
| --- | --- |
| `scrape1.py` | Entry point / orchestrator (load URLs → fetch → parse → write) |
| `config.py` | Loads `YOU_API_KEY` from the environment or `.env` |
| `you_client.py` | Thin wrapper over the You.com Contents API (Markdown fetch) |
| `parser.py` | Pure Markdown → `SunglassesSpecifications` parsing logic |
| `spec.py` | Pydantic models (`SunglassesSpecifications`, `FrameMeasurements`) |
| `urls.json` | Input list of product URLs to scrape |
| `specs.json` | Generated output (gitignored) |
| `.env` | `YOU_API_KEY=...` (gitignored — never commit) |

## Setup

```bash
pip install youdotcom pydantic
```

Put your key in `Wizardry/.env`:

```
YOU_API_KEY=ydc-sk-...
```

(Optional) tune the per-URL crawl timeout: `YOU_CRAWL_TIMEOUT=30`.

## Usage

```bash
cd Wizardry

# Scrape every URL in urls.json
python scrape1.py

# Or scrape ad-hoc URLs from the command line
python scrape1.py "https://www.glassesusa.com/black-medium/revel-slater/32-p6543.html"
```

Output is printed as a summary line per page and saved to `specs.json`.

## Notes

- The Contents API occasionally returns a **partial** page (some JS-rendered
  sections, like the measurements table, may be missing on a given crawl).
  Re-running typically fills them in; raising `YOU_CRAWL_TIMEOUT` helps too.
- Pages behind logins / 404s return `null` content; those are reported as
  `[FAIL]` and skipped, per the API's partial-failure behavior.
- Unmapped spec rows are preserved under `extra_attributes` so nothing is lost.
