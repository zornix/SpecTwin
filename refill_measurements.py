"""Backfill missing frame measurements in ``specs.json``.

Some scraped specs came back with no measurement table parsed (all four of
lens width / height, bridge, temple empty). This script:

  1. pulls those records out into ``specs_missing_measurements.json``,
  2. re-fetches just those URLs via the You.com Contents API (parallel, 10/batch),
  3. re-parses and writes any recovered measurements back into ``specs.json``.

Re-scraping helps when the earlier miss was a transient/empty crawl; a page that
genuinely has no measurement table will still come back empty (reported at the end).

Usage:
    python refill_measurements.py                # backfill all missing
    python refill_measurements.py --workers 8    # concurrency (default 6)
    python refill_measurements.py --dry-run      # only write the missing-subset file
"""
from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional

from parser import parse_sunglasses
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
SPECS_FILE = HERE / "specs.json"
LISTINGS_FILE = HERE / "listings.json"
MISSING_FILE = HERE / "specs_missing_measurements.json"

BATCH_SIZE = 10
DEFAULT_WORKERS = 6
_MEAS_FIELDS = ("lens_width", "lens_height", "bridge_width", "temple_length")


def _flag(argv: List[str], name: str) -> Optional[str]:
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else None


def _has_measurements(spec: dict) -> bool:
    m = spec.get("measurements") or {}
    return any(m.get(k) for k in _MEAS_FIELDS)


def _chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _atomic_write(path: Path, data) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    os.replace(tmp, path)


def _scrape_batch(batch: List[str], listings: Dict[str, dict]) -> Dict[str, dict]:
    """Re-fetch + parse one batch; return {url: measurements_dict} for hits."""
    out: Dict[str, dict] = {}
    for page in fetch_pages(batch):
        if not page.ok:
            continue
        spec = parse_sunglasses(page.url, page.markdown, page.title, listings.get(page.url))
        meas = spec.model_dump().get("measurements") or {}
        if any(meas.get(k) for k in _MEAS_FIELDS):
            out[page.url] = meas
    return out


def main(argv: List[str]) -> int:
    workers = int(_flag(argv, "--workers") or DEFAULT_WORKERS)
    dry_run = "--dry-run" in argv

    specs = json.loads(SPECS_FILE.read_text())
    listings = json.loads(LISTINGS_FILE.read_text()) if LISTINGS_FILE.exists() else {}

    missing = [s for s in specs if not _has_measurements(s)]
    _atomic_write(MISSING_FILE, missing)
    print(f"{len(missing)} of {len(specs)} specs have no measurements -> {MISSING_FILE.name}")

    if dry_run or not missing:
        return 0

    urls = [s["source_url"] for s in missing]
    by_url = {s["source_url"]: s for s in specs}
    batches = _chunk(urls, BATCH_SIZE)
    print(f"Re-scraping {len(urls)} URL(s) in {len(batches)} batch(es) across {workers} workers...")

    recovered = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_scrape_batch, b, listings) for b in batches]
        for fut in as_completed(futures):
            for url, meas in fut.result().items():
                spec = by_url.get(url)
                if spec is not None:
                    spec["measurements"] = meas
                    recovered += 1
            _atomic_write(SPECS_FILE, specs)
            print(f"  recovered {recovered}/{len(urls)} so far")

    still_missing = [s for s in specs if not _has_measurements(s)]
    _atomic_write(MISSING_FILE, still_missing)
    print(
        f"\nDone. Recovered measurements for {recovered} item(s); "
        f"{len(still_missing)} still missing (page likely has no measurement table)."
    )
    print(f"Remaining-missing list rewritten to {MISSING_FILE.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
