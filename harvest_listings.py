"""Entry point: harvest the authoritative set of sunglasses product URLs.

The ``/sunglasses`` listing is the site's own pre-filtered set of sunglasses,
but it renders behind anti-bot protection and paginates via ``?p=N``. We walk
the pages through the You.com Contents API (which bypasses the bot challenge),
pull every product-detail link out of each page's Markdown, and dedup until the
listing stops yielding new products. Progress is checkpointed every 10 pages to
``sunglasses_urls.json`` and ``listings.json``; a final write runs at the end.

Usage:
    python harvest_listings.py                  # walk /sunglasses to exhaustion
    python harvest_listings.py --max-pages 5    # cap pages (sampling)
    python harvest_listings.py --listing https://www.glassesusa.com/mens-sunglasses
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List

from listing_parse import parse_listing_cards
from you_client import fetch_pages

HERE = Path(__file__).resolve().parent
OUTPUT_FILE = HERE / "sunglasses_urls.json"
LISTINGS_FILE = HERE / "listings.json"

DEFAULT_LISTING = "https://www.glassesusa.com/sunglasses"
# Stop after this many consecutive *fully-rendered* pages add no new products
# (the listing has run dry), or once we reach the hard page cap as a backstop.
EMPTY_STREAK_LIMIT = 2
DEFAULT_MAX_PAGES = 200
# The Contents API occasionally returns a truncated render (a few KB, no grid).
# Markdown below this size with zero cards is treated as a failed fetch and
# retried rather than mistaken for the end of the listing.
MIN_RENDER_BYTES = 15000
PAGE_RETRIES = 3
LISTING_TIMEOUT = 45
SAVE_INTERVAL = 10  # checkpoint sunglasses_urls.json / listings.json every N pages


def _write_harvest(cards: dict[str, dict], *, verbose: bool = True) -> None:
    """Persist the current harvest progress to disk."""
    records = list(cards.values())
    urls = [r["url"] for r in records]
    OUTPUT_FILE.write_text(json.dumps({"urls": urls}, indent=2))
    LISTINGS_FILE.write_text(json.dumps({r["url"]: r for r in records}, indent=2))
    if verbose:
        priced = sum(1 for r in records if r["price"] is not None)
        print(f"  [saved] {len(urls)} URL(s) ({priced} priced)")


def _page_url(listing: str, page: int) -> str:
    sep = "&" if "?" in listing else "?"
    return listing if page == 1 else f"{listing}{sep}p={page}"


def _fetch_cards(url: str):
    """Fetch one listing page, retrying truncated/partial renders.

    Returns ``(cards, rendered)`` where ``rendered`` is False when every attempt
    came back too small to contain the grid (so the caller should not count it as
    a genuine end-of-listing).
    """
    for _ in range(PAGE_RETRIES):
        fetched = fetch_pages([url], crawl_timeout=LISTING_TIMEOUT)
        md = fetched[0].markdown if fetched and fetched[0].ok else ""
        cards = parse_listing_cards(md)
        if cards or len(md) >= MIN_RENDER_BYTES:
            return cards, True
    return [], False


def harvest(
    listing: str = DEFAULT_LISTING,
    max_pages: int = DEFAULT_MAX_PAGES,
    verbose: bool = True,
) -> List[dict]:
    """Walk ``listing`` page by page, returning deduped product card records.

    Each record is ``{url, price, original_price, image}`` captured from the
    listing grid (the only place a price is exposed).
    """
    cards: dict[str, dict] = {}
    empty_streak = 0

    for page in range(1, max_pages + 1):
        url = _page_url(listing, page)
        page_cards, rendered = _fetch_cards(url)

        if not rendered:
            if verbose:
                print(f"  page {page:>3}: render failed after {PAGE_RETRIES} tries — skipping")
            continue  # transient partial render; don't treat as end-of-listing

        fresh = 0
        for card in page_cards:
            if card.url not in cards:
                cards[card.url] = {
                    "url": card.url,
                    "price": card.price,
                    "original_price": card.original_price,
                    "image": card.image,
                }
                fresh += 1

        if verbose:
            print(f"  page {page:>3}: {fresh:>3} new (total {len(cards)})")

        if not fresh:
            empty_streak += 1
            if empty_streak >= EMPTY_STREAK_LIMIT:
                if verbose:
                    print(f"  no new products for {EMPTY_STREAK_LIMIT} pages — stopping.")
                break
        else:
            empty_streak = 0

        if page % SAVE_INTERVAL == 0:
            _write_harvest(cards, verbose=verbose)

    return list(cards.values())


def main(argv: List[str]) -> int:
    listing = DEFAULT_LISTING
    max_pages = DEFAULT_MAX_PAGES
    if "--listing" in argv:
        listing = argv[argv.index("--listing") + 1]
    if "--max-pages" in argv:
        max_pages = int(argv[argv.index("--max-pages") + 1])

    print(f"Harvesting product URLs from {listing} (max {max_pages} pages)...")
    records = harvest(listing, max_pages)
    _write_harvest({r["url"]: r for r in records}, verbose=False)
    priced = sum(1 for r in records if r["price"] is not None)
    print(f"\nWrote {len(records)} sunglasses URL(s) to {OUTPUT_FILE.name} "
          f"({priced} priced) and card data to {LISTINGS_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
