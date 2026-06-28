"""URL helpers shared by the sunglasses crawler and the sitemap filter.

Pure functions, no network:
  * pull links out of Contents-API Markdown,
  * normalize URLs for comparison, and
  * recognize GlassesUSA *category* pages (single-segment slugs) vs. product
    pages, image assets, and blog/utility URLs.
"""
from __future__ import annotations

import re
from typing import Optional, Set
from urllib.parse import urlsplit

SITE = "glassesusa.com"
SUN_TOKEN = "sunglass"

_MD_LINK = re.compile(r"\]\((https?://[^)\s]+)\)")


def extract_links(markdown: str) -> Set[str]:
    """Return the set of absolute http(s) URLs referenced in a Markdown blob."""
    return {m.group(1) for m in _MD_LINK.finditer(markdown or "")}


def category_slug(url: str) -> Optional[str]:
    """Return the category slug for a GlassesUSA category URL, else None.

    Category pages are single-segment, extension-less paths such as
    ``/oversized-sunglasses``. Product pages (multi-segment, ``.html``),
    image assets (``/ms/media/...``, ``optimaxweb``), and blog/utility URLs
    all return None so they never count as categories.
    """
    parts = urlsplit(url)
    if not parts.netloc.endswith(SITE):
        return None
    path = parts.path.strip("/")
    if not path or "/" in path or "." in path:
        return None
    return path.lower()


def is_sunglass_slug(slug: str) -> bool:
    """True if the category slug itself names sunglasses (e.g. 'mirrored-sunglasses')."""
    return SUN_TOKEN in slug


# Product detail pages end in a SKU-style final segment, e.g.
# ``/gold-medium/gucci-gg1876s-gold/46-008850.html`` or
# ``/black-medium/revel-slater/32-p6543.html``.
_SKU_TAIL = re.compile(r"^\d+-[a-z0-9]+\.html$", re.IGNORECASE)


def product_url(url: str) -> Optional[str]:
    """Return the canonical product-detail URL (no query/fragment), else None.

    Recognizes GlassesUSA product pages by their multi-segment path ending in a
    SKU-style ``NN-XXXXXX.html`` segment. Category pages, image assets, and
    blog/utility URLs all return None.
    """
    parts = urlsplit(url)
    if not parts.netloc.endswith(SITE):
        return None
    path = parts.path.strip("/")
    segments = path.split("/")
    if len(segments) < 2 or not _SKU_TAIL.match(segments[-1]):
        return None
    return f"{parts.scheme}://{parts.netloc}/{path}"
