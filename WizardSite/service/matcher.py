"""Weighted spec-similarity matcher — mirrors src/lib/matcher.ts."""

from __future__ import annotations

from models import SpecComparison, Sunglasses, SunglassMatch
from mock_data import CATALOG

SPEC_WEIGHTS: dict[str, float] = {
    "shape": 0.26,
    "fit": 0.16,
    "lensWidth": 0.16,
    "polarized": 0.14,
    "frameMaterial": 0.12,
    "lensMaterial": 0.08,
    "uv": 0.05,
    "color": 0.03,
}

SHAPE_NEIGHBORS: dict[str, list[str]] = {
    "wayfarer": ["square", "rectangle"],
    "square": ["wayfarer", "rectangle"],
    "rectangle": ["square", "wayfarer"],
    "aviator": ["round", "oval"],
    "round": ["oval", "aviator"],
    "oval": ["round", "aviator"],
    "cat-eye": ["round", "oval"],
    "sport": ["square"],
}

FIT_ORDER = ["narrow", "medium", "wide"]


def _shape_sim(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if b in SHAPE_NEIGHBORS.get(a, []):
        return 0.6
    return 0.1


def _fit_sim(a: str, b: str) -> float:
    d = abs(FIT_ORDER.index(a) - FIT_ORDER.index(b))
    return 1.0 if d == 0 else 0.55 if d == 1 else 0.15


def _mm_sim(a: int, b: int, tolerance: int = 8) -> float:
    return max(0.0, 1.0 - abs(a - b) / tolerance)


def _clamp01(n: float) -> float:
    return max(0.0, min(1.0, n))


def _comparison(source: Sunglasses, c: Sunglasses) -> list[SpecComparison]:
    shape_sim = _shape_sim(source.shape, c.shape)
    fit_sim = _fit_sim(source.fit, c.fit)
    lens_sim = _mm_sim(source.lensWidthMm, c.lensWidthMm)
    return [
        SpecComparison(label="Frame shape", source=source.shape, match=c.shape,
                       weight=SPEC_WEIGHTS["shape"], aligned=shape_sim >= 0.6),
        SpecComparison(label="Fit", source=source.fit, match=c.fit,
                       weight=SPEC_WEIGHTS["fit"], aligned=fit_sim >= 0.55),
        SpecComparison(label="Lens width", source=f"{source.lensWidthMm}mm",
                       match=f"{c.lensWidthMm}mm", weight=SPEC_WEIGHTS["lensWidth"],
                       aligned=lens_sim >= 0.5),
        SpecComparison(label="Polarized", source="Yes" if source.polarized else "No",
                       match="Yes" if c.polarized else "No",
                       weight=SPEC_WEIGHTS["polarized"],
                       aligned=source.polarized == c.polarized),
        SpecComparison(label="Frame material", source=source.frameMaterial,
                       match=c.frameMaterial, weight=SPEC_WEIGHTS["frameMaterial"],
                       aligned=source.frameMaterial == c.frameMaterial),
        SpecComparison(label="Lens material", source=source.lensMaterial,
                       match=c.lensMaterial, weight=SPEC_WEIGHTS["lensMaterial"],
                       aligned=source.lensMaterial == c.lensMaterial),
        SpecComparison(label="UV protection", source=source.uvProtection,
                       match=c.uvProtection, weight=SPEC_WEIGHTS["uv"],
                       aligned=source.uvProtection == c.uvProtection),
    ]


def _score(source: Sunglasses, c: Sunglasses) -> int:
    sims = {
        "shape": _shape_sim(source.shape, c.shape),
        "fit": _fit_sim(source.fit, c.fit),
        "lensWidth": _mm_sim(source.lensWidthMm, c.lensWidthMm),
        "polarized": 1.0 if source.polarized == c.polarized else 0.0,
        "frameMaterial": 1.0 if source.frameMaterial == c.frameMaterial else 0.35,
        "lensMaterial": 1.0 if source.lensMaterial == c.lensMaterial else 0.4,
        "uv": 1.0 if source.uvProtection == c.uvProtection else 0.5,
        "color": 1.0
        if source.color.lower().split(" ")[0] == c.color.lower().split(" ")[0]
        else 0.3,
    }
    total = sum(_clamp01(sims[k]) * w for k, w in SPEC_WEIGHTS.items())
    return round(total * 100)


def find_matches(
    source: Sunglasses,
    cheaper_only: bool = True,
    min_score: int = 35,
    limit: int = 12,
) -> list[SunglassMatch]:
    out: list[SunglassMatch] = []
    for c in CATALOG:
        if c.id == source.id:
            continue
        if cheaper_only and c.price >= source.price:
            continue
        score = _score(source, c)
        if score < min_score:
            continue
        savings = max(0.0, source.price - c.price)
        savings_pct = round((savings / source.price) * 100) if source.price else 0
        out.append(
            SunglassMatch(
                **c.model_dump(),
                matchScore=score,
                savings=savings,
                savingsPct=savings_pct,
                comparison=_comparison(source, c),
            )
        )
    out.sort(key=lambda m: (m.matchScore, m.savings), reverse=True)
    return out[:limit]
