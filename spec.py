from pydantic import BaseModel, Field
from typing import Optional, List

class ProductSpecifications(BaseModel):
    manufacturer: str = Field(description="The manufacturer of the product")
    dimensions: Optional[str] = Field(None, description="Physical dimensions or size specifications")
    weight: Optional[str] = Field(None, description="Weight of the product with units")
    key_features: List[str] = Field(default=[], description="List of core technical specifications or features mentioned")

