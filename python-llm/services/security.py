"""
security.py
------------
Security guardrails for the Python RAG service.

This service is deliberately NOT exposed to browsers directly — the Node
backend (which owns JWT auth for actual users/teachers) is the only intended
caller, reached via the internal Docker network. These guardrails exist for
defense-in-depth: if a port is ever misconfigured or exposed, or the service
gets called from somewhere unexpected, these controls limit the blast radius.

Layers implemented here:
  1. Shared-secret auth between Node backend and this service
     (INTERNAL_API_KEY) — every route except /health requires it.
  2. Lightweight in-memory rate limiting per client IP, since this service
     makes paid LLM API calls — an unbounded loop of requests is a direct
     cost/availability risk, not just a nuisance.
  3. Upload size/type validation, applied at the /ingest boundary.

None of this replaces proper network-level controls (firewall rules, Docker
network isolation) in a real deployment — it's the application-level layer
on top of those.
"""

import os
import time
import threading
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

# ---------------------------------------------------------------------------
# 1. Internal shared-secret auth
# ---------------------------------------------------------------------------

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()

if not INTERNAL_API_KEY:
    print(
        "[security] ⚠️  INTERNAL_API_KEY is not set. This service will accept "
        "requests from anyone who can reach it on the network. Set INTERNAL_API_KEY "
        "in python-llm/.env and PYTHON_LLM_API_KEY (same value) in backend/.env "
        "before deploying anywhere beyond local development."
    )


async def verify_internal_key(x_internal_key: str = Header(default="")):
    """
    FastAPI dependency — require a shared secret from the Node backend on
    every request. If INTERNAL_API_KEY isn't configured (e.g. local dev),
    this is a no-op so setup isn't blocked, but a startup warning is printed
    above so it isn't silently skipped in a real deployment.
    """
    if not INTERNAL_API_KEY:
        return  # not configured — warned at startup, don't block local dev
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid internal service credentials.")


# ---------------------------------------------------------------------------
# 2. Rate limiting (in-memory sliding window per client IP)
# ---------------------------------------------------------------------------
#
# Deliberately not using a distributed store (Redis, etc.) — this service
# runs as a single process per the current architecture, and the goal here
# is "stop an obvious runaway loop from burning API budget," not perfect
# multi-instance rate limiting. If this service is ever scaled horizontally,
# swap this for a shared store; the call sites (the dependency below) don't
# need to change.

_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))

_request_log: dict[str, deque] = defaultdict(deque)
_rate_lock = threading.Lock()


def _client_key(request: Request) -> str:
    # Prefer a forwarded header if present (behind a reverse proxy), else
    # fall back to the direct connection IP.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request):
    """
    FastAPI dependency — allow at most RATE_LIMIT_PER_MINUTE requests per
    client per rolling 60-second window on cost-incurring endpoints
    (/ingest, /generate, /regenerate). Raises 429 when exceeded.
    """
    key = _client_key(request)
    now = time.monotonic()

    with _rate_lock:
        window = _request_log[key]
        while window and now - window[0] > _RATE_LIMIT_WINDOW_SECONDS:
            window.popleft()

        if len(window) >= _RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Rate limit exceeded ({_RATE_LIMIT_MAX_REQUESTS} requests/minute). "
                    "Please wait a moment before trying again."
                ),
            )
        window.append(now)


# ---------------------------------------------------------------------------
# 3. Upload validation
# ---------------------------------------------------------------------------

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {"pdf", "docx", "doc", "txt"}


def validate_upload(filename: str, file_bytes: bytes) -> None:
    """Raises HTTPException if the upload fails basic safety checks."""
    if not filename or "." not in filename:
        raise HTTPException(status_code=400, detail="Filename must include an extension.")

    ext = filename.lower().rsplit(".", 1)[-1]
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_MB}MB upload limit."
        )
