"""Turn ``SunglassesSpecifications`` rows into comparable feature vectors.

Two complementary similarity signals are derived here, pure (no network):

  * **numeric** — frame measurements in millimetres (lens width/height, bridge,
    temple), z-scored across the catalog, and
  * **categorical** — token sets for shape, rim type, material, gender and size,
    compared by overlap.

Image similarity is handled separately in ``imagesim.py`` (it needs the network
and a CLIP model); this module is the cheap, always-available signal.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence, Set

import numpy as np

NUMERIC_FIELDS = ("lens_width", "lens_height", "bridge_width", "temple_length")


def _mm(value: Optional[str]) -> Optional[float]:
    """Pull the leading millimetre figure out of e.g. ``'56 mm / 2.2\"'``."""
    if not value:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", value)
    return float(match.group(1)) if match else None


def _tokens(value: Optional[str]) -> Set[str]:
    """Split a comma/slash-separated spec value into lowercase tokens."""
    if not value:
        return set()
    return {t.strip().lower() for t in re.split(r"[,/]", value) if t.strip()}


def numeric_matrix(specs: Sequence[dict]) -> np.ndarray:
    """Return an (n, 4) z-scored measurement matrix; missing values imputed by mean."""
    raw = np.array(
        [[_mm(s.get("measurements", {}).get(f)) for f in NUMERIC_FIELDS] for s in specs],
        dtype=object,
    )
    out = np.full(raw.shape, np.nan, dtype=float)
    for i in range(raw.shape[0]):
        for j in range(raw.shape[1]):
            if raw[i, j] is not None:
                out[i, j] = raw[i, j]
    col_mean = np.nanmean(out, axis=0)
    col_mean = np.where(np.isnan(col_mean), 0.0, col_mean)
    inds = np.where(np.isnan(out))
    out[inds] = np.take(col_mean, inds[1])
    std = out.std(axis=0)
    std[std == 0] = 1.0
    return (out - out.mean(axis=0)) / std


def categorical_sets(specs: Sequence[dict]) -> List[Dict[str, Set[str]]]:
    """Per-item token sets for the categorical fields used in matching."""
    fields = ("shape", "rim_type", "material", "gender", "size", "color")
    return [{f: _tokens(s.get(f)) for f in fields} for s in specs]


def categorical_similarity(a: Dict[str, Set[str]], b: Dict[str, Set[str]]) -> float:
    """Weighted overlap of categorical token sets, in [0, 1].

    Shape dominates (it defines the silhouette); rim type and material matter for
    look; gender/size/color are lighter tie-breakers.
    """
    weights = {"shape": 0.45, "rim_type": 0.2, "material": 0.15,
               "gender": 0.08, "size": 0.07, "color": 0.05}
    score = 0.0
    total = 0.0
    for field, weight in weights.items():
        sa, sb = a.get(field, set()), b.get(field, set())
        total += weight
        if not sa and not sb:
            continue  # neither known — neutral, don't reward or penalize
        union = sa | sb
        if union:
            score += weight * (len(sa & sb) / len(union))
    return score / total if total else 0.0


def numeric_similarity(matrix: np.ndarray) -> np.ndarray:
    """(n, n) similarity in [0, 1] from z-scored measurements (gaussian on distance)."""
    diff = matrix[:, None, :] - matrix[None, :, :]
    dist = np.sqrt((diff ** 2).sum(axis=2))
    return np.exp(-dist / 2.0)


def spec_similarity_matrix(specs: Sequence[dict], w_numeric: float = 0.5) -> np.ndarray:
    """Combined numeric+categorical spec similarity matrix in [0, 1]."""
    num_sim = numeric_similarity(numeric_matrix(specs))
    cats = categorical_sets(specs)
    n = len(specs)
    cat_sim = np.zeros((n, n))
    for i in range(n):
        for j in range(i, n):
            s = categorical_similarity(cats[i], cats[j])
            cat_sim[i, j] = cat_sim[j, i] = s
    return w_numeric * num_sim + (1.0 - w_numeric) * cat_sim
