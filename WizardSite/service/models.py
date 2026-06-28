"""Pydantic models mirroring src/lib/types.ts."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

FrameShape = Literal[
    "wayfarer",
    "aviator",
    "round",
    "rectangle",
    "cat-eye",
    "square",
    "sport",
    "oval",
]
FrameMaterial = Literal["acetate", "metal", "titanium", "injected", "tr90", "mixed"]
LensMaterial = Literal["polycarbonate", "glass", "nylon", "cr39"]
Fit = Literal["narrow", "medium", "wide"]


class Sunglasses(BaseModel):
    id: str
    brand: str
    model: str
    retailer: str
    productUrl: str
    imageUrl: str = ""
    price: float
    currency: str = "USD"
    shape: FrameShape
    frameMaterial: FrameMaterial
    lensMaterial: LensMaterial
    lensWidthMm: int
    bridgeMm: int
    templeMm: int
    polarized: bool
    uvProtection: str
    color: str
    fit: Fit
    blurb: Optional[str] = None


class SpecComparison(BaseModel):
    label: str
    source: str
    match: str
    weight: float
    aligned: bool


class SunglassMatch(Sunglasses):
    matchScore: int
    savings: float
    savingsPct: int
    comparison: List[SpecComparison]


class MatchRequest(BaseModel):
    url: str = Field(..., description="A sunglasses product URL")


class MatchResponse(BaseModel):
    source: Sunglasses
    matches: List[SunglassMatch]
    engine: Literal["local-ts", "fastapi"] = "fastapi"
