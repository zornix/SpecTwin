"""Parse You.com Contents Markdown of a *listing* page into product cards.

GlassesUSA detail pages do not expose a price in the Contents-API Markdown, but
the listing/grid pages do: each card is a product link followed shortly by a
``$NNN`` current price (and, on sale items, a higher struck-through original
price). This module turns a listing page's Markdown into ``ListingCard`` rows so
the harvester can capture price + thumbnail alongside each product URL.

Pure text -> rows, no network.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

from link_extract import product_url

# A markdown link ``[label](url)`` — label may itself contain ``![alt](img)``.
_LINK = re.compile(r"\[(?P<label>(?:[^\[\]]|\[[^\]]*\])*)\]\((?P<url>https?://[^)\s]+)\)")
# A price token like ``$94`` or ``$1,299.00``.
_PRICE = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)")
# A product image hosted on the optimax CDN catalog_product path.
_PRODUCT_IMG = re.compile(r"(https?://[^)\s]*catalog_product/[^)\s]+\.(?:jpg|jpeg|png|webp)[^)\s]*)")


@dataclass
class ListingCard:
    """One product as seen on a listing/grid page."""

    url: str
    price: Optional[float] = None
    original_price: Optional[float] = None
    image: Optional[str] = None


def _to_float(token: str) -> float:
    return float(token.replace(",", ""))


def parse_listing_cards(markdown: str) -> List[ListingCard]:
    """Extract one ``ListingCard`` per distinct product URL on the listing page.

    Each event (product link or price) is read in document order; a price is
    attributed to the most recently seen product link. The first price found for
    a product is its current price; a later, higher price is the original/MSRP.
    """
    # Collect product-link and price events with their positions, in order.
    events: List[tuple[int, str, object]] = []
    for m in _LINK.finditer(markdown):
        canon = product_url(m.group("url"))
        if canon:
            img = _PRODUCT_IMG.search(m.group("label"))
            events.append((m.start(), "product", (canon, img.group(1) if img else None)))
    for m in _PRICE.finditer(markdown):
        events.append((m.start(), "price", _to_float(m.group(1))))
    events.sort(key=lambda e: e[0])

    cards: dict[str, ListingCard] = {}
    current: Optional[str] = None
    for _, kind, payload in events:
        if kind == "product":
            url, img = payload  # type: ignore[misc]
            current = url
            card = cards.setdefault(url, ListingCard(url=url))
            if img and not card.image:
                card.image = img
        elif kind == "price" and current is not None:
            card = cards[current]
            price = payload  # type: ignore[assignment]
            if card.price is None:
                card.price = price  # first price = current
            elif price > card.price and card.original_price is None:
                card.original_price = price  # higher later price = original/MSRP

    # Preserve first-seen order.
    seen: set[str] = set()
    ordered: List[ListingCard] = []
    for _, kind, payload in events:
        if kind == "product":
            url = payload[0]  # type: ignore[index]
            if url not in seen:
                seen.add(url)
                ordered.append(cards[url])
    return ordered
