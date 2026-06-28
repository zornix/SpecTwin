"""Catalog-wide "designer dupe" finder over ``specs.json``.

Where ``match.py`` answers *"given one target, show cheaper look-alikes"*, this
module scans the **whole catalog** to surface the best opportunities:

    premium branded frame  ->  cheaper frame, same shape, near-identical measurements

A pair qualifies only when the alternative is:
  * the **same shape** (identical shape token-set, e.g. both ``Cat Eye``),
  * the **same rim_type** (full-rim/semi-rimless/rimless — on by default; this is
    a big visual difference, relax with ``--any-rim``),
  * **dimensionally close** — small Euclidean distance over the four frame
    measurements in millimetres (lens width/height, bridge, temple), and
  * **meaningfully cheaper** while still stylish (a non-trivial saving and not a
    bottom-of-the-barrel price).

Survivors are ranked by a blended fit score that further rewards matching
``size`` and ``color``.

Usage:
    python find_dupes.py                       # top designer->dupe opportunities
    python find_dupes.py --per-target 5        # list up to 5 look-alikes per frame
    python find_dupes.py --top 40              # show more branded frames
    python find_dupes.py --brand Ray-Ban       # only targets from this brand
    python find_dupes.py --max-mm 3            # tighter "same measurements" tolerance
    python find_dupes.py --loose-shape         # match on overlapping (not identical) shape
    python find_dupes.py --any-rim             # relax the same-rim_type requirement
    python find_dupes.py --report dupes.md     # also write a Markdown report
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import List, Optional

from features import NUMERIC_FIELDS, _mm, _tokens

HERE = Path(__file__).resolve().parent
SPECS_FILE = HERE / "specs.json"

# Recognised designer / luxury houses — the "branded" frames we want dupes for.
PREMIUM_BRANDS = {
    "ray-ban", "ray-ban meta", "oakley", "oakley meta", "persol", "versace",
    "burberry", "prada", "gucci", "dior", "fendi", "celine", "loewe", "chloe",
    "marni", "givenchy", "alexander mcqueen", "jacquemus", "off-white",
    "jimmy choo", "mont blanc", "michael kors", "coach", "ralph lauren",
    "polo ralph lauren", "emporio armani", "giorgio armani", "tom ford",
    "saint laurent", "balenciaga", "bottega veneta", "tiffany & co.", "swarovski",
    "carrera", "vogue", "guess", "calvin klein", "tory burch", "kate spade",
    "dolce & gabbana", "miu miu", "valentino", "costa del mar",
}


def load_specs() -> List[dict]:
    if not SPECS_FILE.exists():
        return []
    return json.loads(SPECS_FILE.read_text())


def measurements(spec: dict) -> Optional[List[float]]:
    """The four frame measurements in mm, or ``None`` if any are missing."""
    m = spec.get("measurements") or {}
    vals = [_mm(m.get(f)) for f in NUMERIC_FIELDS]
    return vals if all(v is not None for v in vals) else None


def mm_distance(a: List[float], b: List[float]) -> float:
    """Euclidean distance (mm) between two measurement vectors."""
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def is_premium(spec: dict, price_floor: float) -> bool:
    brand = (spec.get("brand") or "").strip().lower()
    return brand in PREMIUM_BRANDS or (spec.get("price") or 0) >= price_floor


def same_shape(a: dict, b: dict, loose: bool) -> bool:
    sa, sb = _tokens(a.get("shape")), _tokens(b.get("shape"))
    if not sa or not sb:
        return False
    return bool(sa & sb) if loose else sa == sb


# How much each non-shape categorical field counts toward the "style" score.
# Rim type changes the silhouette most (rimless vs full-rim), then color, then
# size (which is partly implied by the raw measurements already).
STYLE_WEIGHTS = {"rim_type": 0.5, "color": 0.3, "size": 0.2}

# Distance (mm) at which the measurement score decays to ~1/e; smaller = stricter.
MM_SCALE = 3.0
# Blend of the measurement score vs the categorical style score in [0, 1].
W_MEAS = 0.6


def _jaccard(a: dict, b: dict, field: str) -> Optional[float]:
    """Token-set overlap for one field, or ``None`` when neither item lists it."""
    sa, sb = _tokens(a.get(field)), _tokens(b.get(field))
    if not sa and not sb:
        return None
    union = sa | sb
    return (len(sa & sb) / len(union)) if union else None


def style_score(a: dict, b: dict) -> float:
    """Weighted size/rim_type/color overlap in [0, 1] (missing fields are neutral)."""
    total = score = 0.0
    for field, weight in STYLE_WEIGHTS.items():
        j = _jaccard(a, b, field)
        if j is None:
            continue
        total += weight
        score += weight * j
    return score / total if total else 0.0


def _meas_score(mm: float) -> float:
    return math.exp(-mm / MM_SCALE)


def _label(spec: dict) -> str:
    return f"{spec.get('brand') or '?'} {spec.get('product_name') or spec.get('source_url', '')}"


def find_pairs(
    specs: List[dict],
    max_mm: float,
    min_save: float,
    min_alt_price: float,
    price_floor: float,
    loose_shape: bool,
    brand: Optional[str],
    require_rim: bool = True,
    require_size: bool = False,
    require_color: bool = False,
    per_target: int = 1,
) -> List[dict]:
    """For each premium target, find its best cheaper dupe(s).

    Hard gates: same shape, cheaper by ``min_save``, measurements within
    ``max_mm`` (and optionally exact ``rim_type``/``size``/``color``). Among the
    survivors the alternatives are ranked by a blended fit score combining
    measurement closeness and size/rim_type/color overlap, and the top
    ``per_target`` are kept per target.

    Returns a list of ``{target_idx, alts: [cand, ...]}`` groups, ranked by each
    target's best alternative.
    """
    meas = [measurements(s) for s in specs]
    needle = brand.lower() if brand else None

    groups: List[dict] = []
    for i, target in enumerate(specs):
        if meas[i] is None or not is_premium(target, price_floor):
            continue
        if needle and needle not in (target.get("brand") or "").lower():
            continue
        tprice = target.get("price")
        if tprice is None:
            continue

        cands: List[dict] = []
        for j, alt in enumerate(specs):
            if i == j or meas[j] is None:
                continue
            aprice = alt.get("price")
            if aprice is None or aprice < min_alt_price:
                continue
            if tprice - aprice < min_save:  # must be meaningfully cheaper
                continue
            if not same_shape(target, alt, loose_shape):
                continue
            d = mm_distance(meas[i], meas[j])
            if d > max_mm:
                continue
            if require_rim and (_jaccard(target, alt, "rim_type") or 0.0) < 1.0:
                continue
            if require_size and (_jaccard(target, alt, "size") or 0.0) < 1.0:
                continue
            if require_color and (_jaccard(target, alt, "color") or 0.0) <= 0.0:
                continue

            st = style_score(target, alt)
            score = W_MEAS * _meas_score(d) + (1.0 - W_MEAS) * st
            cands.append({
                "alt_idx": j, "mm": d, "save": tprice - aprice,
                "score": score, "style": st,
                "rim": _jaccard(target, alt, "rim_type"),
                "size": _jaccard(target, alt, "size"),
                "color": _jaccard(target, alt, "color"),
            })

        if cands:
            cands.sort(key=lambda c: (-c["score"], -c["save"]))
            groups.append({"target_idx": i, "alts": cands[:max(1, per_target)]})

    # Rank targets by their best alternative's fit, then its saving.
    groups.sort(key=lambda g: (-g["alts"][0]["score"], -g["alts"][0]["save"]))
    return groups


def _fmt_meas(spec: dict) -> str:
    m = spec.get("measurements") or {}
    return " / ".join(str(_mm(m.get(f)) or "?") for f in NUMERIC_FIELDS)


def _tick(j: Optional[float]) -> str:
    """Render a field-overlap fraction as a compact match indicator."""
    if j is None:
        return "?"
    if j >= 1.0:
        return "\u2713"      # exact
    if j > 0.0:
        return "~"            # partial overlap
    return "\u2717"           # differs


def render(specs: List[dict], groups: List[dict], top: int) -> str:
    blocks = []
    for rank, g in enumerate(groups[:top], 1):
        t = specs[g["target_idx"]]
        lines = [
            f"{rank:>3}. {_label(t)}  ${t.get('price'):.0f}  [{t.get('shape')}]  "
            f"({t.get('rim_type')}/{t.get('size')}/{t.get('color')}, {_fmt_meas(t)} mm)"
        ]
        for p in g["alts"]:
            a = specs[p["alt_idx"]]
            lines.append(
                f"     -> {_label(a)}  ${a.get('price'):.0f}  (save ${p['save']:.0f}, "
                f"fit {p['score']:.2f}, \u0394{p['mm']:.1f}mm)  "
                f"rim {_tick(p['rim'])} size {_tick(p['size'])} color {_tick(p['color'])}\n"
                f"        {a.get('rim_type')}/{a.get('size')}/{a.get('color')}, "
                f"{_fmt_meas(a)} mm  |  {a.get('source_url')}"
            )
        blocks.append("\n".join(lines))
    return "\n".join(blocks)


def render_markdown(specs: List[dict], groups: List[dict], top: int) -> str:
    out = ["# Designer frames with cheaper, same-shape look-alikes", "",
           "Ranked by overall **fit** (a blend of measurement closeness and "
           "size/rim/color overlap), then by savings. Each branded frame may list "
           "several alternatives. The rim/size/color columns show whether those "
           "attributes match (\u2713 exact, ~ partial, \u2717 differ).",
           "",
           "| # | Branded frame | $ | Cheaper look-alike | $ | Save | Fit | \u0394mm | "
           "Shape | Rim | Size | Color |",
           "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for rank, g in enumerate(groups[:top], 1):
        t = specs[g["target_idx"]]
        for n, p in enumerate(g["alts"]):
            a = specs[p["alt_idx"]]
            label = f"{rank}" if n == 0 else ""
            tname = _label(t) if n == 0 else ""
            tprice = f"{t.get('price'):.0f}" if n == 0 else ""
            out.append(
                f"| {label} | {tname} | {tprice} | {_label(a)} | "
                f"{a.get('price'):.0f} | {p['save']:.0f} | {p['score']:.2f} | {p['mm']:.1f} | "
                f"{t.get('shape')} | {_tick(p['rim'])} | {_tick(p['size'])} | {_tick(p['color'])} |"
            )
    return "\n".join(out) + "\n"


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=25, help="how many branded frames to show")
    ap.add_argument("--per-target", type=int, default=3,
                    help="how many cheaper look-alikes to list per branded frame")
    ap.add_argument("--max-mm", type=float, default=4.0,
                    help="max Euclidean measurement distance (mm) to count as 'same size'")
    ap.add_argument("--min-save", type=float, default=40.0,
                    help="minimum price drop ($) for the alternative")
    ap.add_argument("--min-alt-price", type=float, default=50.0,
                    help="floor on the alternative's price (keep it 'stylish', not junk)")
    ap.add_argument("--price-floor", type=float, default=250.0,
                    help="treat any frame at/above this price as a premium target")
    ap.add_argument("--brand", help="only find dupes for targets from this brand")
    ap.add_argument("--loose-shape", action="store_true",
                    help="match on overlapping shape tokens instead of identical shape")
    ap.add_argument("--any-rim", action="store_true",
                    help="relax the default same-rim_type requirement")
    ap.add_argument("--require-size", action="store_true",
                    help="require the alternative to have the same size")
    ap.add_argument("--require-color", action="store_true",
                    help="require the alternative to share at least one color")
    ap.add_argument("--report", help="also write a Markdown report to this path")
    args = ap.parse_args(argv)

    specs = load_specs()
    if not specs:
        print("No specs.json — run harvest_listings.py then scrape1.py first.")
        return 1

    groups = find_pairs(
        specs,
        max_mm=args.max_mm,
        min_save=args.min_save,
        min_alt_price=args.min_alt_price,
        price_floor=args.price_floor,
        loose_shape=args.loose_shape,
        brand=args.brand,
        require_rim=not args.any_rim,
        require_size=args.require_size,
        require_color=args.require_color,
        per_target=args.per_target,
    )

    shape_mode = "overlapping" if args.loose_shape else "identical"
    rim_mode = "any rim" if args.any_rim else "same rim_type"
    total_alts = sum(len(g["alts"]) for g in groups)
    print(f"Scanned {len(specs)} frames -> {len(groups)} branded frames have a "
          f"cheaper, same-shape ({shape_mode}), {rim_mode} look-alike within "
          f"{args.max_mm:.0f}mm ({total_alts} alternatives, up to {args.per_target} "
          f"each; ranked by shape+measurements+size+rim_type+color fit).\n")
    if not groups:
        print("No qualifying pairs — try --loose-shape or a larger --max-mm.")
        return 0
    print(render(specs, groups, args.top))

    if args.report:
        Path(args.report).write_text(render_markdown(specs, groups, args.top))
        print(f"\nWrote report -> {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
