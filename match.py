"""Recommend cheaper look-alike sunglasses for a (usually pricier) target.

Combines two similarity signals over ``specs.json``:

  * spec similarity  — frame measurements + shape/rim/material/etc. (``features``)
  * visual similarity — CLIP embeddings of the product photos (``imagesim``)

into ``score = alpha * image + (1 - alpha) * spec``, then for a chosen target
returns the most similar items priced below it.

Usage:
    python match.py                                  # list the catalog (index, price, name)
    python match.py --target ray-ban-rb2132          # match by url/brand/name substring
    python match.py --target 0 --top 5               # match by catalog index
    python match.py --target ray-ban --alpha 0.6     # weight visual similarity higher
    python match.py --target ray-ban --spec-only     # skip CLIP (no image download)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List, Optional

import numpy as np

from features import spec_similarity_matrix

HERE = Path(__file__).resolve().parent
SPECS_FILE = HERE / "specs.json"


def load_specs() -> List[dict]:
    if not SPECS_FILE.exists():
        return []
    return json.loads(SPECS_FILE.read_text())


def _label(spec: dict) -> str:
    name = spec.get("product_name") or spec.get("source_url", "")
    price = spec.get("price")
    return f"{spec.get('brand') or '?'} {name} (${price})"


def find_target(specs: List[dict], target: str) -> Optional[int]:
    """Resolve a target to a catalog index by integer index or substring match."""
    if target.isdigit() and int(target) < len(specs):
        return int(target)
    needle = target.lower()
    for i, s in enumerate(specs):
        hay = f"{s.get('brand','')} {s.get('product_name','')} {s.get('source_url','')}".lower()
        if needle in hay:
            return i
    return None


def combined_similarity(specs: List[dict], alpha: float, spec_only: bool) -> np.ndarray:
    """Blend spec and (optionally) image similarity into one (n, n) matrix."""
    spec_sim = spec_similarity_matrix(specs)
    if spec_only or alpha <= 0:
        return spec_sim
    try:
        from imagesim import embed_specs, image_similarity_matrix

        img_sim = image_similarity_matrix(embed_specs(specs))
    except Exception as exc:  # model/network unavailable — degrade gracefully
        print(f"  (image similarity unavailable: {exc}; using spec-only)")
        return spec_sim
    return alpha * img_sim + (1.0 - alpha) * spec_sim


def recommend(
    specs: List[dict],
    target_idx: int,
    sim: np.ndarray,
    top_n: int = 5,
    cheaper_only: bool = True,
) -> List[tuple[int, float]]:
    """Return (index, score) of the top-N most similar items below the target price."""
    target_price = specs[target_idx].get("price")
    scores = sim[target_idx].copy()
    scores[target_idx] = -1.0  # never recommend the item itself
    order = np.argsort(scores)[::-1]

    out: List[tuple[int, float]] = []
    for j in order:
        if scores[j] < 0:
            break
        price = specs[j].get("price")
        if cheaper_only and target_price is not None and price is not None and price >= target_price:
            continue
        out.append((int(j), float(scores[j])))
        if len(out) >= top_n:
            break
    return out


def main(argv: List[str]) -> int:
    specs = load_specs()
    if not specs:
        print("No specs.json — run harvest_listings.py then scrape1.py first.")
        return 1

    def flag(name: str, default=None):
        return argv[argv.index(name) + 1] if name in argv else default

    target = flag("--target")
    if target is None:
        print(f"{len(specs)} sunglasses in catalog:\n")
        for i, s in enumerate(specs):
            print(f"  [{i:>3}] {_label(s)}  shape={s.get('shape')}")
        print("\nRe-run with --target <index|substring> to get cheaper look-alikes.")
        return 0

    idx = find_target(specs, target)
    if idx is None:
        print(f"No catalog item matches {target!r}.")
        return 1

    top_n = int(flag("--top", 5))
    alpha = float(flag("--alpha", 0.5))
    spec_only = "--spec-only" in argv

    print(f"Target: {_label(specs[idx])}  shape={specs[idx].get('shape')}\n")
    sim = combined_similarity(specs, alpha, spec_only)
    recs = recommend(specs, idx, sim, top_n=top_n)

    if not recs:
        print("No cheaper look-alikes found.")
        return 0

    print(f"Cheaper look-alikes (alpha={alpha}, {'spec-only' if spec_only else 'spec+image'}):\n")
    tprice = specs[idx].get("price")
    for j, score in recs:
        price = specs[j].get("price")
        save = f"-${tprice - price:.0f}" if (tprice and price) else ""
        print(f"  {score:.3f}  {_label(specs[j])}  {save}\n        {specs[j].get('source_url')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
