from pydantic import BaseModel, Field, field_validator
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
        description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES | ORDERING | BACKGROUND_GRAPHIC | GAP_MATCH | MULTIPLE_DROP_BUCKET | MATRIX_INTERACTION | SELECT_TEXT"
    )
    difficulty: str = Field(..., description="easy | medium | hard")
    count: int = Field(..., ge=1, le=20, description="Number of questions (1-20)")
    custom_prompt: Optional[str] = Field(None, description="Optional additional instructions for the AI")
    include_visuals: Optional[bool] = Field(False, description="Whether to generate visual SVG diagrams for the questions")
    passage_text: Optional[str] = Field(None, description="Optional reading passage stimulus text to ground question generation")
    passage_id: Optional[int] = Field(None, description="Optional database ID of the linked passage")


# ---------------------------------------------------------------------------
# Internet-based generation (no syllabus / no RAG)
# ---------------------------------------------------------------------------

class GenerateInternetRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Mathematics")
    grade: str = Field(..., description="e.g. Grade 6")
    question_type: str = Field(
        ...,
        description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES | ORDERING | BACKGROUND_GRAPHIC | GAP_MATCH | MULTIPLE_DROP_BUCKET | MATRIX_INTERACTION | SELECT_TEXT"
    )
    difficulty: str = Field(..., description="easy | medium | hard")
    count: int = Field(..., ge=1, le=20, description="Number of questions (1-20)")
    custom_prompt: Optional[str] = Field(None, description="Optional additional instructions for the AI")
    preferred_website: Optional[str] = Field(None, description="Optional user-preferred website URL for sourcing questions")
    include_visuals: Optional[bool] = Field(False, description="Whether to generate visual SVG diagrams for the questions")
    passage_text: Optional[str] = Field(None, description="Optional reading passage stimulus text to ground question generation")
    passage_id: Optional[int] = Field(None, description="Optional database ID of the linked passage")


# ---------------------------------------------------------------------------
# Question Result
# ---------------------------------------------------------------------------

class SourceRef(BaseModel):
    """Traces a generated question back to the exact file + page it came from."""
    filename: str
    doc_id: str
    chunk_id: Optional[int] = 0
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
    options: Optional[Union[dict, list]] = None   # Dictionary for MCQ/CR/DD/ML/BG, List for ORDERING
    answer: Union[str, dict, list]
    explanation: str
    sourceChunkIds: list[int]
    sources: list[SourceRef] = []    # Resolved file/page citations for sourceChunkIds
    imageRefs: list[str] = []        # Servable URLs for any images used as source material
    grounded: bool = True            # Result of the post-generation fact-check layer
    groundingScore: float = 1.0      # 0.0-1.0 confidence from the fact-check layer
    groundingNote: Optional[str] = None
    visual: Optional[str] = None     # Standalone SVG diagram markup
    webSources: Optional[list] = []  # Web sources citations for internet generation
    passage_id: Optional[int] = None # Database ID of linked passage
    passage_title: Optional[str] = None # Title of linked passage

    @field_validator("webSources", mode="before")
    @classmethod
    def coerce_web_sources(cls, v):
        if isinstance(v, dict):
            return [v]
        if isinstance(v, str) and v.strip():
            return [{"name": "Web Reference", "url": v.strip()}]
        if isinstance(v, list):
            return v
        return []


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
    question_type: str = Field(..., description="SINGLE_SELECT | MULTIPLE_SELECT | TRUE_FALSE | CONSTRUCTED_RESPONSE | DROPDOWN | MATCHING_LINES | ORDERING | BACKGROUND_GRAPHIC | GAP_MATCH | MULTIPLE_DROP_BUCKET | MATRIX_INTERACTION | SELECT_TEXT")
    difficulty: str = Field(..., description="easy | medium | hard")
    original_question: dict = Field(..., description="The full original question JSON object")
    modification_instructions: str = Field(
        "",
        description="Teacher's refinement notes, e.g. 'Make it harder' or 'Focus on photosynthesis'"
    )
    refinement_targets: list[str] = Field(
        default_factory=list,
        description="Target components to refine: stem, choices, answer, distractors, rationale, entire_item"
    )
    source_chunk_ids: list[int] = Field(
        default_factory=list,
        description="FAISS chunk_id integers from the original question's sourceChunkIds"
    )
    passage_text: Optional[str] = Field(None, description="Optional stimulus reading passage text")
    passage_id: Optional[int] = Field(None, description="Optional stimulus passage database ID")
    passage_title: Optional[str] = Field(None, description="Optional stimulus passage title")


class RegenerateResponse(BaseModel):
    question: QuestionResult


# ---------------------------------------------------------------------------
# Generate from Reference Item (Variant & Clone Creation)
# ---------------------------------------------------------------------------

class GenerateFromReferenceRequest(BaseModel):
    content_area: str = Field(..., description="e.g. Mathematics, Science")
    grade: str = Field(..., description="e.g. Grade 1, Grade 6")
    reference_question: dict = Field(..., description="The seed reference question object with text, type, options, answer, etc.")
    count: int = Field(1, ge=1, le=5, description="Number of new items to create (1 to 5)")
    target_type: Optional[str] = Field(None, description="Optional target question type if format shift requested")
    target_difficulty: Optional[str] = Field(None, description="Optional target difficulty: easy | medium | hard")
    variant_style: str = Field("parallel", description="parallel | easier | harder | format_shift | custom")
    custom_instructions: Optional[str] = Field(None, description="Optional teacher refinement directives")
    include_visuals: Optional[bool] = Field(False, description="Whether to generate visual diagrams for the variants")


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    content_area: str = Field(..., description="e.g. ELA")
    grade: str = Field(..., description="e.g. Grade 6")
    question_type: str = Field(..., description="e.g. SINGLE_SELECT")
    question_text: str = Field(..., description="The question that feedback refers to")
    options: Optional[Union[dict, list]] = Field(None, description="Question options (dict for MCQ/BG, list for ordering)")
    answer: Optional[Union[str, dict, list]] = Field(None, description="Correct answer(s) for the question")
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
