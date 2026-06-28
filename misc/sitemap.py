"""Read, filter, and re-render the GlassesUSA sitemap stored in ``urls.txt``.

The file is a standard ``<urlset>`` sitemap. We keep filtering non-destructive
and format-preserving: each ``<url>...</url>`` block is kept verbatim (with its
``lastmod`` / ``changefreq`` / ``priority``), only dropping the blocks whose
``<loc>`` fails the supplied predicate.
"""
from __future__ import annotations

import re
from typing import Callable, List, Tuple

_URL_BLOCK = re.compile(r"<url>.*?</url>", re.DOTALL)
_LOC = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.DOTALL)


def parse_blocks(xml: str) -> List[Tuple[str, str]]:
    """Return ``[(loc, raw_block), ...]`` for every ``<url>`` entry in the sitemap."""
    blocks: List[Tuple[str, str]] = []
    for match in _URL_BLOCK.finditer(xml):
        block = match.group(0)
        loc_match = _LOC.search(block)
        loc = loc_match.group(1).strip() if loc_match else ""
        blocks.append((loc, block))
    return blocks


def _split_envelope(xml: str) -> Tuple[str, str]:
    """Return (header, footer) surrounding the first/last ``<url>`` blocks."""
    first = xml.find("<url>")
    last = xml.rfind("</url>")
    if first == -1 or last == -1:
        return xml, ""
    header = xml[:first]
    footer = xml[last + len("</url>") :]
    return header, footer


def filter_sitemap(
    xml: str, keep: Callable[[str], bool]
) -> Tuple[str, List[str], List[str]]:
    """Filter the sitemap by ``keep(loc)``.

    Returns ``(rendered_xml, kept_locs, removed_locs)``. The rendered XML
    reuses the original header/footer so the file stays a valid sitemap.
    """
    blocks = parse_blocks(xml)
    kept = [(loc, block) for loc, block in blocks if keep(loc)]
    removed_locs = [loc for loc, _ in blocks if not keep(loc)]

    header, footer = _split_envelope(xml)
    body = "\n".join(block for _, block in kept)
    rendered = f"{header}{body}{footer}"
    return rendered, [loc for loc, _ in kept], removed_locs
