"""
passage_service.py
------------------
Service for generating high-quality curriculum-aligned reading passages (stimuli).
"""
import os
import json
import re
from typing import List, Tuple, Optional
from services.llm import (
    _call_clap,
    _call_gemini,
    _call_groq,
    _clean_response,
    LLM_PROVIDER,
    GROQ_MODEL,
    sanitize_user_text,
)
from .passage_models import GeneratePassageRequest, PassageResult

LENGTH_RANGES = {
    "short": (150, 250, "approximately 150 to 250 words"),
    "medium": (250, 400, "approximately 250 to 400 words"),
    "long": (400, 600, "approximately 400 to 600 words"),
}

def get_passage_guardrails() -> str:
    """Loaded dynamically from passage_guardrails.md in the same directory."""
    try:
        _dir = os.path.dirname(os.path.abspath(__file__))
        _md_path = os.path.join(_dir, "passage_guardrails.md")
        if os.path.exists(_md_path):
            with open(_md_path, "r", encoding="utf-8") as f:
                return f.read().strip()
    except Exception as e:
        print(f"[passage] Warning: failed to load passage_guardrails.md dynamically: {e}")
    return ""

def _count_words(text: str) -> int:
    if not text:
        return 0
    return len(text.strip().split())

def build_passage_prompt(req: GeneratePassageRequest) -> str:
    target_length_key = (req.target_length or "medium").lower()
    _, _, length_desc = LENGTH_RANGES.get(target_length_key, LENGTH_RANGES["medium"])

    genre_str = "Informational / Non-Fiction / Scientific" if req.genre == "informational" else "Literary Fiction / Narrative Prose"

    assessment_block = []
    if req.standard and req.standard.strip():
        assessment_block.append(f"• Educational Standard: {sanitize_user_text(req.standard, 'standard')}")
    if req.learning_objective and req.learning_objective.strip():
        assessment_block.append(f"• Learning Objective: {sanitize_user_text(req.learning_objective, 'learning_objective')}")
    if req.assessment_target and req.assessment_target.strip():
        assessment_block.append(f"• Assessment Target (Focus): {sanitize_user_text(req.assessment_target, 'assessment_target')}")
    if req.assessment_boundaries and req.assessment_boundaries.strip():
        assessment_block.append(f"• Assessment Boundaries (Scope Limits): {sanitize_user_text(req.assessment_boundaries, 'assessment_boundaries')}")
    if getattr(req, "cognitive_complexity", None) and req.cognitive_complexity.strip():
        assessment_block.append(f"• Cognitive Complexity: {sanitize_user_text(req.cognitive_complexity, 'cognitive_complexity')}")
    additional_notes = (req.instructions or req.custom_prompt or "").strip()
    if additional_notes:
        assessment_block.append(f"• Additional Instructions / Topic: {sanitize_user_text(additional_notes, 'instructions')}")

    assessment_str = "\n".join(assessment_block) if assessment_block else "• Educational Scope: Core grade-level curriculum topics and skills."

    count = req.count or 1

    visual_block = ""
    if req.include_visuals:
        visual_block = """
🎨 MANDATORY PEDAGOGICAL VISUAL DIAGRAM INSTRUCTION:
The teacher has requested an accompanying HIGH-QUALITY VISUAL DIAGRAM (or scientific/informational chart, cycle, anatomy illustration) for this reading passage.
Follow these visual rules strictly:
1. MANDATORY "visual" FIELD IN JSON:
   - Each passage object MUST include a "visual" field containing the complete, standalone <svg> markup:
     "visual": "<svg viewBox='0 0 500 240' width='100%' height='240' xmlns='http://www.w3.org/2000/svg'><rect width='500' height='240' fill='#f8fafc' rx='8'/>...</svg>"
   - The diagram must directly illustrate key concepts, processes, anatomical structures, timeline, cycle, or experimental setups described in the passage text.
2. SVG RENDERING & AESTHETICS:
   - Use `viewBox='0 0 500 240'` with clean shapes, high-contrast dark lines (`#1e293b`), clear color fills (`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`), and a background rect `<rect width='500' height='240' fill='#f8fafc' rx='8'/>`.
   - All text labels must be bold, legible (`font-size='13'`, `font-family='sans-serif'`, `text-anchor='middle'`).
   - For arrows/flowcharts, include `<defs><marker id='arrow' viewBox='0 0 10 10' refX='6' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'><path d='M 0 1 L 10 5 L 0 9 z' fill='#1e293b'/></marker></defs>`.
"""
    else:
        visual_block = """
🚫 TEXT-ONLY FORMAT:
The teacher has requested a text-only passage.
Do NOT include any SVG diagrams or graphics. Set "visual": null in the output.
"""

    guardrails_text = get_passage_guardrails()

    prompt = f"""You are an expert curriculum developer and assessment stimulus author for {req.grade} {req.content_area}.

TASK:
Write {count} completely original, engaging, high-quality assessment reading passage(s) designed to serve as test stimuli for downstream student evaluation items.

CURRICULUM SPECIFICATIONS:
• Grade Level: {req.grade}
• Content Area: {req.content_area}
• Target Genre: {genre_str}
• Target Length: {length_desc}
{assessment_str}

{guardrails_text}
{visual_block}

OUTPUT FORMAT:
Return a JSON array of {count} passage object(s) with this exact schema:
[
  {{
    "title": "<Engaging Title>",
    "text": "<Full passage text with proper paragraph breaks using \\n\\n>",
    "visual": <complete <svg> markup string if visual requested, or null>,
    "genre": "{req.genre or 'informational'}",
    "grade": "{req.grade}",
    "contentArea": "{req.content_area}",
    "wordCount": <integer word count>,
    "assessmentTarget": "{sanitize_user_text(req.assessment_target, 'target') if req.assessment_target else ''}",
    "assessmentBoundaries": "{sanitize_user_text(req.assessment_boundaries, 'boundaries') if req.assessment_boundaries else ''}",
    "cognitiveComplexity": "{sanitize_user_text(req.cognitive_complexity, 'complexity') if getattr(req, 'cognitive_complexity', None) else ''}",
    "readingLevel": "{req.grade}"
  }}
]

Return valid JSON array only. No markdown fences, no preamble."""
    return prompt

def generate_passages(req: GeneratePassageRequest) -> Tuple[List[PassageResult], str, str, bool, Optional[str]]:
    """
    Generate reading passages using the primary LLM provider (Gemini) with automatic failover to Groq.
    Returns: (passages_list, prompt_sent, raw_response, success, error_message)
    """
    prompt = build_passage_prompt(req)
    provider_used = LLM_PROVIDER
    raw = ""
    MAX_RETRIES = 3

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if LLM_PROVIDER == "clap":
                raw = _call_clap(prompt)
            elif LLM_PROVIDER == "groq":
                raw = _call_groq(prompt)
            else:
                raw = _call_gemini(prompt)
            print(f"[passage] Generated via {provider_used} (attempt {attempt})")
        except Exception as primary_err:
            err_str = str(primary_err)
            if LLM_PROVIDER in ("gemini", "clap"):
                print(f"[passage] {provider_used} error ({err_str[:80]}) — switching to Groq ({GROQ_MODEL})")
                try:
                    raw = _call_groq(prompt)
                    provider_used = "groq (auto-fallback)"
                except Exception as fallback_err:
                    return [], prompt, "", False, f"{provider_used} failed ({err_str[:60]}) AND Groq fallback failed: {str(fallback_err)}"
            else:
                return [], prompt, "", False, f"{provider_used.capitalize()} API error: {err_str}"

        cleaned = _clean_response(raw)

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt < MAX_RETRIES:
                print(f"[passage] JSON parse error on attempt {attempt} — retrying... [{str(e)}]")
                continue
            return [], prompt, raw, False, f"JSON parse error after {MAX_RETRIES} attempts: {str(e)}"

        if isinstance(parsed, dict) and "error" in parsed:
            return [], prompt, raw, False, parsed["error"]

        if isinstance(parsed, dict):
            parsed = [parsed]

        if not isinstance(parsed, list):
            return [], prompt, raw, False, "Expected JSON array of passage objects."

        results = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            title = str(item.get("title", "")).strip() or "Reading Stimulus"
            computed_words = _count_words(text)

            visual_raw = item.get("visual")
            visual_str = None
            if visual_raw and isinstance(visual_raw, str) and "<svg" in visual_raw:
                visual_str = visual_raw.strip()

            results.append(PassageResult(
                title=title,
                text=text,
                visual=visual_str,
                genre=str(item.get("genre", req.genre or "informational")),
                grade=str(item.get("grade", req.grade)),
                contentArea=str(item.get("contentArea", req.content_area)),
                wordCount=computed_words,
                assessmentTarget=req.assessment_target,
                assessmentBoundaries=req.assessment_boundaries,
                cognitiveComplexity=getattr(req, "cognitive_complexity", None),
                readingLevel=str(item.get("readingLevel", req.grade)),
            ))

        if results:
            return results, prompt, raw, True, None

    return [], prompt, raw, False, "Passage generation failed after all retries."
