"""Site-agnostic sunglasses spec scraper.

Fetches product pages as Markdown via the You.com Contents API (any URL), then
uses Nebius Token Factory to extract structured ``SunglassesSpecifications``.
Unlike ``scrape1.py`` (GlassesUSA-specific ``parser.py``), this works across
retailers — layout differences are handled by the LLM. URLs for non-GlassesUSA
sites live in ``misc/urls.json``.

Usage:
    python scraper.py                                    # reads misc/urls.json
    python scraper.py --urls-file path/to/urls.json
    python scraper.py --limit 50
    python scraper.py --restart
    python scraper.py "https://example.com/sunglasses/product.html"
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List

from nebiusparcer import parse_sunglasses_markdown
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
OUTPUT_FILE = HERE / "specs.json"
URLS_FILE = HERE / "misc" / "urls.json"
BATCH_SIZE = 10


def _flag_value(argv: List[str], flag: str) -> str | None:
    return argv[argv.index(flag) + 1] if flag in argv else None


def _resolve_urls_file(argv: List[str]) -> Path:
    if "--urls-file" in argv:
        return Path(_flag_value(argv, "--urls-file") or "")
    return URLS_FILE


def load_urls(argv: List[str]) -> List[str]:
    positional = [a for a in argv if not a.startswith("--")]
    for flag in ("--limit", "--urls-file"):
        val = _flag_value(argv, flag)
        if val in positional:
            positional.remove(val)
    if positional:
        return positional

    urls_file = _resolve_urls_file(argv)
    if not urls_file.exists():
        return []
    data = json.loads(urls_file.read_text())
    return [u for u in data.get("urls", []) if u]


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

    results = load_existing(restart)
    done = {r["source_url"] for r in results}

    urls = [u for u in load_urls(argv) if u not in done]
    if limit:
        urls = urls[: int(limit)]

    if not urls:
        print(f"Nothing to scrape (add URLs to {URLS_FILE} or pass them on the CLI).")
        return 1

    print(
        f"Scraping {len(urls)} URL(s) via You.com + Nebius "
        f"({len(done)} already in {OUTPUT_FILE.name})..."
    )

    for batch in _chunk(urls, BATCH_SIZE):
        for page in fetch_pages(batch):
            if not page.ok:
                print(f"  [FAIL] {page.url} — no content returned")
                continue
            try:
                spec = parse_sunglasses_markdown(page.url, page.markdown, page.title)
            except Exception as exc:
                print(f"  [FAIL] {page.url} — {exc}")
                continue
            results.append(spec.model_dump())
            print(
                f"  [ OK ] {spec.brand or '?'} {spec.product_name or page.url} | "
                f"${spec.price} shape={spec.shape} color={spec.color} | "
                f"imgs={len(spec.image_urls)}"
            )
        OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))

    print(f"\nWrote {len(results)} spec(s) to {OUTPUT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
