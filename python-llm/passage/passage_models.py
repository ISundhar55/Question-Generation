from pydantic import BaseModel, Field
from typing import Optional, List

class GeneratePassageRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Science, English Language Arts")
    grade: str = Field(..., description="e.g. Grade 8")
    standard: Optional[str] = Field(None, description="e.g. MS-LS1-6 or CCSS.ELA-LITERACY.RI.8.1")
    learning_objective: Optional[str] = Field(None, description="Target educational objective")
    assessment_target: Optional[str] = Field(None, description="Core concept or focus of the passage")
    assessment_boundaries: Optional[str] = Field(None, description="Boundaries or concepts that should not be exceeded")
    cognitive_complexity: Optional[str] = Field(None, description="Target cognitive complexity / DOK level")
    instructions: Optional[str] = Field(None, description="Teacher freeform prompt or topic instructions")
    custom_prompt: Optional[str] = Field(None, description="Additional custom instructions")
    genre: Optional[str] = Field("informational", description="'informational' or 'literary'")
    target_length: Optional[str] = Field("medium", description="'short' (150-250w), 'medium' (250-400w), 'long' (400-600w)")
    count: Optional[int] = Field(1, ge=1, le=5, description="Number of passages to generate")
    include_visuals: Optional[bool] = Field(False, description="Whether to generate an accompanying visual SVG diagram for the passage")

class PassageResult(BaseModel):
    title: str = Field(..., description="Title of the passage")
    text: str = Field(..., description="Full text content of the reading passage")
    visual: Optional[str] = Field(None, description="SVG markup for visual diagram or stimulus illustration")
    genre: str = Field("informational", description="'informational' or 'literary'")
    grade: str = Field(..., description="Target grade")
    contentArea: str = Field(..., description="Target content area")
    wordCount: int = Field(0, description="Word count of the passage")
    assessmentTarget: Optional[str] = None
    assessmentBoundaries: Optional[str] = None
    cognitiveComplexity: Optional[str] = None
    readingLevel: Optional[str] = None

class GeneratePassageResponse(BaseModel):
    passages: List[PassageResult]
    count: int
    prompt_sent: Optional[str] = None
