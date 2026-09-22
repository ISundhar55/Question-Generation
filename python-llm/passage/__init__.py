"""
passage module
--------------
Dedicated package for assessment reading passage / test stimulus generation and models.
"""
from .passage_models import GeneratePassageRequest, GeneratePassageResponse, PassageResult
from .passage_service import generate_passages

__all__ = [
    "GeneratePassageRequest",
    "GeneratePassageResponse",
    "PassageResult",
    "generate_passages",
]
