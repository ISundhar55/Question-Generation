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
    "SINGLE_SELECT": """Each question object must follow this exact format:
{
  "questionType": "SINGLE_SELECT",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option>", "B": "<option>", "C": "<option>", "D": "<option>"},
  "answer": "<correct letter, e.g. A>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}""",

    "MULTIPLE_SELECT": """Each question object must follow this exact format:
{
  "questionType": "MULTIPLE_SELECT",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option>", "B": "<option>", "C": "<option>", "D": "<option>"},
  "answer": "<pipe-separated list of correct letters, e.g. A|C>",
  "explanation": "<brief explanation using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}
IMPORTANT for MULTIPLE_SELECT:
- The options dictionary should have 4 to 6 choice options (A, B, C, D, and optionally E, F).
- There must be more than one correct option.
- The answer field must list all correct letters in alphabetical order, joined with | (pipe), e.g. "A|C" or "B|C|D".""",

    "MCQ": """Each question object must follow this exact format:
{
  "questionType": "SINGLE_SELECT",
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
- Each element in options.answers MUST be an array of strings representing acceptable correct answers (synonyms, alternate spellings, abbreviations, or alternative terminology) for that blank.
- You MUST provide at least 2-3 acceptable alternatives inside the array for EACH blank (e.g. for "central idea", include synonyms like "main idea" and "primary concept"). Do NOT return a single-item array.
- The first string in each array is the primary correct answer.
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

    "ORDERING": """Each question object must follow this exact format:
{
  "questionType": "ORDERING",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<instruction/stem, e.g. Put these steps of the scientific method in the correct sequence:>",
  "options": ["<shuffled/incorrect ordered option 1>", "<shuffled/incorrect ordered option 2>", "<shuffled/incorrect ordered option 3>", "<shuffled/incorrect ordered option 4>"],
  "answer": "<pipe-separated correct sequence of options, in correct order, e.g. Option 3|Option 2|Option 1>",
  "explanation": "<brief explanation of the correct sequence using only syllabus content>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for ORDERING:
- Provide 3 to 6 options in the options array.
- The options array MUST be in a shuffled/incorrect order.
- The answer field MUST consist of all the options strings exactly as written, sorted in their correct sequence, joined by a pipe (|). E.g. "Step A|Step B|Step C".
- All options must be drawn strictly from the syllabus excerpts — no invented content.""",
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
IMPORTANT: If the instruction above restricts questions to a specific topic, use the closest matching content available in the syllabus excerpts. Do NOT return an insufficient-content error simply because the exact topic phrasing is absent — generate questions from the most relevant content provided.
"""

    return f"""You are an assessment question generator for {grade} {content_area}.

STRICT RULES — follow exactly:
1. Use ONLY the information provided in the syllabus excerpts below.
2. Do NOT use any outside knowledge or invent facts not present in the excerpts.
3. Do NOT copy text verbatim — rephrase into clear question form.
4. Return ONLY a valid JSON array. No markdown, no code fences, no explanations, \
no preamble. The response must start with [ and end with ].
5. The difficulty level must be strictly {difficulty} — calibrate accordingly.
6. In sourceChunkIds, list the chunk_id integers of every chunk you drew from.

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
            max_output_tokens=8192,
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
        max_tokens=8192,
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

    MAX_RETRIES = 3  # 1 initial attempt + 2 retries on JSON parse failures

    for attempt in range(1, MAX_RETRIES + 1):
        # ── Primary call ─────────────────────────────────────────────────────
        try:
            if LLM_PROVIDER == "groq":
                raw = _call_groq(prompt)
            else:
                raw = _call_gemini(prompt)
            print(f"[llm] Generated via {provider_used} (attempt {attempt})")

        except Exception as primary_err:
            err_str = str(primary_err)

            # ── Automatic Gemini → Groq failover ─────────────────────────────
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
            if attempt < MAX_RETRIES:
                print(
                    f"[llm] ⚠️  JSON parse error on attempt {attempt} "
                    f"(likely truncated response) — retrying... [{str(e)}]"
                )
                continue  # retry the LLM call
            # All retries exhausted
            return [], prompt, raw, False, f"JSON parse error after {MAX_RETRIES} attempts: {str(e)}"

        if isinstance(parsed, dict) and "error" in parsed:
            return [], prompt, raw, False, parsed["error"]

        if not isinstance(parsed, list):
            return [], prompt, raw, False, "Expected JSON array from LLM."

        # Successful parse — return immediately after normalizing each question
        normalized_parsed = [normalize_question(q) for q in parsed if isinstance(q, dict)]
        return normalized_parsed, prompt, raw, True, None

    # Should not reach here, but safety net
    return [], prompt, raw, False, "Generation failed after all retries."


# ---------------------------------------------------------------------------
# Regenerate a single question
# ---------------------------------------------------------------------------


def normalize_question(q: dict) -> dict:
    """Normalize questionType and answer fields to match standard conventions."""
    if not isinstance(q, dict):
        return q

    # 0. Safety pre-normalization: Convert answer field to string if it is a list/boolean/null
    if "answer" in q:
        ans = q["answer"]
        if isinstance(ans, list):
            # E.g. ['B'] -> 'B', ['A', 'C'] -> 'A|C'
            clean_items = [str(a).strip() for a in ans if a is not None]
            q["answer"] = "|".join(clean_items)
        elif isinstance(ans, bool):
            q["answer"] = "True" if ans else "False"
        elif ans is None:
            q["answer"] = ""
        else:
            q["answer"] = str(ans).strip()
        
    # 1. Normalize questionType to standard enum strings
    q_type = str(q.get("questionType", "")).upper().replace(" ", "_").strip()
    if q_type in ["MULTI_SELECT", "MULTIPLE_SELECT", "MULTI"]:
        q["questionType"] = "MULTIPLE_SELECT"
    elif q_type in ["SINGLE_SELECT", "MCQ", "SINGLE"]:
        q["questionType"] = "SINGLE_SELECT"
    elif q_type in ["TRUE_FALSE", "TRUE/FALSE", "TF"]:
        q["questionType"] = "TRUE_FALSE"
    elif q_type in ["CONSTRUCTED_RESPONSE", "FILL_IN_BLANK", "SHORT_ANSWER"]:
        q["questionType"] = "CONSTRUCTED_RESPONSE"
    elif q_type in ["DROPDOWN"]:
        q["questionType"] = "DROPDOWN"
    elif q_type in ["MATCHING_LINES", "MATCHING"]:
        q["questionType"] = "MATCHING_LINES"
    elif q_type in ["ORDERING", "ORDER", "SEQUENCE"]:
        q["questionType"] = "ORDERING"

    # 2. Normalize answer representation for MULTIPLE_SELECT (comma/space -> pipes, sorted)
    if q.get("questionType") == "MULTIPLE_SELECT":
        ans = q.get("answer")
        if isinstance(ans, str):
            ans_clean = re.sub(r"[\s,;\|]+", "|", ans).strip("|").upper()
            letters = sorted(list(set(ans_clean.split("|"))))
            q["answer"] = "|".join(letters)
            
    # 3. Normalize answer representation for SINGLE_SELECT
    elif q.get("questionType") == "SINGLE_SELECT":
        ans = q.get("answer")
        if isinstance(ans, str):
            q["answer"] = ans.strip().upper()

    # 4. Repair CONSTRUCTED_RESPONSE mismatch (more answers than "___" blanks in text)
    elif q.get("questionType") == "CONSTRUCTED_RESPONSE":
        text = q.get("text", "")
        # Get primary answer strings
        answers_list = []
        options = q.get("options")
        if isinstance(options, dict) and "answers" in options:
            raw_answers = options["answers"]
            if isinstance(raw_answers, list):
                for ans in raw_answers:
                    if isinstance(ans, list):
                        answers_list.append(str(ans[0]).strip() if ans else "")
                    else:
                        answers_list.append(str(ans).strip())
        
        if not answers_list and q.get("answer"):
            answers_list = [a.strip() for a in q["answer"].split("|") if a.strip()]

        blank_count = text.count("___")
        ans_count = len(answers_list)

        if ans_count > blank_count:
            # We have more answers than blanks! Search and replace extra answer words with "___"
            parts = text.split("___")
            last_part = parts[-1]
            repaired_last_part = last_part
            
            for idx in range(blank_count, ans_count):
                ans_word = answers_list[idx]
                if not ans_word:
                    continue
                # Match full word/phrase case-insensitively using regex
                escaped = re.escape(ans_word)
                pattern = re.compile(rf"\b{escaped}\b", re.IGNORECASE)
                
                match = pattern.search(repaired_last_part)
                if match:
                    start_idx, end_idx = match.span()
                    repaired_last_part = repaired_last_part[:start_idx] + "___" + repaired_last_part[end_idx:]
                    
            # Reassemble the text
            new_text = "___".join(parts[:-1]) + "___" + repaired_last_part if len(parts) > 1 else repaired_last_part
            q["text"] = new_text

    # 5. Normalize options and answers for ORDERING questions
    elif q.get("questionType") == "ORDERING":
        opts = q.get("options")
        if isinstance(opts, dict):
            q["options"] = list(opts.values())
        elif not isinstance(opts, list):
            q["options"] = []
        q["options"] = [str(x).strip() for x in q["options"] if x is not None]

        ans = q.get("answer")
        if isinstance(ans, list):
            q["answer"] = "|".join([str(x).strip() for x in ans if x is not None])
        elif isinstance(ans, str):
            if "," in ans and "|" not in ans:
                q["answer"] = "|".join([x.strip() for x in ans.split(",")])
            else:
                q["answer"] = ans.strip()

    return q



def _analyse_options(original_question: dict) -> dict:
    """
    Extract a precise summary of the current options state from the original question.
    Returns a dict with keys: option_letters, option_count, options_repr, answer_letters.
    """
    opts = original_question.get("options")
    info = {
        "option_letters": [],
        "option_count": 0,
        "options_repr": "",
        "answer_letters": [],
    }
    if isinstance(opts, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in opts.items()):
        letters = sorted(opts.keys())
        info["option_letters"] = letters
        info["option_count"] = len(letters)
        info["options_repr"] = ", ".join(f'{l}: "{opts[l]}"' for l in letters)
        ans = original_question.get("answer", "")
        # Guard: answer can be a list (CONSTRUCTED_RESPONSE) or None — only split strings
        if isinstance(ans, str):
            info["answer_letters"] = [a.strip() for a in re.split(r"[|,]", ans) if a.strip()]
        elif isinstance(ans, list):
            info["answer_letters"] = [str(a).strip() for a in ans if a]
    return info


def _parse_target_option_count(instructions: str, current_count: int) -> tuple[str | None, int]:
    """
    Parse user instructions to detect structural changes in option counts.
    Returns a tuple of (operation_type, target_count).
    operation_type can be: 'add_to_target', 'remove_to_target', or None.
    """
    low = instructions.lower()
    
    # 1. Look for absolute target counts (e.g. "6 options", "make it 6", "has 5 options")
    num_map = {"four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8}
    
    # Check absolute count words
    for word, val in num_map.items():
        if f"{val} option" in low or f"{word} option" in low or f"make it {val}" in low or f"make it {word}" in low:
            if val > current_count:
                return "add_to_target", val
            elif val < current_count:
                return "remove_to_target", val
            else:
                return None, current_count

    # Check absolute count digits
    for val in range(4, 9):
        if f"{val} option" in low or f"make it {val}" in low or f"has {val}" in low:
            if val > current_count:
                return "add_to_target", val
            elif val < current_count:
                return "remove_to_target", val
            else:
                return None, current_count

    # 2. Look for relative additions (e.g. "add 2 options", "add two extra options")
    rel_add_map = {"one": 1, "two": 2, "three": 3, "four": 4, "1": 1, "2": 2, "3": 3, "4": 4}
    for word, val in rel_add_map.items():
        if any(p in low for p in [f"add {word} option", f"add {word} extra", f"add {word} more", f"insert {word}"]):
            return "add_to_target", current_count + val

    # Look for relative removals (e.g. "remove 2 options", "delete two options")
    for word, val in rel_add_map.items():
        if any(p in low for p in [f"remove {word} option", f"delete {word} option", f"remove {word}", f"delete {word}"]):
            return "remove_to_target", max(current_count - val, 4)

    # 3. Default fallbacks if no numbers are specified
    if any(p in low for p in ["add option", "add an option", "add more option", "add extra option", "add a new option", "add another option", "add one more", "more options", "extra option"]):
        return "add_to_target", current_count + 1

    if any(p in low for p in ["remove option", "remove an option", "remove one option", "delete option", "reduce option", "fewer option", "drop option"]):
        return "remove_to_target", max(current_count - 1, 4)

    return None, current_count


def _detect_structural_op(instructions: str) -> str | None:
    """
    Detect structural operation keywords in the instructions.
    Returns one of: 'add_option', 'remove_option', 'change_type', None.
    """
    low = instructions.lower()
    if any(p in low for p in ["add option", "add an option", "add more option", "add extra option",
                               "add a new option", "add another option", "add one more", "add option",
                               "extra option", "more options", "6 option", "5 option", "insert option"]):
        return "add_option"
    if any(p in low for p in ["remove option", "remove an option", "remove one option", "delete option",
                               "remove a option", "reduce option", "fewer option", "drop option",
                               "one less option", "remove 1", "remove one"]):
        return "remove_option"
    if any(p in low for p in ["multi select", "multiple select", "single select", "true false",
                               "change type", "change to", "convert to", "make it a"]):
        return "change_type"
    return None


def _build_regenerate_prompt(
    content_area: str,
    grade: str,
    question_type: str,
    difficulty: str,
    original_question: dict,
    modification_instructions: str,
    chunks: list[dict],
) -> str:
    """Build a focused, surgically-precise prompt for question modification."""
    import json as _json

    context_parts = []
    for chunk in chunks:
        context_parts.append(
            f"[Chunk ID: {chunk['chunk_id']} | Chapter: {chunk.get('chapter', '?')} | "
            f"Topic: {chunk.get('topic', '?')}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else \
        "(no additional excerpts — use facts already present in the original question)"

    original_str = _json.dumps(original_question, indent=2)
    format_instruction = _FORMAT_BY_TYPE.get(question_type, _FORMAT_BY_TYPE["MCQ"])

    mod_text = modification_instructions.strip() if modification_instructions and modification_instructions.strip() else ""
    opts_info = _analyse_options(original_question)
    op_type, target_count = _parse_target_option_count(mod_text, opts_info["option_count"])
    gen_op = _detect_structural_op(mod_text) if mod_text else None

    # Build a precise structural context block so the LLM cannot mis-count
    structural_ctx = ""
    if op_type == "add_to_target" and opts_info["option_count"] > 0:
        new_count = target_count
        diff = target_count - opts_info["option_count"]
        start_ord = ord(opts_info["option_letters"][-1]) + 1
        new_letters = [chr(start_ord + i) for i in range(diff)]
        structural_ctx = (
            f"\n⚑ STRUCTURAL CONTEXT (read carefully):\n"
            f"  - Current options: {opts_info['option_count']} options — letters {', '.join(opts_info['option_letters'])}\n"
            f"  - Requested change: ADD exactly {diff} new option(s)\n"
            f"  - After change: {new_count} options — letters {', '.join(opts_info['option_letters'])} + {', '.join(new_letters)}\n"
            f"  - Keep ALL {opts_info['option_count']} existing options unchanged. Only add option(s) {', '.join(new_letters)}.\n"
            f"  - Draw the new option(s) content from the syllabus excerpts or the question topic.\n"
        )
    elif op_type == "remove_to_target" and opts_info["option_count"] > 0:
        new_count = target_count
        if opts_info["option_count"] <= 4:
            structural_ctx = (
                f"\n⚑ STRUCTURAL CONTEXT (read carefully):\n"
                f"  - Current options: {opts_info['option_count']} options — letters {', '.join(opts_info['option_letters'])}\n"
                f"  - CANNOT remove: minimum allowed is 4 options.\n"
                f"  - ACTION: Keep all options unchanged. Return the question as-is.\n"
            )
        else:
            diff = opts_info["option_count"] - target_count
            remove_letters = opts_info["option_letters"][-diff:]
            keep_letters = opts_info["option_letters"][:-diff]
            structural_ctx = (
                f"\n⚑ STRUCTURAL CONTEXT (read carefully):\n"
                f"  - Current options: {opts_info['option_count']} options — letters {', '.join(opts_info['option_letters'])}\n"
                f"  - Requested change: REMOVE exactly {diff} option(s) (the last ones: {', '.join(remove_letters)})\n"
                f"  - After change: {new_count} options — letters {', '.join(keep_letters)}\n"
                f"  - ONLY remove option(s) {', '.join(remove_letters)}. Keep options {', '.join(keep_letters)} EXACTLY as they are.\n"
                f"  - If any of {', '.join(remove_letters)} were correct answers, pick the most appropriate remaining letter as the new answer.\n"
            )
    elif gen_op == "change_type" and opts_info["option_count"] > 0:
        structural_ctx = (
            f"\n⚑ STRUCTURAL CONTEXT (read carefully):\n"
            f"  - Current options: {opts_info['option_count']} options — {opts_info['options_repr']}\n"
            f"  - Requested change: CHANGE QUESTION TYPE to {question_type}\n"
            f"  - Keep the original question text EXACTLY. Keep ALL existing options EXACTLY.\n"
            f"  - Only update questionType and answer fields to match the new type.\n"
        )

    if not mod_text:
        mod_text = "Improve clarity and precision while keeping the same topic, difficulty, and question structure."

    return f"""You are a surgical assessment editor for {grade} {content_area}.

Your ONLY job is to apply the teacher's SPECIFIC modification below — change nothing else.
{structural_ctx}
ORIGINAL QUESTION (JSON):
{original_str}

TEACHER'S MODIFICATION INSTRUCTIONS:
{mod_text}

SYLLABUS EXCERPTS (for any new factual content only):
---
{context}
---

STRICT RULES:
1. Return EXACTLY 1 modified question as a JSON object (NOT an array, NOT a list).
2. Follow the {question_type} JSON format exactly (see below).
3. PRESERVE the "text" field WORD FOR WORD unless the instructions explicitly say to reword it.
4. PRESERVE all unchanged options WORD FOR WORD — do NOT alter their text.
5. If the ⚑ STRUCTURAL CONTEXT block above specifies exact counts and letters, follow those EXACTLY. They override any ambiguity.
6. Do NOT add, remove, or reorder options beyond what the instructions say.
7. Return ONLY the JSON object. No markdown, no code fences, no commentary.
8. The response must start with {{ and end with }}.

{format_instruction}

Return the single modified question JSON object now:"""


def regenerate_question(
    content_area: str,
    grade: str,
    question_type: str,
    difficulty: str,
    original_question: dict,
    modification_instructions: str,
    chunks: list[dict],
) -> tuple[dict | None, str, str, bool, str | None]:
    """
    Regenerate a single question based on an existing question + teacher instructions.

    Returns:
      (question_dict, prompt_sent, raw_response, parse_success, error_message)
    """
    prompt = _build_regenerate_prompt(
        content_area, grade, question_type, difficulty,
        original_question, modification_instructions, chunks
    )
    provider_used = LLM_PROVIDER
    raw = ""
    MAX_RETRIES = 3

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if LLM_PROVIDER == "groq":
                raw = _call_groq(prompt)
            else:
                raw = _call_gemini(prompt)
            print(f"[llm] Regenerated via {provider_used} (attempt {attempt})")

        except Exception as primary_err:
            err_str = str(primary_err)
            if LLM_PROVIDER == "gemini" and _is_quota_error(err_str):
                print(f"[llm] ⚠️  Gemini quota hit during regen — switching to Groq")
                try:
                    raw = _call_groq(prompt)
                    provider_used = "groq (auto-fallback)"
                except Exception as fallback_err:
                    return None, prompt, "", False, f"Gemini quota + Groq fallback failed: {str(fallback_err)}"
            else:
                return None, prompt, "", False, f"{provider_used.capitalize()} API error: {err_str}"

        cleaned = _clean_response(raw)

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt < MAX_RETRIES:
                print(f"[llm] ⚠️  JSON parse error on regen attempt {attempt} — retrying... [{str(e)}]")
                continue
            return None, prompt, raw, False, f"JSON parse error after {MAX_RETRIES} attempts: {str(e)}"

        # If model returned a list, unwrap the first item
        if isinstance(parsed, list):
            if len(parsed) == 0:
                return None, prompt, raw, False, "LLM returned an empty array."
            parsed = parsed[0]

        if isinstance(parsed, dict) and "error" in parsed:
            return None, prompt, raw, False, parsed["error"]

        if not isinstance(parsed, dict):
            return None, prompt, raw, False, "Expected JSON object from LLM."

        # Post-processing guard: validate option count against original for structural ops
        orig_opts = _analyse_options(original_question)
        normalized_parsed = normalize_question(parsed)
        new_opts_info = _analyse_options(normalized_parsed)
        op_type, target_count = _parse_target_option_count(modification_instructions or "", orig_opts["option_count"])

        if orig_opts["option_count"] > 0 and new_opts_info["option_count"] > 0:
            orig_count = orig_opts["option_count"]
            new_count = new_opts_info["option_count"]
            expected_count = None
            if op_type in ["add_to_target", "remove_to_target"]:
                expected_count = target_count

            if expected_count is not None and new_count != expected_count and attempt < MAX_RETRIES:
                print(
                    f"[llm] ⚠️  Option count mismatch on attempt {attempt}: "
                    f"expected {expected_count}, got {new_count}. Retrying..."
                )
                continue  # retry the LLM call

        return normalized_parsed, prompt, raw, True, None

    return None, prompt, raw, False, "Regeneration failed after all retries."





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
