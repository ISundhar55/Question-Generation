from pydantic import BaseModel, Field
from typing import Optional, Union


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
        description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES | ORDERING"
    )
    difficulty: str = Field(..., description="easy | medium | hard")
    count: int = Field(..., ge=1, le=20, description="Number of questions (1-20)")
    custom_prompt: Optional[str] = Field(None, description="Optional additional instructions for the AI")


class SourceRef(BaseModel):
    """Traces a generated question back to the exact file + page it came from."""
    doc_id: str
    filename: str
    chapter: Optional[str] = None
    page: Optional[int] = None
    chunk_type: str = "text"        # "text" | "image"


class QuestionResult(BaseModel):
    questionType: str
    difficulty: str
    contentArea: str
    grade: str
    chapter: Optional[str] = None    # Chapter filter used during generation
    text: str
    options: Optional[Union[dict, list]] = None   # Dictionary for MCQ/CR/DD/ML, List for ORDERING
    answer: str
    explanation: str
    sourceChunkIds: list[int]
    sources: list[SourceRef] = []    # Resolved file/page citations for sourceChunkIds
    imageRefs: list[str] = []        # Servable URLs for any images used as source material
    grounded: bool = True            # Result of the post-generation fact-check layer
    groundingScore: float = 1.0      # 0.0-1.0 confidence from the fact-check layer
    groundingNote: Optional[str] = None


class GenerateResponse(BaseModel):
    questions: list[QuestionResult]
    retrieved_chunk_count: int
    doc_ids_used: list[str]
    ungrounded_dropped: int = 0      # How many candidate questions failed the grounding check
    duplicate_dropped: int = 0       # How many candidate questions failed the in-batch duplicate check


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
    question_type: str = Field(..., description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES | ORDERING")
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


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    content_area: str = Field(..., description="e.g. ELA")
    grade: str = Field(..., description="e.g. Grade 6")
    question_type: str = Field(..., description="e.g. SINGLE_SELECT")
    question_text: str = Field(..., description="The question that feedback refers to")
    options: Optional[Union[dict, list]] = Field(None, description="Question options (dict for MCQ, list for ordering)")
    answer: Optional[str] = Field(None, description="Correct answer(s) for the question")
    sources: Optional[list] = Field(None, description="Source references (page, chapter, doc) for the question")
    feedback_text: str = Field(..., description="Teacher's comment or suggestion")
    rating: Optional[int] = Field(None, ge=1, le=5, description="1 (poor) to 5 (excellent)")
    category: Optional[str] = Field(
        None,
        description="distractor_quality | difficulty | clarity | accuracy | topic | other"
    )


class FeedbackResponse(BaseModel):
    id: str
    message: str
