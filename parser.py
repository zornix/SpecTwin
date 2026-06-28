"""Parse You.com Contents Markdown into SunglassesSpecifications.

The GlassesUSA-style pages expose two Markdown tables we care about:

  * a "Frame Measurements" table (lens width / height, bridge, temple), and
  * a key/value spec table (size, gender, material, type, shape, color, ...).

Plus a breadcrumb (brand/model), a description paragraph, and an
"Including:" bullet list. This module is pure text -> model, no network.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

from spec import FrameMeasurements, SunglassesSpecifications

_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")


def _clean(cell: str) -> str:
    """Strip markdown links/formatting and surrounding whitespace from a cell."""
    text = _MD_LINK.sub(r"\1", cell)
    text = text.replace("**", "").replace("*", "")
    return text.strip()


def _normalize_key(key: str) -> str:
    return _clean(key).rstrip(":").strip().lower()


def _split_row(line: str) -> List[str]:
    """Split a markdown table row into trimmed cells."""
    cells = line.strip().strip("|").split("|")
    return [_clean(c) for c in cells]


def _is_separator(line: str) -> bool:
    return bool(re.fullmatch(r"\|?[\s:|-]+\|?", line.strip())) and "-" in line


def _extract_tables(markdown: str) -> List[List[List[str]]]:
    """Return all markdown tables as lists of rows (each row a list of cells)."""
    tables: List[List[List[str]]] = []
    current: List[List[str]] = []
    for line in markdown.splitlines():
        if line.strip().startswith("|"):
            if _is_separator(line):
                continue
            current.append(_split_row(line))
        else:
            if current:
                tables.append(current)
                current = []
    if current:
        tables.append(current)
    return tables


# Measurement header label -> model field
_MEASURE_FIELDS = {
    "lens width": "lens_width",
    "lens height": "lens_height",
    "bridge width": "bridge_width",
    "temple length": "temple_length",
}

# Spec key -> model field
_SPEC_FIELDS = {
    "size": "size",
    "gender": "gender",
    "material": "material",
    "type": "rim_type",
    "shape": "shape",
    "color": "color",
}


def _parse_measurements(tables: List[List[List[str]]]) -> FrameMeasurements:
    measures = FrameMeasurements()
    for table in tables:
        if len(table) < 2:
            continue
        header = [_normalize_key(c) for c in table[0]]
        if not any(h in _MEASURE_FIELDS for h in header):
            continue
        values = table[1]
        for label, value in zip(header, values):
            field = _MEASURE_FIELDS.get(label)
            if field and value:
                setattr(measures, field, value)
        break
    return measures


def _parse_kv_specs(tables: List[List[List[str]]]) -> Dict[str, str]:
    """Flatten key/value spec tables where columns alternate key, value, key, value."""
    specs: Dict[str, str] = {}
    for table in tables:
        header = [_normalize_key(c) for c in (table[0] if table else [])]
        if any(h in _MEASURE_FIELDS for h in header):
            continue  # skip the measurements table
        for row in table:
            for i in range(0, len(row) - 1, 2):
                key = _normalize_key(row[i])
                value = row[i + 1].strip()
                if key and value:
                    specs[key] = value
    return specs


def _parse_breadcrumb(markdown: str) -> tuple[Optional[str], Optional[str]]:
    """Return (brand, product_name) from the leading breadcrumb line if present."""
    for line in markdown.splitlines():
        line = line.strip()
        if line.lower().startswith("[home]"):
            labels = _MD_LINK.findall(line)
            brand = labels[-1] if len(labels) >= 2 else None
            # trailing plain text after the last link is the model name
            tail = _MD_LINK.sub("", line).strip()
            product = tail or (brand)
            return brand, (product or None)
    return None, None


_NON_PROSE_HINTS = (
    "find your",
    "need help",
    "all of our",
    "keep your",
    "handcrafted from the finest",
)


def _parse_description(markdown: str) -> Optional[str]:
    """Pick the longest genuine prose paragraph (the marketing copy).

    Skips headings, tables, list items, image lines, and known boilerplate
    snippets so we land on the real product description.
    """
    best: Optional[str] = None
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line or line.startswith(("#", "|", "-", "!", ">")):
            continue
        text = _clean(line)
        if len(text) < 60:
            continue
        if any(h in text.lower() for h in _NON_PROSE_HINTS):
            continue
        if best is None or len(text) > len(best):
            best = text
    return best


def _parse_included(markdown: str) -> List[str]:
    items: List[str] = []
    capture = False
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("including"):
            capture = True
            continue
        if capture:
            if stripped.startswith("-"):
                items.append(_clean(stripped[1:]))
            elif stripped == "":
                continue
            else:
                break
    return items


def parse_sunglasses(url: str, markdown: str, title: Optional[str] = None) -> SunglassesSpecifications:
    """Parse a single page's markdown into a SunglassesSpecifications model."""
    tables = _extract_tables(markdown)
    measurements = _parse_measurements(tables)
    kv = _parse_kv_specs(tables)
    brand, product_name = _parse_breadcrumb(markdown)

    mapped_fields = {}
    extra: Dict[str, str] = {}
    for key, value in kv.items():
        field = _SPEC_FIELDS.get(key)
        if field:
            mapped_fields[field] = value
        else:
            extra[key] = value

    return SunglassesSpecifications(
        source_url=url,
        title=title,
        product_name=product_name,
        brand=brand,
        description=_parse_description(markdown),
        measurements=measurements,
        included_items=_parse_included(markdown),
        extra_attributes=extra,
        **mapped_fields,
    )
