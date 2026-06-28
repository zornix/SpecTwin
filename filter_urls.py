"""Entry point: prune ``urls.txt`` down to sunglass-only category URLs.

Flow:
  1. Scrape the GlassesUSA sunglasses hub pages via the You.com Contents API
     and collect the category slugs they link to (``sunglasses_crawl``).
  2. Walk every ``<loc>`` in ``urls.txt`` and keep it when the slug is either
     scraped as a sunglass category *or* literally contains "sunglass".
  3. Rewrite ``urls.txt`` with only the kept blocks and dump the dropped URLs
     to ``removed_urls.txt`` for review.

Usage:
    python filter_urls.py            # rewrite urls.txt in place
    python filter_urls.py --dry-run  # report only, write nothing
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import List

from link_extract import category_slug, is_sunglass_slug
from sitemap import filter_sitemap
from sunglasses_crawl import discover_sunglass_categories

HERE = Path(__file__).resolve().parent
URLS_FILE = HERE / "urls.txt"
REMOVED_FILE = HERE / "removed_urls.txt"


def main(argv: List[str]) -> int:
    dry_run = "--dry-run" in argv

    if not URLS_FILE.exists():
        print(f"{URLS_FILE.name} not found.")
        return 1
    xml = URLS_FILE.read_text()
    if not xml.strip():
        print(
            f"{URLS_FILE.name} is empty on disk — save the file in your editor "
            "(Ctrl+S) so the sitemap is written, then re-run."
        )
        return 1

    print("Scraping sunglass listings via You.com Contents API...")
    sun_categories = discover_sunglass_categories()
    print(f"Found {len(sun_categories)} sunglass category slugs.\n")

    def keep(loc: str) -> bool:
        slug = category_slug(loc)
        if slug is None:
            return True  # non-category entries (none expected) are left untouched
        return slug in sun_categories or is_sunglass_slug(slug)

    rendered, kept, removed = filter_sitemap(xml, keep)
    print(f"Keeping {len(kept)} sunglass URLs; removing {len(removed)} non-sunglass URLs.")

    if dry_run:
        print("\n-- would remove --")
        for loc in removed:
            print(f"  {loc}")
        return 0

    URLS_FILE.write_text(rendered)
    REMOVED_FILE.write_text("\n".join(removed) + "\n")
    print(f"\nUpdated {URLS_FILE.name} and wrote {len(removed)} dropped URLs to {REMOVED_FILE.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
