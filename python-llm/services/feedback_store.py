"""
feedback_store.py
-----------------
Persistent storage and retrieval of teacher feedback on generated questions.

Feedback is written to data/feedback.json (one JSON array, newest entries last).
The most recent relevant entries are injected into future generation prompts so
the LLM can learn from past teacher corrections without retraining.
"""

import json
import os
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Storage configuration
# ---------------------------------------------------------------------------

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FEEDBACK_FILE = os.path.join(_DATA_DIR, "feedback.json")

# How many entries to inject per generation prompt (keeps prompt size sane)
MAX_FEEDBACK_IN_PROMPT = 8

# Hard cap on file growth — oldest entries are trimmed when exceeded
MAX_FEEDBACK_STORED = 1000


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load() -> list[dict]:
    if not os.path.exists(FEEDBACK_FILE):
        return []
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(entries: list[dict]) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def add_feedback(
    content_area: str,
    grade: str,
    question_type: str,
    question_text: str,
    feedback_text: str,
    rating: int | None = None,
    category: str | None = None,
    options: dict | list | None = None,
    answer: str | None = None,
    sources: list | None = None,
) -> dict:
    """
    Persist one feedback entry.  Returns the stored entry dict (including its id).
    """
    entries = _load()
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "content_area": content_area,
        "grade": grade,
        "question_type": question_type,
        # Cap stored question text to keep file size manageable
        "question_text": (question_text or "")[:300],
        "options": options,                             # dict (MCQ/CR) | list (ORDERING) | None
        "answer": (answer or "")[:200] or None,        # correct answer string
        "sources": sources or [],                       # [{doc_id, filename, chapter, page}, ...]
        "feedback_text": (feedback_text or "").strip()[:600],
        "rating": rating,          # int 1-5, or None
        "category": category or "general",
    }
    entries.append(entry)
    # Trim oldest entries when cap is exceeded
    if len(entries) > MAX_FEEDBACK_STORED:
        entries = entries[-MAX_FEEDBACK_STORED:]
    _save(entries)
    print(f"[feedback] Stored feedback {entry['id']} for {content_area} / {grade}")
    return entry


def get_recent_feedback(
    content_area: str,
    grade: str,
    limit: int = MAX_FEEDBACK_IN_PROMPT,
) -> list[dict]:
    """
    Return the most recent feedback entries relevant to this content_area + grade.
    Falls back to any grade (same content_area) if not enough specific entries exist.
    """
    entries = _load()
    if not entries:
        return []

    # Exact match: same content_area AND same grade
    specific = [
        e for e in entries
        if e.get("content_area", "").strip().lower() == content_area.strip().lower()
        and e.get("grade", "").strip().lower() == grade.strip().lower()
    ]

    # Broader match: same content_area, any grade (top-up if specific entries are few)
    if len(specific) < 4:
        broader = [
            e for e in entries
            if e.get("content_area", "").strip().lower() == content_area.strip().lower()
            and e not in specific
        ]
        combined = specific + broader
    else:
        combined = specific

    return combined[-limit:]   # most recent first


def format_feedback_for_prompt(content_area: str, grade: str) -> str:
    """
    Build the feedback block that gets injected into the generation prompt.
    Returns an empty string when no feedback is available.
    """
    entries = get_recent_feedback(content_area, grade)
    if not entries:
        return ""

    lines = []
    for i, e in enumerate(entries, 1):
        category = (e.get("category") or "general").upper()
        q_type   = e.get("question_type") or "?"
        text     = (e.get("feedback_text") or "").strip()
        rating   = e.get("rating")
        rating_str = f" [Rating: {rating}/5]" if isinstance(rating, int) else ""
        lines.append(f"  [{i}] {category} | {q_type}{rating_str}: {text}")

    block = (
        "TEACHER FEEDBACK FROM PREVIOUS SESSIONS\n"
        "(These are real comments from teachers about past questions for this "
        "subject/grade. Apply these insights to avoid repeating the same mistakes):\n"
        + "\n".join(lines)
    )
    return block


def get_all_feedback() -> list[dict]:
    """Return all stored feedback entries (for admin/debug use)."""
    return _load()
