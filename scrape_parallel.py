"""Parallel sunglasses spec scraper (You.com Contents API).

Same pipeline as ``scrape1.py`` — fetch clean Markdown for each listing,
parse it into a ``SunglassesSpecifications`` (enriched with the price/thumbnail
from ``listings.json``), and write to ``specs.json`` — but it runs many 10-URL
Contents batches *concurrently* instead of one at a time.

Each You.com request crawls live and blocks for up to ``crawl_timeout`` seconds,
so the work is I/O-bound: a thread pool of N workers, each owning one 10-URL
batch, cuts wall-clock time by ~N with no change to the API's per-request cap.

The run is incremental and crash-safe: URLs already in ``specs.json`` are
skipped, and the file is rewritten (atomically) every time a batch lands, so
you can stop and resume, or grow the catalog over several sessions.

Usage:
    python scrape_parallel.py                     # scrape all un-done listings
    python scrape_parallel.py --workers 8         # 8 concurrent batches (default 6)
    python scrape_parallel.py --limit 100         # only the next 100 un-done
    python scrape_parallel.py --per-shape 100     # stop once every seen shape >= 100
    python scrape_parallel.py --restart           # ignore existing specs.json
"""
from __future__ import annotations

import json
import os
import sys
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional

from parser import parse_sunglasses
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
LISTINGS_FILE = HERE / "listings.json"
OUTPUT_FILE = HERE / "specs.json"

BATCH_SIZE = 10          # Contents API per-request cap
DEFAULT_WORKERS = 6      # concurrent in-flight batches


def _flag(argv: List[str], name: str) -> Optional[str]:
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else None


def load_listings() -> Dict[str, dict]:
    return json.loads(LISTINGS_FILE.read_text()) if LISTINGS_FILE.exists() else {}


def load_existing(restart: bool) -> List[dict]:
    if restart or not OUTPUT_FILE.exists():
        return []
    try:
        return json.loads(OUTPUT_FILE.read_text())
    except json.JSONDecodeError:
        return []


def _chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _atomic_write(results: List[dict]) -> None:
    tmp = OUTPUT_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    os.replace(tmp, OUTPUT_FILE)


def _scrape_batch(batch: List[str], listings: Dict[str, dict]) -> List[dict]:
    """Fetch + parse one 10-URL batch. Runs inside a worker thread."""
    specs: List[dict] = []
    for page in fetch_pages(batch):
        if not page.ok:
            continue
        spec = parse_sunglasses(page.url, page.markdown, page.title, listings.get(page.url))
        specs.append(spec.model_dump())
    return specs


def main(argv: List[str]) -> int:
    restart = "--restart" in argv
    workers = int(_flag(argv, "--workers") or DEFAULT_WORKERS)
    limit = _flag(argv, "--limit")
    per_shape = _flag(argv, "--per-shape")
    per_shape_n = int(per_shape) if per_shape else None

    listings = load_listings()
    results = load_existing(restart)
    done = {r["source_url"] for r in results}

    urls = [u for u in listings.keys() if u not in done]
    if limit:
        urls = urls[: int(limit)]

    if not urls:
        print("Nothing to scrape — every listing is already in specs.json.")
        return 1

    shapes: Counter = Counter((r.get("shape") or "UNKNOWN") for r in results)
    batches = _chunk(urls, BATCH_SIZE)
    print(
        f"Scraping {len(urls)} listing(s) in {len(batches)} batch(es) "
        f"across {workers} workers ({len(done)} already done)..."
    )

    write_lock = threading.Lock()
    completed_urls = 0
    stop = False

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_scrape_batch, b, listings): b for b in batches}
        try:
            for fut in as_completed(futures):
                if stop:
                    break
                specs = fut.result()
                with write_lock:
                    results.extend(specs)
                    for s in specs:
                        shapes[s.get("shape") or "UNKNOWN"] += 1
                    _atomic_write(results)
                completed_urls += len(specs)
                top = ", ".join(f"{k}:{v}" for k, v in shapes.most_common(6))
                print(f"  +{len(specs):2d}  ({len(results)} total) | {top}")

                # Optional early stop once every *seen* shape has enough samples.
                if per_shape_n and shapes:
                    real = {k: v for k, v in shapes.items() if k != "UNKNOWN"}
                    if real and all(v >= per_shape_n for v in real.values()):
                        print(f"\nEvery seen shape has >= {per_shape_n} samples — stopping early.")
                        stop = True
        except KeyboardInterrupt:
            print("\nInterrupted — partial results saved to specs.json.")
            pool.shutdown(wait=False, cancel_futures=True)

    print(f"\nWrote {len(results)} spec(s) to {OUTPUT_FILE.name}. Shape distribution:")
    for shape, n in shapes.most_common():
        print(f"  {n:4d}  {shape}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
