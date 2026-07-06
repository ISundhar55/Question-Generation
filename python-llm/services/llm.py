"""
llm.py
------
Multi-provider LLM service for assessment question generation.

Supported providers (set LLM_PROVIDER in .env):
  - gemini  → Google Gemini (default: gemini-2.5-flash)
  - groq    → Groq API     (default: llama-3.3-70b-versatile)

Key design principles:
- STRICT: model is forbidden from using outside knowledge.
- If chunks are insufficient, model must return {"error": "..."}.
- Response must be valid JSON only — no markdown, no preamble.
- sourceChunkIds traces each question to the exact chunk(s) used.
"""

import json
import os
import re

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Provider configuration — controlled entirely from .env
# ---------------------------------------------------------------------------

# Primary provider: "gemini" | "groq"  (default: gemini)
LLM_PROVIDER   = os.getenv("LLM_PROVIDER", "gemini").lower()

# Gemini settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Groq settings (used as automatic fallback when Gemini quota exhausted)
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Quota/rate-limit error patterns that trigger automatic failover
_QUOTA_PATTERNS = (
    "429",
    "quota",
    "rate limit",
    "resource_exhausted",
    "RESOURCE_EXHAUSTED",
    "exceeded",
)

_gemini_client = None
_groq_client   = None


def _is_quota_error(error_str: str) -> bool:
    """Return True if the error is a Gemini quota / rate-limit error."""
    low = error_str.lower()
    return any(p.lower() in low for p in _QUOTA_PATTERNS)


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in environment.")
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_client = genai.GenerativeModel(GEMINI_MODEL)
        print(f"[llm] Gemini client ready: {GEMINI_MODEL}")
    return _gemini_client


def _get_groq():
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com and add it to python-llm/.env"
            )
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        print(f"[llm] Groq client ready: {GROQ_MODEL}")
    return _groq_client


# ---------------------------------------------------------------------------
# Question type format instructions (shared across providers)
# ---------------------------------------------------------------------------

_FORMAT_BY_TYPE = {
    "MCQ": """Each question object must follow this exact format:
{
  "questionType": "MCQ",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option>", "B": "<option>", "C": "<option>", "D": "<option>"},
  "answer": "<correct letter, e.g. A>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}""",

    "TRUE_FALSE": """Each question object must follow this exact format:
{
  "questionType": "TRUE_FALSE",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<statement that is clearly true or false>",
  "answer": "True" or "False",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}""",

    "SHORT_ANSWER": """Each question object must follow this exact format:
{
  "questionType": "SHORT_ANSWER",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question>",
  "answer": "<model answer in 1-3 sentences>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}""",

    "CONSTRUCTED_RESPONSE": """Each question object must follow this exact format:
{
  "questionType": "CONSTRUCTED_RESPONSE",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<sentence(s) with ___ for each blank>",
  "options": {
    "answers": [
      ["<primary correct answer for blank 1>", "<acceptable alternative synonym 1>", "<acceptable alternative synonym 2>"],
      ["<primary correct answer for blank 2>", "<acceptable alternative synonym 1>"]
    ]
  },
  "answer": "<pipe-separated primary correct answers in blank order, e.g. answer1|answer2>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for CONSTRUCTED_RESPONSE:
- Create 1-3 blanks using ___ in the text.
- Each element in options.answers MUST be an array of strings representing acceptable correct answers (synonyms, alternate spellings/formats) for that blank, in order. The first string in the array is the primary correct answer.
- The answer field must list only the primary correct answers joined with | (pipe).""",

    "DROPDOWN": """Each question object must follow this exact format:
{
  "questionType": "DROPDOWN",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<sentence(s) with ___ for each blank>",
  "options": {
    "blanks": [
      {"choices": ["<choice1>", "<choice2>", "<choice3>", "<choice4>"], "correct": "<correct_choice>"},
      {"choices": ["<choice1>", "<choice2>", "<choice3>", "<choice4>"], "correct": "<correct_choice>"}
    ]
  },
  "answer": "<pipe-separated correct answers in blank order, e.g. answer1|answer2>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for DROPDOWN:
- Create 2-3 blanks using ___ in the text.
- The number of objects in options.blanks must match the number of ___ in the text.
- Each blank must have exactly 4 choices (1 correct + 3 plausible distractors from the syllabus).
- The correct field must be identical to one of the choices strings.
- The answer field is the pipe-separated correct values in blank order.""",

    "MATCHING_LINES": """Each question object must follow this exact format:
{
  "questionType": "MATCHING_LINES",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<stem instruction, e.g. Match each item in Column A with the correct item in Column B>",
  "options": {
    "left":  {"A": "<left item 1>", "B": "<left item 2>", "C": "<left item 3>", "D": "<left item 4>"},
    "right": {"1": "<right item 1>", "2": "<right item 2>", "3": "<right item 3>", "4": "<right item 4>"}
  },
  "answer": "A-<number>, B-<number>, C-<number>, D-<number>",
  "explanation": "<brief explanation of the correct matches using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for MATCHING_LINES:
- Left column keys MUST be uppercase letters: A, B, C, D.
- Right column keys MUST be digit strings: "1", "2", "3", "4".
- Every left key must have exactly one matching right key.
- The answer field must list all pairs in order, e.g. "A-2, B-4, C-1, D-3".
- All items must be drawn strictly from the syllabus excerpts — no invented content.""",
}


def _build_prompt(
    content_area: str,
    grade: str,
    question_type: str,
    difficulty: str,
    count: int,
    chunks: list[dict],
    custom_prompt: str | None = None,
) -> str:
    context_parts = []
    for chunk in chunks:
        context_parts.append(
            f"[Chunk ID: {chunk['chunk_id']} | Chapter: {chunk.get('chapter','?')} | "
            f"Topic: {chunk.get('topic','?')}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)
    format_instruction = _FORMAT_BY_TYPE.get(question_type, _FORMAT_BY_TYPE["MCQ"])

    # Optional teacher-supplied instructions block
    custom_block = ""
    if custom_prompt and custom_prompt.strip():
        custom_block = f"""

Additional Instructions from the teacher (MUST follow these):
{custom_prompt.strip()}
"""

    return f"""You are an assessment question generator for {grade} {content_area}.

STRICT RULES — follow exactly:
1. Use ONLY the information provided in the syllabus excerpts below.
2. Do NOT use any outside knowledge or invent facts not present in the excerpts.
3. Do NOT copy text verbatim — rephrase into clear question form.
4. If the provided excerpts do not contain enough information to generate \
{count} {question_type} questions at {difficulty} difficulty, respond with \
exactly this JSON object and nothing else:
   {{"error": "Insufficient syllabus content for the requested parameters."}}
5. Return ONLY a valid JSON array. No markdown, no code fences, no explanations, \
no preamble. The response must start with [ and end with ].
6. The difficulty level must be strictly {difficulty} — calibrate accordingly.
7. In sourceChunkIds, list the chunk_id integers of every chunk you drew from.

Syllabus excerpts:
---
{context}
---

Generate exactly {count} {question_type} question(s) at {difficulty} difficulty.

{format_instruction}{custom_block}

Return a JSON array of {count} question object(s):"""


def _clean_response(raw: str) -> str:
    """Strip markdown code fences and clean trailing commas/non-JSON wrapper text."""
    raw = raw.strip()
    # Strip markdown code blocks
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    # Find the start of the JSON block (prefer array, then object)
    start_arr = raw.find('[')
    start_obj = raw.find('{')
    
    if start_arr != -1 and (start_obj == -1 or start_arr < start_obj):
        end_arr = raw.rfind(']')
        if end_arr != -1:
            raw = raw[start_arr:end_arr+1]
    elif start_obj != -1:
        end_obj = raw.rfind('}')
        if end_obj != -1:
            raw = raw[start_obj:end_obj+1]

    # Clean trailing commas (e.g., [1, 2, ] -> [1, 2] or {"a": 1, } -> {"a": 1})
    raw = re.sub(r',(\s*[\]\}])', r'\1', raw)
    return raw.strip()


def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai
    client = _get_gemini()
    response = client.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.4,
            max_output_tokens=4096,
            response_mime_type="application/json",
        ),
    )
    return response.text


def _call_groq(prompt: str) -> str:
    client = _get_groq()
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert assessment question generator. "
                    "Follow all instructions exactly. Return only valid JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=4096,
    )
    return completion.choices[0].message.content


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_questions(
    content_area: str,
    grade: str,
    question_type: str,
    difficulty: str,
    count: int,
    chunks: list[dict],
    custom_prompt: str | None = None,
) -> tuple[list[dict], str, str, bool, str | None]:
    """
    Call the primary LLM provider and, on quota/rate-limit error,
    automatically fall back to Groq.

    Priority:
      1. LLM_PROVIDER (from .env) — "gemini" (default) or "groq"
      2. If Gemini hits quota/rate-limit  →  auto-switch to Groq
      3. If Groq is primary and fails     →  return error

    Returns:
      (questions, prompt_sent, raw_response, parse_success, error_message)
    """
    prompt = _build_prompt(content_area, grade, question_type, difficulty, count, chunks, custom_prompt)
    provider_used = LLM_PROVIDER
    raw = ""

    # ── Primary call ─────────────────────────────────────────────────────────
    try:
        if LLM_PROVIDER == "groq":
            raw = _call_groq(prompt)
        else:
            raw = _call_gemini(prompt)
        print(f"[llm] Generated via {provider_used}")

    except Exception as primary_err:
        err_str = str(primary_err)

        # ── Automatic Gemini → Groq failover ─────────────────────────────────
        if LLM_PROVIDER == "gemini" and _is_quota_error(err_str):
            print(
                f"[llm] ⚠️  Gemini quota/rate-limit hit — "
                f"automatically switching to Groq ({GROQ_MODEL})"
            )
            try:
                raw = _call_groq(prompt)
                provider_used = "groq (auto-fallback)"
                print(f"[llm] ✅ Fallback to Groq succeeded")
            except Exception as fallback_err:
                return [], prompt, "", False, (
                    f"Gemini quota exceeded AND Groq fallback failed: {str(fallback_err)}. "
                    f"Check GROQ_API_KEY in python-llm/.env"
                )
        else:
            return [], prompt, "", False, f"{provider_used.capitalize()} API error: {err_str}"

    cleaned = _clean_response(raw)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return [], prompt, raw, False, f"JSON parse error: {str(e)}"

    if isinstance(parsed, dict) and "error" in parsed:
        return [], prompt, raw, False, parsed["error"]

    if not isinstance(parsed, list):
        return [], prompt, raw, False, "Expected JSON array from LLM."

    return parsed, prompt, raw, True, None


def transcribe_page_image(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """
    Call Gemini (gemini-2.5-flash) multimodal capability to transcribe a page image.
    Transcribes text, parses tables to Markdown, and describes graphs/diagrams.
    Includes automatic rate-limit (429) retries with a sleep delay.
    """
    import google.generativeai as genai
    import time
    
    client = _get_gemini()
    
    prompt = """Analyze this document page image. Follow these guidelines:
1. Transcribe all text content exactly, maintaining paragraphs and heading levels (e.g. Chapter 1, Topic).
2. For any tables, charts, or structural data grids, transcribe them into clean, structured Markdown tables.
3. For any diagrams, graphs, charts, or photos, write a detailed description detailing titles, legend names, axes values, specific data points, trend directions, and visual observations under a header '[Image Description: <brief title>]'.
4. Do NOT omit any visible text or data points. Ensure the transcribed text maintains the logical reading order.
5. Return only the Markdown text transcription. Do not include introductory text, conversational comments, or code block wraps."""

    image_part = {
        "mime_type": mime_type,
        "data": image_bytes
    }
    
    max_retries = 3
    retry_delay = 8  # Wait 8 seconds before retrying
    
    for attempt in range(max_retries):
        try:
            response = client.generate_content(
                [prompt, image_part],
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=4096,
                )
            )
            return response.text.strip()
        except Exception as e:
            err_str = str(e).lower()
            is_quota = any(p in err_str for p in ["429", "quota", "rate limit", "resource_exhausted"])
            if is_quota and attempt < max_retries - 1:
                print(f"[llm] ⚠️ Rate limit hit during page transcription. Waiting {retry_delay}s before retry (attempt {attempt+1}/{max_retries})...")
                time.sleep(retry_delay)
                continue
            # If not a rate limit, or all retries exhausted, re-raise the exception
            raise e
