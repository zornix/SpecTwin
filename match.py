"""Recommend cheaper look-alike sunglasses for a (usually pricier) target.

Combines up to three similarity signals over ``specs.json``:

  * spec similarity  — frame measurements + shape/rim/material/etc. (``features``)
  * visual similarity — CLIP embeddings of the product photos (``imagesim``)
  * description similarity — sentence-transformer embeddings of each frame's
    brand-agnostic *style profile* (``descsim`` + ``style_profile``)

into ``score = w_img*image + w_text*description + w_spec*spec`` (weights are
``alpha``, ``--text-weight``, and the remainder), then for a chosen target
returns the most similar items priced below it.

Usage:
    python match.py                                  # list the catalog (index, price, name)
    python match.py --target ray-ban-rb2132          # match by url/brand/name substring
    python match.py --target 0 --top 5               # match by catalog index
    python match.py --target ray-ban --alpha 0.6     # weight visual (CLIP) similarity higher
    python match.py --target ray-ban --text-weight 0.4  # add description-style similarity
    python match.py --target ray-ban --desc-only     # match purely on description style
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


def _image_similarity(specs: List[dict]) -> np.ndarray:
    from imagesim import embed_specs, image_similarity_matrix

    return image_similarity_matrix(embed_specs(specs))


def _description_similarity(specs: List[dict]) -> np.ndarray:
    from descsim import embed_specs as embed_desc, text_similarity_matrix

    return text_similarity_matrix(embed_desc(specs))


def combined_similarity(
    specs: List[dict],
    alpha: float,
    text_weight: float = 0.0,
    spec_only: bool = False,
    desc_only: bool = False,
) -> np.ndarray:
    """Blend spec, image, and description similarity into one (n, n) matrix.

    Weights: image=``alpha``, description=``text_weight``, spec=the remainder.
    Any optional signal that is unavailable (no model/network) is dropped and the
    remaining weights are renormalized, so matching always degrades gracefully.
    """
    if spec_only:
        return spec_similarity_matrix(specs)
    if desc_only:
        try:
            return _description_similarity(specs)
        except Exception as exc:  # model unavailable — degrade gracefully
            print(f"  (description similarity unavailable: {exc}; using spec-only)")
            return spec_similarity_matrix(specs)

    w_img = max(0.0, alpha)
    w_text = max(0.0, text_weight)
    w_spec = max(0.0, 1.0 - w_img - w_text)

    components: List[tuple[float, np.ndarray]] = [(w_spec, spec_similarity_matrix(specs))]
    if w_img > 0:
        try:
            components.append((w_img, _image_similarity(specs)))
        except Exception as exc:
            print(f"  (image similarity unavailable: {exc}; dropping image signal)")
    if w_text > 0:
        try:
            components.append((w_text, _description_similarity(specs)))
        except Exception as exc:
            print(f"  (description similarity unavailable: {exc}; dropping text signal)")

    total = sum(w for w, _ in components)
    if total <= 0:
        return spec_similarity_matrix(specs)
    return sum(w * m for w, m in components) / total


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
    text_weight = float(flag("--text-weight", 0.0))
    spec_only = "--spec-only" in argv
    desc_only = "--desc-only" in argv

    print(f"Target: {_label(specs[idx])}  shape={specs[idx].get('shape')}\n")
    sim = combined_similarity(specs, alpha, text_weight, spec_only, desc_only)
    recs = recommend(specs, idx, sim, top_n=top_n)

    if not recs:
        print("No cheaper look-alikes found.")
        return 0

    if spec_only:
        blend = "spec-only"
    elif desc_only:
        blend = "description-only"
    else:
        w_img = max(0.0, alpha)
        w_text = max(0.0, text_weight)
        w_spec = max(0.0, 1.0 - w_img - w_text)
        blend = f"image={w_img:g} description={w_text:g} spec={w_spec:g}"
    print(f"Cheaper look-alikes ({blend}):\n")
    tprice = specs[idx].get("price")
    for j, score in recs:
        price = specs[j].get("price")
        save = f"-${tprice - price:.0f}" if (tprice and price) else ""
        print(f"  {score:.3f}  {_label(specs[j])}  {save}\n        {specs[j].get('source_url')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
