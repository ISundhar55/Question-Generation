"""
variant module
--------------
Dedicated package for generating new assessment items based on existing reference items.
"""
from .variant_models import GenerateFromReferenceRequest
from .variant_service import generate_variants

__all__ = [
    "GenerateFromReferenceRequest",
    "generate_variants",
]
