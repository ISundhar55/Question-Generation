"""
variant_models.py
-----------------
Pydantic data models for reference-based item generation (variants & clones).
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class GenerateFromReferenceRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Mathematics, Science, ELA")
    grade: str = Field(..., description="e.g. Grade 1, Grade 6")
    reference_question: Dict[str, Any] = Field(
        ...,
        description="The seed reference question dictionary with text, type, options, answer, explanation, etc."
    )
    count: int = Field(1, ge=1, le=5, description="Number of new items to generate (1 to 5)")
    target_type: Optional[str] = Field(None, description="Optional target question type if format shift requested")
    target_difficulty: Optional[str] = Field(None, description="Target difficulty: 'easy' | 'medium' | 'hard'")
    variant_style: str = Field(
        "parallel",
        description="Style of variant: 'parallel' | 'easier' | 'harder' | 'format_shift' | 'custom'"
    )
    custom_instructions: Optional[str] = Field(None, description="Optional teacher refinement directives")
    include_visuals: Optional[bool] = Field(False, description="Whether to generate visual diagrams for the variants")
