"""Pydantic models describing scraped sunglasses specifications."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class FrameMeasurements(BaseModel):
    """Physical millimeter measurements of the frame."""

    lens_width: Optional[str] = Field(None, description="Lens width, e.g. '56 mm / 2.2\"'")
    lens_height: Optional[str] = Field(None, description="Lens height")
    bridge_width: Optional[str] = Field(None, description="Bridge width")
    temple_length: Optional[str] = Field(None, description="Temple (arm) length")


class SunglassesSpecifications(BaseModel):
    """Structured specifications for a single pair of sunglasses."""

    source_url: str = Field(description="URL the data was scraped from")
    title: Optional[str] = Field(None, description="Page / product title")
    product_name: Optional[str] = Field(None, description="Product model name, e.g. 'Revel Slater'")
    brand: Optional[str] = Field(None, description="Brand / manufacturer")
    description: Optional[str] = Field(None, description="Marketing description of the frame")

    measurements: FrameMeasurements = Field(default_factory=FrameMeasurements)

    size: Optional[str] = Field(None, description="Size category, e.g. 'Wide'")
    gender: Optional[str] = Field(None, description="Target gender")
    material: Optional[str] = Field(None, description="Frame material")
    rim_type: Optional[str] = Field(None, description="Rim type, e.g. 'Full-Rim'")
    shape: Optional[str] = Field(None, description="Frame shape, e.g. 'Square'")
    color: Optional[str] = Field(None, description="Frame color")

    price: Optional[float] = Field(None, description="Current listing price in USD")
    original_price: Optional[float] = Field(
        None, description="Original / MSRP price in USD when on sale"
    )
    image_urls: List[str] = Field(
        default_factory=list, description="Product image URLs (primary first)"
    )

    extra_attributes: dict[str, str] = Field(
        default_factory=dict,
        description="Any additional key/value spec rows not mapped to a named field",
    )
    included_items: List[str] = Field(
        default_factory=list, description="Items included with the purchase"
    )
