"""
variant_service.py
------------------
Service for generating new assessment items and variants modeled on an existing reference item.
Supports parallel clones, scaffolded easier variants, challenging harder variants, format shifts,
and custom teacher directives.
"""
import os
import json
import re
from typing import List, Tuple, Optional, Dict, Any

from services.llm import (
    _call_clap,
    _call_gemini,
    _call_groq,
    _clean_response,
    normalize_question,
    validate_and_reconcile_multiple_select,
    LLM_PROVIDER,
    GROQ_MODEL,
    sanitize_user_text,
)
from services.format_templates import FORMAT_BY_TYPE
from .variant_models import GenerateFromReferenceRequest


def get_variant_guardrails() -> str:
    """Loaded dynamically from variant_guardrails.md in the same directory."""
    try:
        _dir = os.path.dirname(os.path.abspath(__file__))
        _md_path = os.path.join(_dir, "variant_guardrails.md")
        if os.path.exists(_md_path):
            with open(_md_path, "r", encoding="utf-8") as f:
                return f.read().strip()
    except Exception as e:
        print(f"[variant] Warning: failed to load variant_guardrails.md dynamically: {e}")
    return ""


def _build_variant_prompt(req: GenerateFromReferenceRequest) -> str:
    ref = req.reference_question or {}
    ref_stem = str(ref.get("text") or ref.get("question") or "").strip()
    ref_type = str(ref.get("questionType") or ref.get("type") or "SINGLE_SELECT").upper()
    if ref_type == "MCQ":
        ref_type = "SINGLE_SELECT"

    ref_diff = str(ref.get("difficulty") or "medium").lower()
    ref_opts = ref.get("options")
    ref_ans = str(ref.get("answer") or "").strip()
    ref_exp = str(ref.get("explanation") or "").strip()

    # Determine target question type and difficulty
    target_type = (req.target_type or ref_type).upper()
    if target_type == "MCQ":
        target_type = "SINGLE_SELECT"

    target_diff = req.target_difficulty
    if not target_diff:
        if req.variant_style == "easier":
            target_diff = "easy" if ref_diff in ("medium", "hard") else "easy"
        elif req.variant_style == "harder":
            target_diff = "hard" if ref_diff in ("easy", "medium") else "hard"
        else:
            target_diff = ref_diff

    # Format reference options cleanly for display in prompt
    opts_display = ""
    if isinstance(ref_opts, dict):
        opts_display = "\n".join([f"    {k}: {v}" for k, v in ref_opts.items() if k != "visual"])
    elif isinstance(ref_opts, list):
        opts_display = "\n".join([f"    • {item}" for item in ref_opts])
    else:
        opts_display = str(ref_opts or "N/A")

    # Variant transformation instruction block
    style = (req.variant_style or "parallel").lower()
    directive_lines = []

    if style == "parallel":
        directive_lines.append(
            "• VARIANT GOAL: SIMILAR (SAME LEVEL)\n"
            "  - Assess the EXACT SAME underlying skill, standard, and cognitive competency.\n"
            "  - Maintain the SAME difficulty level and cognitive depth.\n"
            "  - Change the superficial context: use fresh scenarios, alternative subjects/entities, new character names, or different domain examples.\n"
            "  - Do NOT copy the exact text, sentences, or quantitative values from the reference item."
        )
    elif style == "easier":
        directive_lines.append(
            "• VARIANT GOAL: EASIER (FOUNDATIONAL)\n"
            "  - Assess the foundational or prerequisite concept of the reference item.\n"
            "  - Reduce cognitive friction: provide direct context clues, use accessible vocabulary and premises, or focus on single-step deductions.\n"
            "  - Calibrate the item to an accessible, supportive difficulty."
        )
    elif style == "harder":
        directive_lines.append(
            "• VARIANT GOAL: HARDER (ADVANCED)\n"
            "  - Elevate cognitive complexity (Webb's DOK / Bloom's Taxonomy): require deeper inference, synthesis of multiple conditions/variables, or subtler evaluation.\n"
            "  - Design sophisticated, highly plausible distractors that challenge common misconceptions or nuanced misinterpretations.\n"
            "  - Calibrate the item to a rigorous, mastery-level difficulty."
        )
    elif style == "format_shift" or target_type != ref_type:
        directive_lines.append(
            f"• VARIANT GOAL: DIFFERENT FORMAT (from {ref_type} to {target_type})\n"
            f"  - Re-engineer the core competency of the reference item to naturally fit the '{target_type}' question format.\n"
            f"  - Restructure the prompt, options, and response mechanism to strictly conform to the {target_type} specification."
        )

    custom_block = ""
    if req.custom_instructions and req.custom_instructions.strip():
        clean_custom = sanitize_user_text(req.custom_instructions, "custom_instructions")
        custom_block = f"""
================================================================================
⚡ TEACHER'S ADDITIONAL INSTRUCTIONS (MANDATORY TOP-PRIORITY OVERRIDE):
================================================================================
"{clean_custom}"

STRICT COMPLIANCE REQUIREMENTS:
• You MUST strictly apply every requirement, format constraint, scenario, and topic specified in the Teacher's Additional Instructions above.
• If the teacher requests a "table based question", "table", or "data table", you MUST embed a well-structured Markdown table directly into the question stem ("text" field) using standard syntax:
  | Header 1 | Header 2 | Header 3 |
  |---|---|---|
  | Data A | Data B | Data C |
• The teacher's instructions take precedence over default mirror patterns of the reference question.
================================================================================
"""
        directive_lines.append(
            f"• TEACHER'S DIRECTIVES (MANDATORY HIGHEST PRIORITY):\n"
            f"  {clean_custom}"
        )

    directive_block = "\n".join(directive_lines)

    # Question format template
    format_instruction = FORMAT_BY_TYPE.get(target_type, FORMAT_BY_TYPE["SINGLE_SELECT"])
    guardrails_text = get_variant_guardrails()

    visual_instruction = ""
    if req.include_visuals:
        visual_instruction = (
            "🎨 MANDATORY VISUAL DIAGRAM INSTRUCTION:\n"
            "The teacher has requested visual diagram-based variants. Include an inline self-contained SVG diagram in the 'visual' property.\n"
        )

    prompt = f"""You are an elite educational assessment author and psychometrician.
Your mission is to generate {req.count} brand-new, high-quality assessment item(s) derived from an existing REFERENCE ITEM.

{custom_block}

================================================================================
SEED REFERENCE ITEM:
================================================================================
• Content Area: {req.content_area}
• Grade Level: {req.grade}
• Original Type: {ref_type}
• Original Difficulty: {ref_diff}
• Original Question Stem:
  "{ref_stem}"
• Original Options:
{opts_display}
• Original Correct Answer: {ref_ans}
• Original Explanation / Rationale:
  "{ref_exp}"
================================================================================

TRANSFORMATION DIRECTIVES FOR NEW ITEM(S):
• Target Question Type: {target_type}
• Target Difficulty: {target_diff}
{directive_block}

CRITICAL UNIVERSAL RULES (ZERO-TOLERANCE):
1. STRICT COMPLIANCE WITH TEACHER'S ADDITIONAL INSTRUCTIONS:
   - If the teacher provided custom instructions above (e.g. creating a table-based question, targeting specific conditions, or using a specific scenario), you MUST fulfill them completely.
   - For table-based questions, format the table cleanly in the question stem using Markdown table syntax (`| Col 1 | Col 2 |\n|---|---|...`).
2. 100% SELF-CONTAINED QUESTION STEMS:
   - Every generated question MUST be completely standalone.
   - Embed all necessary premises, givens, tables, measurements, character names, or background facts directly into the question stem.
   - NEVER make meta-references to the reference question (e.g. NEVER write "In the reference item...", "Like the question above...", "In the previous problem...", or "Based on the story...").
3. MATHEMATICAL & FACTUAL INTEGRITY:
   - Ensure every calculation, comparison, and relationship is mathematically exact and factually sound.
   - For Multiple Choice, ensure all distractors are definitively INCORRECT yet plausible.
4. EXPLANATION COVERAGE:
   - For every option (A, B, C, D, etc.), provide an explicit rationale bullet explaining why that specific choice is correct or incorrect.

{guardrails_text}

{visual_instruction}

SCHEMA SPECIFICATION FOR TARGET TYPE ({target_type}):
--------------------------------------------------------------------------------
{format_instruction}
--------------------------------------------------------------------------------

OUTPUT INSTRUCTION:
Return ONLY a valid JSON array of exactly {req.count} question object(s). Do not wrap in markdown quotes or preamble.
Example wrapper:
[
  {{ ...question object 1... }}
]
"""
    return prompt.strip()


def generate_variants(
    req: GenerateFromReferenceRequest
) -> Tuple[List[Dict[str, Any]], str, str, bool, Optional[str]]:
    """
    Executes variant generation via the configured LLM provider with fallback and validation.
    Returns: (questions_list, prompt_sent, raw_response, success_bool, error_message)
    """
    prompt = _build_variant_prompt(req)
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
            print(f"[variant] Generated via {provider_used} (attempt {attempt})")

        except Exception as primary_err:
            err_str = str(primary_err)
            if LLM_PROVIDER == "gemini":
                print(f"[variant] Gemini error ({err_str[:80]}) — switching to Groq ({GROQ_MODEL})")
                try:
                    raw = _call_groq(prompt)
                    provider_used = "groq (auto-fallback)"
                except Exception as fallback_err:
                    return [], prompt, "", False, f"Gemini failed ({err_str[:60]}) AND Groq fallback failed: {fallback_err}"
            elif LLM_PROVIDER == "clap":
                print(f"[variant] CLAP error ({err_str[:80]}) — switching to Groq ({GROQ_MODEL})")
                try:
                    raw = _call_groq(prompt)
                    provider_used = "groq (auto-fallback)"
                except Exception as fallback_err:
                    return [], prompt, "", False, f"CLAP failed ({err_str[:60]}) AND Groq fallback failed: {fallback_err}"
            else:
                return [], prompt, "", False, f"{provider_used.capitalize()} API error: {err_str}"

        cleaned = _clean_response(raw)

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt < MAX_RETRIES:
                print(f"[variant] JSON decode error on attempt {attempt} — retrying... [{e}]")
                continue
            return [], prompt, raw, False, f"JSON parse error after {MAX_RETRIES} attempts: {e}"

        # If LLM returned a single object instead of an array, wrap it
        if isinstance(parsed, dict):
            if "error" in parsed:
                return [], prompt, raw, False, parsed["error"]
            parsed = [parsed]

        if not isinstance(parsed, list):
            return [], prompt, raw, False, "Expected a JSON array of question objects."

        normalized_questions = []
        ref_id = req.reference_question.get("id")

        for q in parsed:
            if not isinstance(q, dict):
                continue
            nq = normalize_question(q, allow_visuals=bool(req.include_visuals))

            # Reconcile MULTIPLE_SELECT if necessary
            if nq.get("questionType") == "MULTIPLE_SELECT":
                is_valid = validate_and_reconcile_multiple_select(nq)
                if not is_valid:
                    continue

            # Reference metadata & zero external chunk reliance
            nq["sourceChunkIds"] = []
            nq["sources"] = []
            nq["webSources"] = []
            nq["_isVariant"] = True
            nq["_referenceQuestionId"] = ref_id
            nq["_variantStyle"] = req.variant_style
            normalized_questions.append(nq)

        if not normalized_questions:
            if attempt < MAX_RETRIES:
                print(f"[variant] No valid normalized questions on attempt {attempt} — retrying...")
                continue
            return [], prompt, raw, False, "Generated questions failed normalization checks."

        return normalized_questions, prompt, raw, True, None

    return [], prompt, raw, False, "Failed to generate valid variants after all attempts."
