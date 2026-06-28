"""Discover GlassesUSA sunglass *category* pages via the You.com Contents API.

We fetch the sunglasses hub pages (the ``/sunglasses`` landing and a few
sibling hubs that expose "shop by brand / shape / color" sunglass links),
then collect every single-segment category slug they link to. That set is the
site's own notion of "this page belongs under sunglasses" — including brand
pages like ``/ray-ban`` or ``/oakley-glasses`` whose slug doesn't say "sunglass".
"""
from __future__ import annotations

from typing import List, Set

from link_extract import category_slug, extract_links
from you_client import fetch_pages

# Sunglasses hub pages. Each surfaces a different slice of sunglass links
# (brands, shapes, colors, gendered listings), so their union gives broad
# coverage of non-obvious sunglass categories.
DEFAULT_SEEDS: List[str] = [
    "https://www.glassesusa.com/sunglasses",
    "https://www.glassesusa.com/sunglasses-collection",
    "https://www.glassesusa.com/mens-sunglasses",
    "https://www.glassesusa.com/womens-sunglasses",
    "https://www.glassesusa.com/ray-ban-sunglasses",
    "https://www.glassesusa.com/oakley-sunglasses",
]


def discover_sunglass_categories(
    seeds: List[str] = DEFAULT_SEEDS, verbose: bool = True
) -> Set[str]:
    """Return the set of category slugs linked from the sunglasses hub pages."""
    slugs: Set[str] = set()
    for page in fetch_pages(seeds):
        if not page.ok:
            if verbose:
                print(f"  [FAIL] {page.url} — no content returned")
            continue
        found = {
            slug
            for link in extract_links(page.markdown)
            if (slug := category_slug(link)) is not None
        }
        slugs |= found
        if verbose:
            print(f"  [ OK ] {page.url} — {len(found)} category links")
    return slugs
