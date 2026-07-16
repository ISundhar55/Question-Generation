"""
main.py
-------
FastAPI entry point for the Python LLM / RAG service.

Routes:
  POST /ingest          — Upload + chunk + embed + store a syllabus
  GET  /syllabi         — List all indexed syllabi
  DELETE /syllabi/{id}  — Remove a syllabus from FAISS + metadata.json
  POST /generate        — RAG pipeline: retrieve chunks → Gemini → questions
"""

import asyncio
import os
import re
import difflib
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from models import (
    IngestResponse,
    SyllabiListResponse,
    SyllabusInfo,
    GenerateRequest,
    GenerateResponse,
    QuestionResult,
    SourceRef,
    DeleteResponse,
    RegenerateRequest,
    RegenerateResponse,
    FeedbackRequest,
    FeedbackResponse,
)
from services.pdf_parser import extract_text, chunk_text, extract_images_from_pdf, IMAGES_DIR
from services.embedder import embed_texts, embed_query
from services.vector_store import add_vectors, search_within_scored, rebuild_index_without
from services.metadata_store import (
    compute_file_hash,
    check_duplicate,
    add_document,
    new_doc_id,
    get_all_syllabi,
    get_chunks_for,
    get_chunk_texts_by_faiss_ids,
    delete_document,
    get_all_faiss_vectors_map,
    get_document_by_id,
)
from services.llm import generate_questions, regenerate_question, verify_grounding_batch, sanitize_user_text
from services.prompt_logger import log_generation
from services.security import verify_internal_key, rate_limit, validate_upload
from services.feedback_store import add_feedback as _store_feedback, get_all_feedback

load_dotenv()

RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "5"))

# ---------------------------------------------------------------------------
# Chapter extraction from natural-language instructions
# ---------------------------------------------------------------------------
# Teachers write instructions like:
#   "Create the question from the chapter: Integration of Knowledge and Ideas"
#   "Only use chapter Key Ideas and Details"
#   "from chapter: Fractions"
# We parse the chapter name out and apply it as a real chunk filter in
# get_chunks_for(), not just as an LLM hint — so the FAISS search is already
# restricted to the right chapter before generation begins.

_CHAPTER_INSTRUCTION_PATTERNS = [
    # "from the chapter/topic: / - / – / — / <nothing> <name>"
    re.compile(r'from\s+the\s+(?:chapter|topic)\s*[:\-\u2013\u2014]?\s*["\']?([^.!?\n"\' ][^.!?\n"\']{1,120}?)["\']?\s*[.!?]?\s*$',
               re.IGNORECASE | re.MULTILINE),
    # "from chapter/topic: / - / – / — / <nothing> <name>"
    re.compile(r'from\s+(?:chapter|topic)\s*[:\-\u2013\u2014]?\s*["\']?([^.!?\n"\' ][^.!?\n"\']{1,120}?)["\']?\s*[.!?]?\s*$',
               re.IGNORECASE | re.MULTILINE),
    # "chapter/topic: / - / – / — / <nothing> <name>"  and  "only from/use chapter/topic ..."
    re.compile(r'(?:only\s+(?:from|use)\s+)?(?:chapter|topic)\s*[:\-\u2013\u2014]?\s*["\']?([^.!?\n"\' ][^.!?\n"\']{1,120}?)["\']?\s*[.!?]?\s*$',
               re.IGNORECASE | re.MULTILINE),
]


def _extract_chapter_from_instruction(instruction: str | None) -> str | None:
    """
    Parse a chapter name from a free-text teacher instruction.
    Returns the trimmed chapter name if found, otherwise None.

    Handles patterns like:
      "Create questions from the chapter: Integration of Knowledge and Ideas"
      "from chapter Key Ideas and Details"
      "chapter: Fractions"
    """
    if not instruction or not instruction.strip():
        return None
    for pattern in _CHAPTER_INSTRUCTION_PATTERNS:
        m = pattern.search(instruction)
        if m:
            extracted = m.group(1).strip().rstrip('."\'').strip()
            if len(extracted) >= 3:   # sanity-check: at least 3 chars
                return extracted
    return None

app = FastAPI(
    title="Question Generation — RAG Service",
    description="Syllabus ingestion + AI question generation via FAISS + Gemini",
    version="1.0.0",
)

# CORS is permissive by default because this service is meant to be called
# server-to-server (by the Node backend), not from a browser — but it's
# configurable so a deployment can lock it down if this service is ever
# reachable from anywhere a browser could hit it directly.
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
_allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()] or ["*"]
if _allowed_origins == ["*"]:
    print("[main] ⚠️  ALLOWED_ORIGINS not set — CORS is wide open (*). Set it in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve extracted diagram/chart/photo images so the frontend can display the
# exact source image behind a picture-based question. Node backend proxies
# /api/images/* to this path (see backend/src/controllers/imageController.js).
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


def _resolve_sources_and_images(question_dict: dict, chunks_by_faiss_id: dict) -> tuple[list, list]:
    """
    Given a question's sourceChunkIds (globally-unique faiss_idx values) and
    the chunk pool used for this request, build the resolved SourceRef list
    (file/page/chapter for cross-verification) and any image URLs the
    question drew from.
    """
    source_ids = question_dict.get("sourceChunkIds") or []
    sources: list[SourceRef] = []
    image_refs: list[str] = []
    seen = set()

    for cid in source_ids:
        chunk = chunks_by_faiss_id.get(cid)
        if not chunk:
            continue
        dedup_key = (chunk["doc_id"], chunk.get("page"), chunk.get("chunk_type"))
        if dedup_key not in seen:
            seen.add(dedup_key)
            sources.append(SourceRef(
                doc_id=chunk["doc_id"],
                filename=chunk["filename"],
                chapter=chunk.get("chapter"),
                page=chunk.get("page"),
                chunk_type=chunk.get("chunk_type", "text"),
            ))
        if chunk.get("chunk_type") == "image" and chunk.get("image_path"):
            url = f"/images/{chunk['image_path']}"
            if url not in image_refs:
                image_refs.append(url)

    return sources, image_refs


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

@app.post("/ingest", response_model=IngestResponse, dependencies=[Depends(verify_internal_key), Depends(rate_limit)])
async def ingest_syllabus(
    file: UploadFile = File(...),
    content_area: str = Form(...),
    grade: str = Form(...),
):
    """
    Upload a syllabus PDF or DOCX.
    Pipeline: duplicate check → extract text (+ embedded images for PDFs)
              → topic-aware chunking → embed → store in FAISS + metadata.json
    """
    file_bytes = await file.read()

    # Security guardrail: reject oversized/wrong-type/empty uploads before
    # any expensive processing (text extraction, embedding, LLM calls) runs.
    validate_upload(file.filename, file_bytes)

    # Step 1: Duplicate detection
    file_hash = compute_file_hash(file_bytes)
    existing_doc_id = check_duplicate(file_hash)
    if existing_doc_id:
        existing_doc = get_document_by_id(existing_doc_id) or {}
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"This file has already been uploaded (doc_id: {existing_doc_id}). "
                    "Delete the existing entry before re-uploading."
                ),
                "doc_id": existing_doc_id,
                "file_hash": file_hash,
                "chunks_indexed": len(existing_doc.get("chunks", [])),
                "content_area": existing_doc.get("content_area", content_area),
                "grade": existing_doc.get("grade", grade),
                "filename": existing_doc.get("filename", file.filename),
                "already_indexed": True,
            }
        )

    # doc_id is generated up-front (rather than after add_document) because
    # extracted images need a stable folder name — data/images/{doc_id}/ —
    # before metadata is saved.
    doc_id = new_doc_id()

    # Step 2: Extract text
    try:
        text = extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

    # Step 3: Topic-aware chunking (text)
    raw_chunks = chunk_text(text)
    if not raw_chunks:
        raise HTTPException(status_code=400, detail="No content chunks could be generated.")

    # Step 3b: Extract embedded images (diagrams/charts/photos) for PDFs only,
    # so picture-based questions can retrieve and display the exact source image.
    image_chunks: list[dict] = []
    is_pdf = file.filename.lower().endswith(".pdf")
    if is_pdf:
        try:
            image_chunks = extract_images_from_pdf(file_bytes, doc_id)
            # Back-fill chapter/topic on each image chunk using the nearest
            # text chunk on the same (or closest preceding) page, so image
            # chunks aren't stuck under a generic "General" chapter.
            page_to_chapter = {
                c["page"]: (c["chapter"], c["topic"])
                for c in raw_chunks if c.get("page") is not None
            }
            sorted_pages = sorted(page_to_chapter.keys())
            for img in image_chunks:
                page = img["page"]
                if page in page_to_chapter:
                    img["chapter"], img["topic"] = page_to_chapter[page]
                else:
                    prior = [p for p in sorted_pages if p <= page]
                    if prior:
                        img["chapter"], img["topic"] = page_to_chapter[max(prior)]
        except Exception as e:
            print(f"[main] ⚠️ Image extraction failed (continuing with text-only ingestion): {e}")
            image_chunks = []

    # Step 4: Merge text + image chunks, embed, store
    all_chunks = raw_chunks + image_chunks
    chunk_texts_list = [c["text"] for c in all_chunks]

    vectors = embed_texts(chunk_texts_list)
    faiss_indices = add_vectors(vectors)

    chunks_for_meta = [
        {
            "chunk_id": i,
            "faiss_idx": faiss_indices[i],
            "chapter": all_chunks[i].get("chapter", "General"),
            "topic": all_chunks[i].get("topic", "General"),
            "text": all_chunks[i]["text"],
            "page": all_chunks[i].get("page"),
            "chunk_type": all_chunks[i].get("chunk_type", "text"),
            "image_path": all_chunks[i].get("image_path"),
        }
        for i in range(len(all_chunks))
    ]

    doc_id = add_document(
        content_area=content_area,
        grade=grade,
        filename=file.filename,
        file_hash=file_hash,
        chunks=chunks_for_meta,
        doc_id=doc_id,
    )

    return IngestResponse(
        doc_id=doc_id,
        content_area=content_area,
        grade=grade,
        filename=file.filename,
        file_hash=file_hash,
        chunks_indexed=len(all_chunks),
        message=(
            f"Successfully ingested {len(raw_chunks)} text chunks"
            + (f" and {len(image_chunks)} images." if image_chunks else ".")
        ),
    )


# ---------------------------------------------------------------------------
# GET /syllabi
# ---------------------------------------------------------------------------

@app.get("/syllabi", response_model=SyllabiListResponse, dependencies=[Depends(verify_internal_key)])
async def list_syllabi():
    """List all indexed syllabi with summary info."""
    syllabi = get_all_syllabi()
    return SyllabiListResponse(
        syllabi=[SyllabusInfo(**s) for s in syllabi]
    )


# ---------------------------------------------------------------------------
# DELETE /syllabi/{doc_id}
# ---------------------------------------------------------------------------

@app.delete("/syllabi/{doc_id}", response_model=DeleteResponse, dependencies=[Depends(verify_internal_key)])
async def delete_syllabus(doc_id: str):
    """
    Remove a syllabus from metadata.json and rebuild FAISS index
    excluding the deleted document's vectors.
    """
    removed_doc, faiss_ids_to_remove = delete_document(doc_id)
    if removed_doc is None:
        raise HTTPException(status_code=404, detail=f"doc_id '{doc_id}' not found.")

    # Rebuild FAISS index without the removed vectors
    rebuild_index_without(faiss_ids_to_remove)

    # Clean up any extracted images for this document so disk usage doesn't
    # grow unbounded as syllabi are replaced/re-uploaded over time.
    doc_images_dir = os.path.join(IMAGES_DIR, doc_id)
    if os.path.isdir(doc_images_dir):
        import shutil
        try:
            shutil.rmtree(doc_images_dir)
        except Exception as e:
            print(f"[main] ⚠️ Failed to remove image directory for {doc_id}: {e}")

    return DeleteResponse(
        doc_id=doc_id,
        message=f"Syllabus '{removed_doc['filename']}' deleted and index rebuilt."
    )


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate the similarity ratio between two text strings (0.0 - 1.0) after cleaning."""
    if not text1 or not text2:
        return 0.0
    t1 = " ".join(re.sub(r'[^a-zA-Z0-9\s]', '', text1).lower().split())
    t2 = " ".join(re.sub(r'[^a-zA-Z0-9\s]', '', text2).lower().split())
    if not t1 or not t2:
        return 0.0
    return difflib.SequenceMatcher(None, t1, t2).ratio()


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

@app.post("/generate", response_model=GenerateResponse, dependencies=[Depends(verify_internal_key), Depends(rate_limit)])
async def generate(req: GenerateRequest):
    """
    RAG pipeline:
      1. Load metadata.json → filter by content_area + grade → candidate chunk IDs
      2. Embed query → FAISS similarity search within candidates → Top 5 chunks
      3. Retrieve original text for top chunks
      4. Call Gemini with restrictive prompt
      5. Evaluation layer: batched grounding check — drop unsupported questions
      6. Log prompt + response
      7. Resolve each question's sourceChunkIds → exact file/page/image citation
      8. Return structured questions
    """
    # Security guardrail: cap length + flag obvious prompt-injection
    # patterns in the teacher-supplied free-text field before it touches
    # the query embedding or the LLM prompt.
    clean_custom_prompt = sanitize_user_text(req.custom_prompt, field_name="custom_prompt")

    # Parse a chapter filter from the instruction if the teacher wrote something
    # like "from the chapter: Integration of Knowledge and Ideas".
    # This is applied as a real FAISS-level chunk filter, not just an LLM hint.
    chapter_filter = req.chapter or _extract_chapter_from_instruction(clean_custom_prompt)

    # Step 1: Filter metadata by content_area + grade (+ parsed chapter if any)
    candidate_faiss_ids, all_chunk_records = get_chunks_for(
        req.content_area,
        req.grade,
        chapter=chapter_filter,
    )

    if not candidate_faiss_ids:
        chapter_hint = f" / chapter '{chapter_filter}'" if chapter_filter else ""
        raise HTTPException(
            status_code=404,
            detail=(
                f"No syllabus chunks found for '{req.content_area}' / '{req.grade}'{chapter_hint}. "
                "Please upload a syllabus first, or try a different chapter name."
            )
        )

    # Step 2: Embed query + FAISS search within candidates
    query_text = f"{req.content_area} {req.grade} {req.question_type} {req.difficulty}"
    if clean_custom_prompt:
        query_text += f" {clean_custom_prompt}"

    # Run blocking Gemini embedding call off the event loop so uvicorn stays
    # responsive while the API round-trip completes (avoids CancelledError on Windows).
    query_vector = await asyncio.to_thread(embed_query, query_text)
    scored_results = search_within_scored(query_vector, candidate_faiss_ids, k=RETRIEVAL_K)
    top_faiss_ids = [fid for fid, _score in scored_results]

    # Console-level retrieval quality report (per manager request — not
    # currently surfaced in the API response, just visibility for tuning).
    if scored_results:
        avg_score = sum(s for _, s in scored_results) / len(scored_results)
        print(f"[main] 📊 Retrieval report: {len(scored_results)} chunk(s) | avg similarity {avg_score:.3f}")
        for fid, score in scored_results:
            print(f"[main]    faiss_idx={fid}  similarity={score:.3f}")

    # Step 3: Retrieve original chunk texts (includes filename/page/chunk_type)
    top_chunks = get_chunk_texts_by_faiss_ids(top_faiss_ids, req.content_area, req.grade)

    if not top_chunks:
        raise HTTPException(
            status_code=422,
            detail="Could not retrieve relevant chunks from the vector store."
        )

    # Use faiss_idx (globally unique across every uploaded document) as the
    # id the LLM cites in sourceChunkIds — NOT the per-document chunk_id,
    # which repeats (0, 1, 2...) across different files and would make
    # citations ambiguous (and /regenerate's chunk re-fetch silently wrong)
    # once more than one syllabus is uploaded for the same content area/grade.
    chunks_for_prompt = [{**c, "chunk_id": c["faiss_idx"]} for c in top_chunks]
    chunks_by_faiss_id = {c["faiss_idx"]: c for c in top_chunks}

    # Step 4: Generate questions via Gemini — runs in thread pool so the
    # synchronous google.generativeai call doesn't block the event loop.
    questions_raw, prompt_sent, raw_response, parse_success, error_msg = await asyncio.to_thread(
        generate_questions,
        content_area=req.content_area,
        grade=req.grade,
        question_type=req.question_type,
        difficulty=req.difficulty,
        count=req.count,
        chunks=chunks_for_prompt,
        custom_prompt=clean_custom_prompt or None,
    )

    if not parse_success:
        log_generation(
            request=req.model_dump(),
            retrieved_chunk_ids=[c["faiss_idx"] for c in top_chunks],
            prompt_sent=prompt_sent,
            raw_response=raw_response,
            parse_success=parse_success,
            error=error_msg,
        )
        raise HTTPException(
            status_code=422,
            detail=error_msg or "Failed to generate valid questions from Gemini."
        )

    # Step 4.5: Deduplicate within the generated batch
    unique_questions = []
    duplicate_dropped = 0
    for q in questions_raw:
        q_text = q.get("text", "").strip()
        if not q_text:
            continue
        is_dup = False
        for accepted_q in unique_questions:
            sim = calculate_similarity(q_text, accepted_q.get("text", ""))
            if sim > 0.80:
                is_dup = True
                print(f"[main] ⚠️ Duplicate detected inside batch: similarity {sim:.3f}")
                print(f"   Q1: {accepted_q.get('text')!r}")
                print(f"   Q2: {q_text!r}")
                break
        if is_dup:
            duplicate_dropped += 1
        else:
            unique_questions.append(q)
    questions_raw = unique_questions

    # Step 5: Evaluation layer — batched grounding check (also blocking; runs in thread)
    grounding_results = await asyncio.to_thread(verify_grounding_batch, questions_raw, chunks_by_faiss_id)

    processed_questions = []
    ungrounded_dropped = 0
    for q, g in zip(questions_raw, grounding_results):
        q["_grounded"] = g["grounded"]
        q["_grounding_score"] = g.get("score", 1.0)
        q["_grounding_note"] = g.get("reason")
        if not g["grounded"]:
            ungrounded_dropped += 1
        processed_questions.append(q)

    # ── Per-question console report ──────────────────────────────────────────
    # Always printed regardless of whether the grounding LLM call succeeded or
    # fell back to fail-open (score=1.0).  Gives the developer full visibility
    # into what was generated and how each question scored.
    passed = sum(1 for q in processed_questions if q["_grounded"])
    print(
        f"[main] 📋 Generation report: {len(processed_questions)} question(s) generated | "
        f"{passed} passed grounding | {ungrounded_dropped} will be dropped"
    )
    for i, q in enumerate(processed_questions):
        flag = "✅ PASS" if q["_grounded"] else "❌ DROP"
        score = q["_grounding_score"]
        q_text = q.get("text", "")
        preview = (q_text[:90] + "…") if len(q_text) > 90 else q_text
        print(f"[main]   Q{i+1} [{flag}] score={score:.2f} | {preview!r}")
        if not q["_grounded"] and q.get("_grounding_note"):
            print(f"[main]        reason: {q['_grounding_note']}")
    # ────────────────────────────────────────────────────────────────────────


    # Sort questions so passed ones are first, failed ones are at the end
    passed_questions = [q for q in processed_questions if q["_grounded"]]
    failed_questions = [q for q in processed_questions if not q["_grounded"]]
    sorted_questions = passed_questions + failed_questions

    # Step 6: Log everything
    error_parts = []
    if duplicate_dropped:
        error_parts.append(f"{duplicate_dropped} duplicate(s) dropped")
    if ungrounded_dropped:
        error_parts.append(f"{ungrounded_dropped} ungrounded dropped")

    log_generation(
        request=req.model_dump(),
        retrieved_chunk_ids=[c["faiss_idx"] for c in top_chunks],
        prompt_sent=prompt_sent,
        raw_response=raw_response,
        parse_success=parse_success,
        error=", ".join(error_parts) if error_parts else None,
    )

    # Step 7: Resolve citations (file/page/chapter) + image refs, build QuestionResult
    questions: list[QuestionResult] = []
    for q in sorted_questions:
        sources, image_refs = _resolve_sources_and_images(q, chunks_by_faiss_id)
        try:
            questions.append(QuestionResult(
                **{k: v for k, v in q.items() if k not in ("_grounded", "_grounding_score", "_grounding_note")},
                sources=sources,
                imageRefs=image_refs,
                grounded=q.get("_grounded", True),
                groundingScore=q.get("_grounding_score", 1.0),
                groundingNote=q.get("_grounding_note"),
            ))
        except Exception as e:
            print(f"[main] ⚠️ Skipped malformed question from LLM: {e}")

    if not questions:
        raise HTTPException(status_code=422, detail="Gemini returned no valid questions.")

    doc_ids_used = list({s.doc_id for q in questions for s in q.sources}) or \
        list({c["doc_id"] for c in top_chunks})

    return GenerateResponse(
        questions=questions,
        retrieved_chunk_count=len(top_chunks),
        doc_ids_used=doc_ids_used,
        ungrounded_dropped=ungrounded_dropped,
        duplicate_dropped=duplicate_dropped,
    )


# ---------------------------------------------------------------------------
# POST /regenerate
# ---------------------------------------------------------------------------

@app.post("/regenerate", response_model=RegenerateResponse, dependencies=[Depends(verify_internal_key), Depends(rate_limit)])
async def regenerate(req: RegenerateRequest):
    """
    Regenerate a single question based on:
      - The original question JSON
      - Teacher modification instructions
      - The same syllabus chunks (identified by source_chunk_ids, which are
        faiss_idx values — see the note in /generate about why these must be
        globally unique rather than per-document chunk_id)
    """
    # req.source_chunk_ids are faiss_idx values (as returned in the original
    # question's sourceChunkIds by /generate), so this lookup is exact even
    # when multiple documents are indexed for the same content_area/grade.
    if req.source_chunk_ids:
        top_chunks = get_chunk_texts_by_faiss_ids(
            req.source_chunk_ids, req.content_area, req.grade
        )
    else:
        # Fallback: fetch top chunks by semantic search
        candidate_faiss_ids, _ = get_chunks_for(req.content_area, req.grade)
        if candidate_faiss_ids:
            q_text = f"{req.content_area} {req.grade} {req.question_type} {req.difficulty}"
            query_vector = await asyncio.to_thread(embed_query, q_text)
            fallback_ids = [fid for fid, _score in search_within_scored(query_vector, candidate_faiss_ids, k=RETRIEVAL_K)]
            top_chunks = get_chunk_texts_by_faiss_ids(fallback_ids, req.content_area, req.grade)
        else:
            top_chunks = []

    # Same citation-safety remap as /generate: the LLM must cite faiss_idx
    # values, not per-document chunk_id, so the resolved sources below (and
    # any future regenerate-of-a-regenerate) stay correct.
    chunks_for_prompt = [{**c, "chunk_id": c["faiss_idx"]} for c in top_chunks]
    chunks_by_faiss_id = {c["faiss_idx"]: c for c in top_chunks}

    # Security guardrail: same sanitization as custom_prompt in /generate.
    clean_mod_instructions = sanitize_user_text(req.modification_instructions, field_name="modification_instructions")

    # Regenerate — same blocking-call concern as generate; run in thread pool.
    question_dict, prompt_sent, raw_response, parse_success, error_msg = await asyncio.to_thread(
        regenerate_question,
        content_area=req.content_area,
        grade=req.grade,
        question_type=req.question_type,
        difficulty=req.difficulty,
        original_question=req.original_question,
        modification_instructions=clean_mod_instructions,
        chunks=chunks_for_prompt,
    )

    if parse_success and question_dict is not None and top_chunks:
        # Same lightweight fact-check applied to fresh generations — keeps
        # the "passed automated fact-check" signal consistent regardless of
        # whether a question came from /generate or a regenerate pass.
        grounding_results = await asyncio.to_thread(verify_grounding_batch, [question_dict], chunks_by_faiss_id)
        g = grounding_results[0] if grounding_results else {"grounded": True, "reason": None}
        question_dict["_grounded"] = g["grounded"]
        question_dict["_grounding_score"] = g.get("score", 1.0)
        question_dict["_grounding_note"] = g.get("reason")

    log_generation(
        request={
            **req.model_dump(),
            "action": "regenerate",
        },
        retrieved_chunk_ids=[c["faiss_idx"] for c in top_chunks],
        prompt_sent=prompt_sent,
        raw_response=raw_response,
        parse_success=parse_success,
        error=error_msg,
    )

    if not parse_success or question_dict is None:
        raise HTTPException(
            status_code=422,
            detail=error_msg or "Failed to regenerate question."
        )

    sources, image_refs = _resolve_sources_and_images(question_dict, chunks_by_faiss_id)
    try:
        # The LLM may echo back fields from the original_question JSON it saw in
        # the prompt (grounded, groundingScore, sources, imageRefs). Strip them
        # before unpacking so we don't get "multiple values for keyword argument".
        _exclude = {
            "_grounded", "_grounding_score", "_grounding_note",
            "sources", "imageRefs", "grounded", "groundingScore", "groundingNote",
        }
        clean_dict = {k: v for k, v in question_dict.items() if k not in _exclude}
        return RegenerateResponse(question=QuestionResult(
            **clean_dict,
            sources=sources,
            imageRefs=image_refs,
            grounded=question_dict.get("_grounded", True),
            groundingScore=question_dict.get("_grounding_score", 1.0),
            groundingNote=question_dict.get("_grounding_note"),
        ))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid question format returned by LLM: {str(e)}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-llm"}


# ---------------------------------------------------------------------------
# POST /feedback
# ---------------------------------------------------------------------------

@app.post("/feedback", response_model=FeedbackResponse, dependencies=[Depends(verify_internal_key)])
async def submit_feedback(req: FeedbackRequest):
    """
    Persist teacher feedback about a generated question.
    Feedback is stored in data/feedback.json and injected into future
    generation prompts so the LLM learns from past corrections.
    """
    clean_text = sanitize_user_text(req.feedback_text, field_name="feedback_text")
    if not clean_text.strip():
        raise HTTPException(status_code=400, detail="feedback_text must not be empty.")

    entry = await asyncio.to_thread(
        _store_feedback,
        content_area=req.content_area,
        grade=req.grade,
        question_type=req.question_type,
        question_text=req.question_text,
        feedback_text=clean_text,
        rating=req.rating,
        category=req.category,
        options=req.options,
        answer=req.answer,
        sources=[s.model_dump() if hasattr(s, 'model_dump') else s for s in (req.sources or [])],
    )
    return FeedbackResponse(
        id=entry["id"],
        message="Feedback recorded. It will be considered in the next generation request.",
    )


@app.get("/feedback", dependencies=[Depends(verify_internal_key)])
async def get_feedback():
    """Return all stored feedback (admin/debug use)."""
    entries = await asyncio.to_thread(get_all_feedback)
    return {"count": len(entries), "entries": entries}
