"""Entry point: scrape sunglasses specs via the You.com Contents API.

Reads URLs from urls.json (or the command line), fetches clean Markdown
through the Contents API, parses each page into a SunglassesSpecifications
model, and writes the results to specs.json.

Usage:
    python scrape1.py                       # uses urls.json
    python scrape1.py <url> [<url> ...]     # ad-hoc URLs
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List

from parser import parse_sunglasses
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
URLS_FILE = HERE / "urls.json"
OUTPUT_FILE = HERE / "specs.json"


def load_urls(args: List[str]) -> List[str]:
    """Use CLI args if provided, otherwise read urls.json."""
    if args:
        return args
    if not URLS_FILE.exists():
        return []
    data = json.loads(URLS_FILE.read_text())
    return [u for u in data.get("urls", []) if u]


def main(argv: List[str]) -> int:
    urls = load_urls(argv)
    if not urls:
        print("No URLs to scrape. Add some to urls.json or pass them as arguments.")
        return 1

    print(f"Fetching {len(urls)} URL(s) via You.com Contents API...")
    pages = fetch_pages(urls)

    results = []
    for page in pages:
        if not page.ok:
            print(f"  [FAIL] {page.url} — no content returned")
            continue
        spec = parse_sunglasses(page.url, page.markdown, page.title)
        results.append(spec.model_dump())
        m = spec.measurements
        print(
            f"  [ OK ] {spec.brand or '?'} {spec.product_name or page.url} | "
            f"shape={spec.shape} material={spec.material} color={spec.color} | "
            f"lens={m.lens_width} bridge={m.bridge_width} temple={m.temple_length}"
        )

    OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(results)} spec(s) to {OUTPUT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
