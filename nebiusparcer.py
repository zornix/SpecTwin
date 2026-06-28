"""Parse sunglasses product pages with Nebius Token Factory (site-agnostic).

Unlike ``parser.py`` (GlassesUSA Markdown heuristics), this module sends page
content to a Nebius-hosted LLM and returns a ``SunglassesSpecifications`` model.
Works across retailers as long as the page markdown contains the product details.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from openai import OpenAI

from config import NEBIUS_BASE_URL, NEBIUS_MODEL, get_nebius_api_key
from spec import SunglassesSpecifications

_SYSTEM_PROMPT = """\
You are a precise data extraction agent. Extract sunglasses product specifications \
from the provided web page markdown. The page may be from any eyewear retailer.

Rules:
- Extract only what is explicitly stated on the page; use null for missing fields.
- ALWAYS map data into the named top-level fields when it fits, e.g. frame
  material -> material, frame color -> color, frame shape -> shape, frame size
  -> size. Put data in extra_attributes ONLY if no named field matches.
- brand: the manufacturer (e.g. "Ray-Ban"); product_name: the model name/number.
- measurements: an object with lens_width, lens_height, bridge_width,
  temple_length (preserve units, e.g. "49 mm"). Never return it as a string.
- price / original_price: numeric USD values without a currency symbol.
- image_urls: direct product photo URLs only, primary image first.
- included_items: accessories or items bundled with the purchase (list, never null).
- Ignore navigation, reviews, recommendations, and site chrome."""

_MAX_MARKDOWN_CHARS = 120_000

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=NEBIUS_BASE_URL, api_key=get_nebius_api_key())
    return _client


def parse_sunglasses_markdown(
    url: str,
    markdown: str,
    title: Optional[str] = None,
) -> SunglassesSpecifications:
    """Extract ``SunglassesSpecifications`` from arbitrary retailer markdown."""
    schema = SunglassesSpecifications.model_json_schema()
    content = markdown[:_MAX_MARKDOWN_CHARS]
    user_text = f"Product URL: {url}\n"
    if title:
        user_text += f"Page title: {title}\n"
    user_text += f"\nWeb page content:\n{content}"

    completion = _get_client().chat.completions.create(
        model=NEBIUS_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        response_format={"type": "json_object"},
        extra_body={"guided_json": schema},
        temperature=0.1,
    )

    raw = completion.choices[0].message.content
    if not raw:
        raise ValueError("Nebius returned empty content")

    data = json.loads(raw)
    data["source_url"] = url
    if title and not data.get("title"):
        data["title"] = title
    return SunglassesSpecifications.model_validate(_sanitize(data))


def _sanitize(data: dict) -> dict:
    """Coerce common LLM type drift into the shapes the schema expects.

    Models sometimes emit booleans/numbers for ``extra_attributes`` values or
    ``null`` for list fields; normalize these so validation doesn't fail.
    """
    for list_field in ("image_urls", "included_items"):
        if data.get(list_field) is None:
            data[list_field] = []

    extra = data.get("extra_attributes")
    if extra is None:
        data["extra_attributes"] = {}
    elif isinstance(extra, dict):
        data["extra_attributes"] = {
            str(k): (v if isinstance(v, str) else json.dumps(v))
            for k, v in extra.items()
            if v is not None
        }

    measurements = data.get("measurements")
    if measurements is None:
        data["measurements"] = {}
    elif isinstance(measurements, str):
        data["measurements"] = _parse_measurement_string(measurements)

    _promote_extra_attributes(data)
    return data


# extra_attributes alias -> named field, for when the LLM mis-buckets data.
_FIELD_ALIASES = {
    "material": "material",
    "frame_material": "material",
    "color": "color",
    "frame_color": "color",
    "shape": "shape",
    "frame_shape": "shape",
    "size": "size",
    "frame_size": "size",
    "gender": "gender",
    "rim_type": "rim_type",
    "frame_type": "rim_type",
    "rim": "rim_type",
    "brand": "brand",
}
_MEASURE_ALIASES = {
    "lens_width": "lens_width",
    "lens_height": "lens_height",
    "bridge_width": "bridge_width",
    "temple_length": "temple_length",
}


def _promote_extra_attributes(data: dict) -> None:
    """Lift mis-bucketed extra_attributes into named fields when those are empty."""
    extra = data.get("extra_attributes") or {}
    measurements = data.get("measurements") or {}

    for key in list(extra):
        norm = key.strip().lower().replace(" ", "_")
        if norm in _MEASURE_ALIASES:
            field = _MEASURE_ALIASES[norm]
            if not measurements.get(field):
                measurements[field] = extra.pop(key)
        elif norm in _FIELD_ALIASES:
            field = _FIELD_ALIASES[norm]
            if not data.get(field):
                data[field] = extra.pop(key)

    data["measurements"] = measurements
    data["extra_attributes"] = extra


_MEASURE_LABELS = {
    "lens_width": ("lens width", "eye size", "lens"),
    "lens_height": ("lens height", "height", "b size"),
    "bridge_width": ("bridge width", "bridge", "dbl"),
    "temple_length": ("temple length", "temple", "arm"),
}


def _parse_measurement_string(blob: str) -> dict:
    """Extract lens/bridge/temple values from a free-text measurement blob."""
    result: dict[str, str] = {}
    for field, labels in _MEASURE_LABELS.items():
        for label in labels:
            m = re.search(
                rf"{re.escape(label)}\s*[:=]?\s*([\d.]+\s*mm[^,;\n]*)",
                blob,
                re.IGNORECASE,
            )
            if m:
                result[field] = m.group(1).strip()
                break
    return result
