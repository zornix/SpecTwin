"""Entry point: scrape sunglasses specs via the You.com Contents API.

Reads URLs from ``sunglasses_urls.json`` (produced by ``harvest_listings.py``),
fetches clean Markdown through the Contents API, parses each page into a
``SunglassesSpecifications`` model — enriched with the price/thumbnail captured
from the listing grid (``listings.json``) — and writes the results to
``specs.json``.

The run is incremental: already-scraped URLs in ``specs.json`` are skipped, so
it is safe to stop and resume, or to grow the catalog over several sessions.

Usage:
    python scrape1.py                       # uses sunglasses_urls.json
    python scrape1.py --limit 50            # scrape only the next 50 unscraped
    python scrape1.py --restart             # ignore existing specs.json
    python scrape1.py <url> [<url> ...]     # ad-hoc URLs
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List

from parser import parse_sunglasses
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
URLS_FILE = HERE / "sunglasses_urls.json"
LISTINGS_FILE = HERE / "listings.json"
OUTPUT_FILE = HERE / "specs.json"

BATCH_SIZE = 10  # matches the Contents API per-request cap; save after each batch


def _flag_value(argv: List[str], flag: str) -> str | None:
    return argv[argv.index(flag) + 1] if flag in argv else None


def load_urls(args: List[str]) -> List[str]:
    """Use positional CLI args as URLs, otherwise read sunglasses_urls.json."""
    positional = [a for a in args if not a.startswith("--")]
    # Drop values that belong to flags like ``--limit 50``.
    limit_val = _flag_value(args, "--limit")
    if limit_val in positional:
        positional.remove(limit_val)
    if positional:
        return positional
    if not URLS_FILE.exists():
        return []
    data = json.loads(URLS_FILE.read_text())
    return [u for u in data.get("urls", []) if u]


def load_listings() -> Dict[str, dict]:
    if LISTINGS_FILE.exists():
        return json.loads(LISTINGS_FILE.read_text())
    return {}


def load_existing(restart: bool) -> List[dict]:
    if restart or not OUTPUT_FILE.exists():
        return []
    try:
        return json.loads(OUTPUT_FILE.read_text())
    except json.JSONDecodeError:
        return []


def _chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main(argv: List[str]) -> int:
    restart = "--restart" in argv
    limit = _flag_value(argv, "--limit")
    listings = load_listings()

    results = load_existing(restart)
    done = {r["source_url"] for r in results}

    urls = [u for u in load_urls(argv) if u not in done]
    if limit:
        urls = urls[: int(limit)]

    if not urls:
        print("Nothing to scrape (run harvest_listings.py first, or all URLs already done).")
        return 1

    print(f"Scraping {len(urls)} URL(s) via You.com Contents API "
          f"({len(done)} already in {OUTPUT_FILE.name})...")

    for batch in _chunk(urls, BATCH_SIZE):
        for page in fetch_pages(batch):
            if not page.ok:
                print(f"  [FAIL] {page.url} — no content returned")
                continue
            spec = parse_sunglasses(page.url, page.markdown, page.title, listings.get(page.url))
            results.append(spec.model_dump())
            print(
                f"  [ OK ] {spec.brand or '?'} {spec.product_name or page.url} | "
                f"${spec.price} shape={spec.shape} color={spec.color} | "
                f"imgs={len(spec.image_urls)}"
            )
        # Persist after every batch so a long run is resumable.
        OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))

    print(f"\nWrote {len(results)} spec(s) to {OUTPUT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
