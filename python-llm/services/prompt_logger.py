"""
prompt_logger.py
----------------
Appends one JSONL entry per generation call to a daily log file.
Stored at: data/prompt_logs/YYYY-MM-DD.jsonl

Entry format:
{
  "timestamp": "...",
  "request": { content_area, grade, question_type, difficulty, count },
  "retrieved_chunk_ids": [...],
  "prompt_sent": "...",
  "raw_response": "...",
  "parse_success": true/false,
  "error": "..."   // only if parse_success=false
}
"""

import json
import os
import threading
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
LOGS_DIR = os.path.join(DATA_DIR, "prompt_logs")

_lock = threading.Lock()


def _ensure_logs_dir():
    os.makedirs(LOGS_DIR, exist_ok=True)


def _today_log_path() -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return os.path.join(LOGS_DIR, f"{date_str}.jsonl")


def log_generation(
    request: dict,
    retrieved_chunk_ids: list[int],
    prompt_sent: str,
    raw_response: str,
    parse_success: bool,
    error: str | None = None,
):
    """Append a generation log entry (thread-safe)."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request": request,
        "retrieved_chunk_ids": retrieved_chunk_ids,
        "prompt_sent": prompt_sent,
        "raw_response": raw_response,
        "parse_success": parse_success,
    }
    if error:
        entry["error"] = error

    _ensure_logs_dir()
    with _lock:
        with open(_today_log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
