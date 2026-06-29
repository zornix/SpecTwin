"""Map raw GlassesUSA catalog records (``specs.json``) to the frontend contract.

The recommendation engine in the repo root speaks the scraper's snake_case schema
(``product_name``, ``source_url``, ``measurements``…). The Next.js app expects the
camelCase :class:`models.Sunglasses` / :class:`models.SunglassMatch` shape. This
module is the single, pure translation layer between the two — no I/O, no engine
imports — so the mapping rules live in exactly one place and are easy to test.
"""

from __future__ import annotations

import re
from typing import Optional, Sequence
from urllib.parse import urlparse

from models import Fit, FrameMaterial, FrameShape, LensMaterial, Sunglasses, SunglassMatch

# --- enum vocabularies (mirror models.py / types.ts) -------------------------

_SHAPES: set[str] = {
    "wayfarer", "aviator", "round", "rectangle", "cat-eye", "square", "sport", "oval",
}

# Raw catalog shape tokens -> our frame-shape enum. The catalog often lists a
# primary shape first ("Square, Wrap"), so we map tokens left-to-right and take
# the first hit, falling back to "square" (the catalog's most common silhouette).
_SHAPE_TOKEN: dict[str, FrameShape] = {
    "square": "square",
    "rectangle": "rectangle",
    "rectangular": "rectangle",
    "round": "round",
    "oval": "oval",
    "aviator": "aviator",
    "pilot": "aviator",
    "cat eye": "cat-eye",
    "cat-eye": "cat-eye",
    "wayframe": "wayfarer",
    "wayfarer": "wayfarer",
    "wrap": "sport",
    "sport": "sport",
    "shield": "sport",
    "browline": "rectangle",
    "geometric": "square",
    "oversized": "square",
}

# Raw material token -> coarse material category. Multiple distinct categories on
# one frame ("Acetate, Plastic") collapse to "mixed".
_MATERIAL_TOKEN: dict[str, FrameMaterial] = {
    "acetate": "acetate",
    "eco-conscious": "acetate",
    "plastic": "injected",
    "injected": "injected",
    "tr90": "tr90",
    "tr-90": "tr90",
    "ultem": "tr90",
    "nylon": "tr90",
    "metal": "metal",
    "stainless steel": "metal",
    "aluminum": "metal",
    "titanium": "titanium",
    "wood": "mixed",
}

_FIT_TOKEN: dict[str, Fit] = {
    "narrow": "narrow",
    "small": "narrow",
    "average": "medium",
    "medium": "medium",
    "wide": "wide",
    "extra wide": "wide",
    "extra large": "wide",
    "large": "wide",
    "oversized": "wide",
}

_DEFAULT_LENS_MATERIAL: LensMaterial = "polycarbonate"
_DEFAULT_UV = "UV400"


def _tokens(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [t.strip().lower() for t in re.split(r"[,/]", value) if t.strip()]


def _map_shape(raw: Optional[str]) -> FrameShape:
    for tok in _tokens(raw):
        if tok in _SHAPE_TOKEN:
            return _SHAPE_TOKEN[tok]
    return "square"


def _map_frame_material(raw: Optional[str]) -> FrameMaterial:
    cats = {_MATERIAL_TOKEN[t] for t in _tokens(raw) if t in _MATERIAL_TOKEN}
    if not cats:
        return "acetate"
    if len(cats) == 1:
        return next(iter(cats))
    return "mixed"


def _map_fit(raw: Optional[str]) -> Fit:
    for tok in _tokens(raw):
        if tok in _FIT_TOKEN:
            return _FIT_TOKEN[tok]
    return "medium"


def _mm(value: Optional[str], default: int) -> int:
    """Pull the leading millimetre integer out of e.g. ``'56 mm / 2.2"'``."""
    if not value:
        return default
    m = re.search(r"(\d+(?:\.\d+)?)", value)
    return round(float(m.group(1))) if m else default


def _is_polarized(spec: dict) -> bool:
    extra = {str(k).lower(): str(v).lower() for k, v in (spec.get("extra_attributes") or {}).items()}
    for k, v in extra.items():
        if "polar" in k or "polar" in v:
            return True
    haystack = f"{spec.get('color', '')} {spec.get('description', '')}".lower()
    return "polariz" in haystack


def _retailer(url: Optional[str]) -> str:
    host = urlparse(url or "").netloc.replace("www.", "")
    if "glassesusa" in host:
        return "GlassesUSA"
    return host or "GlassesUSA"


def _product_id(url: Optional[str], fallback: str) -> str:
    """Stable id from the URL's SKU slug (e.g. ``…/46-008316.html`` -> ``46-008316``)."""
    if url:
        last = urlparse(url).path.rstrip("/").split("/")[-1]
        last = re.sub(r"\.html?$", "", last, flags=re.I).strip()
        if last:
            return last
    slug = re.sub(r"[^a-z0-9]+", "-", fallback.lower()).strip("-")
    return slug or "frame"


def _primary_image(spec: dict) -> str:
    """Best product photo for a card: prefer a square crop, else the first image."""
    images = spec.get("image_urls") or []
    if not images:
        return ""
    for url in images:
        if "h=426" in url or "h=300" in url:
            return url
    return images[0]


def spec_to_sunglasses(spec: dict) -> Sunglasses:
    """Project a raw catalog record onto the frontend's :class:`Sunglasses`."""
    name = spec.get("product_name") or "Sunglasses"
    measurements = spec.get("measurements") or {}
    return Sunglasses(
        id=_product_id(spec.get("source_url"), name),
        brand=spec.get("brand") or "Unknown",
        model=name,
        retailer=_retailer(spec.get("source_url")),
        productUrl=spec.get("source_url") or "",
        imageUrl=_primary_image(spec),
        price=float(spec.get("price") or 0.0),
        currency="USD",
        shape=_map_shape(spec.get("shape")),
        frameMaterial=_map_frame_material(spec.get("material")),
        lensMaterial=_DEFAULT_LENS_MATERIAL,
        lensWidthMm=_mm(measurements.get("lens_width"), 52),
        bridgeMm=_mm(measurements.get("bridge_width"), 18),
        templeMm=_mm(measurements.get("temple_length"), 145),
        polarized=_is_polarized(spec),
        uvProtection=_DEFAULT_UV,
        color=spec.get("color") or "",
        fit=_map_fit(spec.get("size")),
        blurb=spec.get("description") or None,
    )


def spec_to_match(source: Sunglasses, spec: dict, similarity: float) -> SunglassMatch:
    """Build a :class:`SunglassMatch` from a candidate spec + its similarity score.

    ``similarity`` is the engine's blended score in [0, 1]; we surface it as an
    integer 0–100 ``matchScore`` and derive savings against the source price.
    ``comparison`` is intentionally empty (the /compare page is out of scope).
    """
    cand = spec_to_sunglasses(spec)
    match_score = max(0, min(100, round(similarity * 100)))
    savings = max(0.0, round(source.price - cand.price, 2))
    savings_pct = round((savings / source.price) * 100) if source.price else 0
    return SunglassMatch(
        **cand.model_dump(),
        matchScore=match_score,
        savings=savings,
        savingsPct=max(0, min(100, savings_pct)),
        comparison=[],
    )


def specs_to_matches(
    source: Sunglasses, scored: Sequence[tuple[dict, float]]
) -> list[SunglassMatch]:
    return [spec_to_match(source, spec, score) for spec, score in scored]
