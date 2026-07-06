from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Mathematics")
    grade: str = Field(..., description="e.g. Grade 6")


class IngestResponse(BaseModel):
    doc_id: str
    content_area: str
    grade: str
    filename: str
    file_hash: str
    chunks_indexed: int
    message: str


# ---------------------------------------------------------------------------
# Syllabus listing
# ---------------------------------------------------------------------------

class SyllabusInfo(BaseModel):
    doc_id: str
    content_area: str
    grade: str
    filename: str
    chunk_count: int


class SyllabiListResponse(BaseModel):
    syllabi: list[SyllabusInfo]


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Mathematics")
    grade: str = Field(..., description="e.g. Grade 6")
    chapter: Optional[str] = Field(None, description="Optional chapter filter, e.g. Fractions")
    question_type: str = Field(
        ...,
        description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES"
    )
    difficulty: str = Field(..., description="easy | medium | hard")
    count: int = Field(..., ge=1, le=20, description="Number of questions (1-20)")
    custom_prompt: Optional[str] = Field(None, description="Optional additional instructions for the AI")


class QuestionResult(BaseModel):
    questionType: str
    difficulty: str
    contentArea: str
    grade: str
    chapter: Optional[str] = None    # Chapter filter used during generation
    text: str
    options: Optional[dict] = None   # Only for SINGLE_SELECT or MULTIPLE_SELECT: {"A": "...", "B": "...", ...}
    answer: str
    explanation: str
    sourceChunkIds: list[int]


class GenerateResponse(BaseModel):
    questions: list[QuestionResult]
    retrieved_chunk_count: int
    doc_ids_used: list[str]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

class DeleteResponse(BaseModel):
    doc_id: str
    message: str


# ---------------------------------------------------------------------------
# Regenerate (single question)
# ---------------------------------------------------------------------------

class RegenerateRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Science")
    grade: str = Field(..., description="e.g. Grade 6")
    question_type: str = Field(..., description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | ...")
    difficulty: str = Field(..., description="easy | medium | hard")
    original_question: dict = Field(..., description="The full original question JSON object")
    modification_instructions: str = Field(
        "",
        description="Teacher's refinement notes, e.g. 'Make it harder' or 'Focus on photosynthesis'"
    )
    source_chunk_ids: list[int] = Field(
        default_factory=list,
        description="FAISS chunk_id integers from the original question's sourceChunkIds"
    )


class RegenerateResponse(BaseModel):
    question: QuestionResult

