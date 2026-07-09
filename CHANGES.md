# Changes applied to the `development` branch codebase

This was applied directly on top of the real project (as cloned from
`github.com/ISundhar55/Question-Generation`, `development` branch) — not the
earlier zip, which turned out to be an outdated personal export. Everything
below is additive: auth, DB schema, the storybook question-type editors, the
regenerate feature, and the overall UI layout/flow are untouched.

## 1. Real page/file citation
- `python-llm/services/pdf_parser.py` — every page is now tagged with a
  `<<<PAGE:N>>>` marker during extraction (the existing smart local-vs-Gemini
  OCR routing is preserved exactly); `chunk_text()` carries that page number
  through to every chunk.
- **A real bug fix, found during testing**: `_build_prompt` and
  `_build_regenerate_prompt` label context chunks with the per-document
  `chunk['chunk_id']` (0, 1, 2… reset for every file) and the LLM echoes that
  same value back in `sourceChunkIds`. `/regenerate` then used those values
  directly as FAISS ids to re-fetch chunks. Once more than one document is
  indexed for the same content area/grade, `chunk_id` collides across files —
  `/regenerate` could silently pull the wrong document's chunk. Fixed by
  overriding `chunk_id` to the globally-unique `faiss_idx` value everywhere a
  chunk list is handed to the LLM (`/generate` and `/regenerate` both), so
  citations are unambiguous regardless of how many syllabi are indexed.
- Every generated/regenerated question now returns a resolved
  `sources: [{filename, page, chapter, chunk_type}]` list.

## 2. Picture/chart/diagram-based questions
- `pdf_parser.extract_images_from_pdf()` — extracts embedded images per page
  (skipping tiny icons/decorative graphics), saves them to
  `data/images/{doc_id}/`, and generates a short caption for retrieval.
- These become their own searchable "image chunks" alongside text chunks —
  same chunking/embedding/FAISS pipeline, just `chunk_type: "image"`.
- `main.py` mounts `/images` as static files; the Node backend proxies at
  `GET /api/images/:docId/:filename` (auth-gated, matching every other route).
- Already covered by the existing `docker-compose.yml` volume mount
  (`./python-llm/data:/app/data`) — no infra changes needed for images to
  persist across container restarts.
- Images are cleaned up automatically when a syllabus is deleted (see
  "Production/scale" below).

## 3. Evaluation / grounding layer
- `services/llm.py: verify_grounding_batch()` — one extra batched LLM call
  per generation (and per regenerate) that checks whether each question+
  answer is actually supported by the syllabus excerpt it cites. Uses the
  same Gemini→Groq auto-failover as generation. Ungrounded questions are
  dropped before reaching the teacher; the UI shows how many were filtered.
  Fails open (treats as grounded) if the check itself errors, so a transient
  issue never blocks otherwise-valid output.
- Applied consistently to both `/generate` and `/regenerate` so the "passed
  fact-check" signal means the same thing everywhere in the UI.

## 4. Chapter-label bug fix (found during live testing on a real syllabus)
- Original heading regex only matched `Chapter 4` (space). Your actual PDF
  used `CHAPTER-4` (hyphen), so it never matched — every chunk's chapter
  field silently stayed on the "Introduction" default. Filtering by chapter
  still worked correctly (the existing keyword-fallback in
  `get_chunks_for` searches chunk text directly), but the *displayed*
  citation label was wrong.
- Fixed the regex to accept space/hyphen/en-dash/em-dash between the word
  and number, and added logic to merge a bare chapter-number heading with
  its immediately-following title line into one readable label
  (`"CHAPTER-4 — CELLS AND ORGANISMS"` instead of just `"CHAPTER-4"`).
  Verified against a real 36-page syllabus PDF.

## 5. Production-grade / scale-readiness cleanup
- **Removed two unused heavy dependencies** from `requirements.txt`:
  `sentence-transformers` and `pypdf`. Neither is imported anywhere —
  `embedder.py` already migrated to Gemini API embeddings, and PDF parsing
  uses PyMuPDF (`fitz`). `sentence-transformers` pulls in PyTorch (multi-GB
  install) and — per the code's own comment — was the actual cause of past
  local startup hangs on Windows. Removing it makes setup dramatically
  faster for the next person who clones this.
- **Fixed a stale hardcoded value**: `metadata_store.add_document()` recorded
  every chunk's `embedding_dimension` as `384` (leftover from the old local
  `bge-small-en-v1.5` model), while the actual Gemini embedding dimension is
  `3072`. Now pulled dynamically from `embedder.EMBEDDING_DIM`.
- **Added an in-memory read cache** to `metadata_store.py` with mtime-based
  invalidation. Previously, `metadata.json` was fully re-read and re-parsed
  from disk on *every single request* — fine for a handful of documents, but
  as a school's library grows across subjects/grades/chapters, that's
  avoidable latency on every `/generate` call. FAISS's index was already
  kept in memory as a singleton (good); metadata now matches that pattern.
- **Orphaned image cleanup**: `DELETE /syllabi/{doc_id}` now also removes
  that document's `data/images/{doc_id}/` folder, so re-uploading/replacing
  syllabi over time doesn't leave disk usage growing unbounded.
- **Noted, not changed** (flagging for a deliberate follow-up rather than
  scope-creeping this pass): `google.generativeai` is deprecated upstream in
  favor of `google.genai`. Migrating `embedder.py` and `llm.py` to the new
  SDK is worth planning for, but is a separate, larger change from what was
  asked here.
- FAISS `IndexFlatIP` (brute-force cosine search) remains appropriate at the
  scale a school's syllabus library implies (thousands, not millions, of
  chunks) — deliberately did not swap in an approximate-search index (IVF/
  HNSW), which would add complexity without a real benefit at this scale.

## What was NOT touched
- `/regenerate`'s modal-driven UX, `_build_regenerate_prompt`'s surgical
  option-count/structural guards, and the Gemini→Groq auto-failover logic —
  all already solid, left exactly as they were except for the citation-id
  fix in #1.
- Auth, question bank CRUD, DB schema, all 7 storybook question-type editors,
  overall page layout — untouched.

---

# Round 2: hallucination handling, quality scoring, security guardrails

Three items from your manager, plus scale-readiness improvements applied
proactively.

## 1. How hallucination is handled (for your manager)

Two independent layers, not one:

1. **Prevention, at generation time** — the prompt's STRICT RULES force the
   model to use only the provided syllabus excerpts, forbid outside
   knowledge, and require every question to cite which excerpt(s) it drew
   from (`sourceChunkIds`). This is a constraint on the *generating* call.
2. **Verification, after generation** — a **second, independent** LLM call
   (`verify_grounding_batch` in `services/llm.py`) re-reads each question
   against *only* its cited excerpt and scores 0.0–1.0 how well the
   question and answer are actually supported by it. This call has no
   memory of *why* the first call wrote what it wrote — it's grading the
   output cold, the same way a second teacher fact-checking a colleague's
   quiz would. Anything scoring below `GROUNDING_THRESHOLD` (default 0.6,
   configurable via env) is dropped automatically before the teacher ever
   sees it. The UI shows how many were filtered out per batch, and each
   surviving question shows its score and reasoning under "Source."

This two-call pattern (generate, then independently verify) is the standard
approach for catching hallucination in RAG systems — a single model is
much better at catching *someone else's* unsupported claim than its own.

## 2. Retrieval + generation scores

- **Retrieval**: `vector_store.py` gained `search_within_scored()`, which
  returns each retrieved chunk's cosine similarity score (not just its id).
  `/generate` now prints a console report per request:
  `[main] 📊 Retrieval report: 5 chunk(s) | avg similarity 0.812`, with a
  per-chunk breakdown. Console-only, as requested — not added to the API
  response, since it's a tuning/debugging signal, not something a teacher
  needs to see.
- **Generation**: the grounding score above (`groundingScore`, 0.0–1.0) is
  logged to console per question (`services/llm.py: _log_grounding_scores`)
  **and** returned in the API response, since it was cheap to expose and
  the frontend now shows it as a small confidence badge next to the
  fact-check status — a concrete, visible number for your manager to point
  to in the demo, not just a pass/fail.

## 3. Security guardrails

New `python-llm/services/security.py`, three layers:

- **Shared-secret auth** between the Node backend and this service
  (`INTERNAL_API_KEY` / `PYTHON_LLM_API_KEY` — must match). Every route
  requires it except `/health` (left open for the Docker healthcheck, which
  doesn't send auth headers). If unset, the service still runs (so local
  dev isn't blocked) but prints a startup warning — verified live: prints
  the warning, and 401s any request missing/mismatching the header once set.
- **Rate limiting**, in-memory sliding window, applied to the three
  cost-incurring endpoints (`/ingest`, `/generate`, `/regenerate` — these
  make paid LLM API calls) at `RATE_LIMIT_PER_MINUTE` (default 30/client/
  min). Verified live: 4th request in a 3/min-limited window correctly
  returns `429`. The Node backend also got its own rate limiting (`express-
  rate-limit`) as the outer layer, plus `helmet` for standard security
  headers (CSP, X-Frame-Options, etc.) — defense in depth, not redundant,
  since the backend is the one actually reachable from the browser.
- **Upload validation**: file type allowlist (pdf/docx/doc/txt) and a
  20MB size cap, checked before any expensive processing starts. Verified
  live: a `.exe` upload is correctly rejected with 400 before touching the
  parsing pipeline.
- **Prompt-injection guardrail**: `sanitize_user_text()` caps length (500
  chars) and logs (doesn't block — a false positive shouldn't stop a
  teacher) any of several known injection phrasings ("ignore previous
  instructions", "reveal your system prompt", fake role tags, etc.) found
  in `custom_prompt` or regenerate's `modification_instructions`. The real
  containment is structural: both prompt builders in `llm.py` now
  explicitly frame syllabus excerpts and user text as **DATA, not
  instructions**, with an explicit rule telling the model to ignore any
  embedded instructions found inside that data. No text-based filter alone
  is a complete guarantee against injection — this combination (cap +
  flag + explicit data-framing) is the realistic, right-sized defense for
  a syllabus-question tool, not a claim of perfect immunity.
- **Known trade-off, disclosed rather than silently left**: `/images` is
  served via FastAPI's `StaticFiles` mount, which doesn't support the
  same per-route `Depends()` auth used everywhere else. Images are
  reachable if someone knows the exact URL (random UUID-based filenames
  under a per-document folder), but aren't behind the internal-key check.
  They're still gated by the Node backend's own JWT auth in front of them
  for real users. If this needs to be airtight later, swap the static
  mount for a proper authenticated route handler — flagging it now rather
  than presenting it as fully closed.

## Also fixed while testing the above

Found and fixed a **broken reference** during my own testing before
shipping: `/regenerate`'s fallback retrieval path (used when a question has
no `sourceChunkIds` to re-fetch by) still called the old `search_within`
function, which was removed from `main.py`'s imports when I switched
`/generate` to the new scored version. This would have thrown a
`NameError` and 500'd any regenerate request that hit that fallback path.
Caught by an actual import + live-server test before packaging, not left
for you to find in the demo.

## Scale-readiness, applied proactively (not explicitly asked, but relevant
## to "easy to scale up" + "impress the client")

- Both new rate limiters are lightweight/in-memory by design, appropriate
  for the current single-process architecture — noted in code comments
  that a horizontally-scaled deployment would need a shared store (Redis)
  instead; not built now because it isn't needed yet and would be
  premature complexity.
- `GROUNDING_THRESHOLD` is env-configurable specifically so it can be tuned
  from real usage data post-launch without a code change/redeploy.
- All new security config has sensible defaults and fails toward "still
  runs, but warns loudly" rather than "breaks local development" — you can
  demo today without touching new env vars, and harden before a real
  deployment by filling them in.

## Before you run this
- Add the new variables to both `.env` files (see updated `.env.example`
  in each folder): `INTERNAL_API_KEY` / `PYTHON_LLM_API_KEY` (same value,
  both sides), `RATE_LIMIT_PER_MINUTE`, `MAX_UPLOAD_MB`, `ALLOWED_ORIGINS`,
  `GROUNDING_THRESHOLD` on the Python side. All optional for local dev —
  the app runs fine without them, just less hardened.
- `backend/package.json` gained two new dependencies (`helmet`,
  `express-rate-limit`) — run `npm install` in `backend/` again to pull
  them in before starting the server.

## Before you run this
- No real `.env` files were present in what you gave me (good — nothing to
  strip out this time). Copy `python-llm/.env.example` → `.env` and
  `backend/.env.example` → `.env` (the backend one was missing from the repo
  entirely — added it) and fill in your real values.
- `data/images/` and `data/prompt_logs/` are empty placeholder folders
  (`.gitkeep` only) — they populate on first upload/generation.
