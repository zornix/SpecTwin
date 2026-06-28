"""Frontend-facing recommendation entry point.

Given a GlassesUSA product URL that is already in the catalog (specced, style
profiled, and image-embedded), return a structured JSON payload with the top-N
similar frames — each carrying the fields a UI needs to render a result card:
image, price, url, brand/name, and a normalized **similarity score**.

This is a thin, reusable wrapper over the existing matching stack
(``features`` / ``imagesim`` / ``descsim`` blended in ``match.py``). It does no
scraping or embedding at request time: a known URL resolves instantly from the
cached catalog, so this is safe to call from an API handler later.

Usage (library):
    from recommend_api import recommend_by_url
    payload = recommend_by_url("https://www.glassesusa.com/.../46-000638.html")

Usage (CLI, prints JSON to stdout):
    python recommend_api.py "https://www.glassesusa.com/.../46-000638.html"
    python recommend_api.py --top 3 --alpha 0.5 --text-weight 0.3 <url>
    python recommend_api.py --include-pricier <url>   # don't require cheaper
    python recommend_api.py --pretty <url>            # indent the JSON
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List, Optional

import numpy as np

from match import (
    combined_similarity,
    find_target,
    load_specs,
    recommend,
)


def _primary_image(spec: dict) -> Optional[str]:
    """Return the primary product image URL, if any."""
    images = spec.get("image_urls") or []
    return images[0] if images else None


def _frame_view(spec: dict) -> Dict[str, Any]:
    """Project a raw spec record down to the fields the frontend renders."""
    return {
        "url": spec.get("source_url"),
        "brand": spec.get("brand"),
        "name": spec.get("product_name"),
        "price": spec.get("price"),
        "image": _primary_image(spec),
        "shape": spec.get("shape"),
    }


def recommend_by_url(
    url: str,
    top_n: int = 3,
    *,
    alpha: float = 0.4,
    text_weight: float = 0.2,
    spec_only: bool = False,
    desc_only: bool = False,
    cheaper_only: bool = True,
    specs: Optional[List[dict]] = None,
) -> Dict[str, Any]:
    """Build the recommendation payload for a catalog URL.

    Parameters mirror ``match.py`` so weighting behaves identically:
    ``alpha`` is the image (CLIP) weight, ``text_weight`` the style-profile
    weight, and the remainder is spec weight. Set ``cheaper_only=False`` to rank
    by pure similarity regardless of price.

    Returns a JSON-serializable dict with ``ok``, ``target``, ``candidates``,
    and ``weights``. On a miss, ``ok`` is ``False`` with an ``error`` message
    (so a frontend can branch without exception handling).
    """
    if specs is None:
        specs = load_specs()
    if not specs:
        return {
            "ok": False,
            "error": "catalog_empty",
            "message": "specs.json is empty — run harvest_listings.py then scrape1.py.",
            "query_url": url,
            "candidates": [],
        }

    idx = find_target(specs, url)
    if idx is None:
        return {
            "ok": False,
            "error": "target_not_found",
            "message": f"No catalog item matches {url!r}.",
            "query_url": url,
            "candidates": [],
        }

    sim = combined_similarity(
        specs, alpha, text_weight, spec_only=spec_only, desc_only=desc_only
    )
    recs = recommend(specs, idx, sim, top_n=top_n, cheaper_only=cheaper_only)

    if spec_only:
        blend = {"mode": "spec-only"}
    elif desc_only:
        blend = {"mode": "description-only"}
    else:
        w_img = max(0.0, alpha)
        w_text = max(0.0, text_weight)
        w_spec = max(0.0, 1.0 - w_img - w_text)
        blend = {
            "mode": "blended",
            "image": round(w_img, 4),
            "description": round(w_text, 4),
            "spec": round(w_spec, 4),
        }

    target = specs[idx]
    target_price = target.get("price")

    candidates: List[Dict[str, Any]] = []
    for rank, (j, score) in enumerate(recs, start=1):
        cand = specs[j]
        price = cand.get("price")
        savings = (
            round(target_price - price, 2)
            if isinstance(target_price, (int, float)) and isinstance(price, (int, float))
            else None
        )
        view = _frame_view(cand)
        view.update(
            {
                "rank": rank,
                "similarity": round(float(score), 4),
                "savings": savings,
            }
        )
        candidates.append(view)

    return {
        "ok": True,
        "query_url": url,
        "weights": blend,
        "cheaper_only": cheaper_only,
        "target": _frame_view(target),
        "count": len(candidates),
        "candidates": candidates,
    }


def _parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Top-N similar sunglasses for a catalog URL, as JSON."
    )
    p.add_argument("url", help="GlassesUSA product URL already in the catalog")
    p.add_argument("--top", type=int, default=3, help="number of candidates (default 3)")
    p.add_argument("--alpha", type=float, default=0.4, help="image (CLIP) weight (default 0.4)")
    p.add_argument(
        "--text-weight", type=float, default=0.2, help="style-profile weight (default 0.2)"
    )
    p.add_argument("--spec-only", action="store_true", help="spec signal only (no CLIP)")
    p.add_argument("--desc-only", action="store_true", help="style-profile signal only")
    p.add_argument(
        "--include-pricier",
        action="store_true",
        help="rank by similarity regardless of price (default: cheaper only)",
    )
    p.add_argument("--pretty", action="store_true", help="indent the JSON output")
    return p.parse_args(argv)


def main(argv: List[str]) -> int:
    args = _parse_args(argv)
    payload = recommend_by_url(
        args.url,
        top_n=args.top,
        alpha=args.alpha,
        text_weight=args.text_weight,
        spec_only=args.spec_only,
        desc_only=args.desc_only,
        cheaper_only=not args.include_pricier,
    )
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2 if args.pretty else None)
    sys.stdout.write("\n")
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
