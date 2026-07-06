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

import os
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    IngestResponse,
    SyllabiListResponse,
    SyllabusInfo,
    GenerateRequest,
    GenerateResponse,
    QuestionResult,
    DeleteResponse,
    RegenerateRequest,
    RegenerateResponse,
)
from services.pdf_parser import extract_text, chunk_text
from services.embedder import embed_texts, embed_query
from services.vector_store import add_vectors, search_within, rebuild_index_without
from services.metadata_store import (
    compute_file_hash,
    check_duplicate,
    add_document,
    get_all_syllabi,
    get_chunks_for,
    get_chunk_texts_by_faiss_ids,
    delete_document,
    get_all_faiss_vectors_map,
    get_document_by_id,
)
from services.llm import generate_questions, regenerate_question
from services.prompt_logger import log_generation

load_dotenv()

app = FastAPI(
    title="Question Generation — RAG Service",
    description="Syllabus ingestion + AI question generation via FAISS + Gemini",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

@app.post("/ingest", response_model=IngestResponse)
async def ingest_syllabus(
    file: UploadFile = File(...),
    content_area: str = Form(...),
    grade: str = Form(...),
):
    """
    Upload a syllabus PDF or DOCX.
    Pipeline: duplicate check → extract text → topic-aware chunking
              → embed (bge-small-en) → store in FAISS + metadata.json
    """
    file_bytes = await file.read()

    # Step 1: Duplicate detection
    file_hash = compute_file_hash(file_bytes)
    existing_doc_id = check_duplicate(file_hash)
    if existing_doc_id:
        # Return structured 409 so the Node backend can auto-repair
        # a missing PostgreSQL record without forcing a delete + re-upload
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

    # Step 2: Extract text
    try:
        text = extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

    # Step 3: Topic-aware chunking
    raw_chunks = chunk_text(text)
    if not raw_chunks:
        raise HTTPException(status_code=400, detail="No content chunks could be generated.")

    chunk_texts_list = [c["text"] for c in raw_chunks]

    # Step 4: Generate embeddings
    vectors = embed_texts(chunk_texts_list)

    # Step 5: Store in FAISS (returns faiss_idx for each chunk)
    faiss_indices = add_vectors(vectors)

    # Step 6: Build chunk records and store metadata
    chunks_for_meta = [
        {
            "chunk_id": i,
            "faiss_idx": faiss_indices[i],
            "chapter": raw_chunks[i].get("chapter", "General"),
            "topic": raw_chunks[i].get("topic", "General"),
            "text": raw_chunks[i]["text"],
        }
        for i in range(len(raw_chunks))
    ]

    doc_id = add_document(
        content_area=content_area,
        grade=grade,
        filename=file.filename,
        file_hash=file_hash,
        chunks=chunks_for_meta,
    )

    return IngestResponse(
        doc_id=doc_id,
        content_area=content_area,
        grade=grade,
        filename=file.filename,
        file_hash=file_hash,
        chunks_indexed=len(raw_chunks),
        message=f"Successfully ingested {len(raw_chunks)} chunks.",
    )


# ---------------------------------------------------------------------------
# GET /syllabi
# ---------------------------------------------------------------------------

@app.get("/syllabi", response_model=SyllabiListResponse)
async def list_syllabi():
    """List all indexed syllabi with summary info."""
    syllabi = get_all_syllabi()
    return SyllabiListResponse(
        syllabi=[SyllabusInfo(**s) for s in syllabi]
    )


# ---------------------------------------------------------------------------
# DELETE /syllabi/{doc_id}
# ---------------------------------------------------------------------------

@app.delete("/syllabi/{doc_id}", response_model=DeleteResponse)
async def delete_syllabus(doc_id: str):
    """
    Remove a syllabus from metadata.json and rebuild FAISS index
    excluding the deleted document's vectors.
    """
    removed_doc = delete_document(doc_id)
    if removed_doc is None:
        raise HTTPException(status_code=404, detail=f"doc_id '{doc_id}' not found.")

    # Rebuild FAISS index without the removed vectors
    faiss_ids_to_remove = {chunk["faiss_idx"] for chunk in removed_doc["chunks"]}
    remaining_texts = get_all_faiss_vectors_map()   # {faiss_idx: text}

    if remaining_texts:
        # Re-embed all remaining chunks to rebuild the index cleanly
        sorted_ids = sorted(remaining_texts.keys())
        texts = [remaining_texts[i] for i in sorted_ids]
        vectors = embed_texts(texts)
        vectors_by_id = {sorted_ids[i]: vectors[i:i+1] for i in range(len(sorted_ids))}
        rebuild_index_without(faiss_ids_to_remove, vectors_by_id)
    else:
        rebuild_index_without(faiss_ids_to_remove, {})

    return DeleteResponse(
        doc_id=doc_id,
        message=f"Syllabus '{removed_doc['filename']}' deleted and index rebuilt."
    )


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    """
    RAG pipeline:
      1. Load metadata.json → filter by content_area + grade → candidate chunk IDs
      2. Embed query → FAISS similarity search within candidates → Top 5 chunks
      3. Retrieve original text for top chunks
      4. Call Gemini with restrictive prompt
      5. Log prompt + response
      6. Return structured questions
    """
    # Step 1: Filter metadata by content_area + grade (+ optional chapter)
    candidate_faiss_ids, all_chunk_records = get_chunks_for(
        req.content_area,
        req.grade,
        chapter=req.chapter or None,
    )

    if not candidate_faiss_ids:
        chapter_hint = f" / chapter '{req.chapter}'" if req.chapter else ""
        raise HTTPException(
            status_code=404,
            detail=(
                f"No syllabus chunks found for '{req.content_area}' / '{req.grade}'{chapter_hint}. "
                "Please upload a syllabus first, or try a different chapter name."
            )
        )

    # Step 2: Embed query + FAISS search within candidates
    # Include custom_prompt in the query so topic-specific instructions
    # (e.g. "Create only from: How do I use evidence to make inferences?")
    # steer the FAISS retrieval toward the correct chunks.
    query_text = f"{req.content_area} {req.grade} {req.question_type} {req.difficulty}"
    if req.custom_prompt and req.custom_prompt.strip():
        query_text += f" {req.custom_prompt.strip()}"

    query_vector = embed_query(query_text)
    top_faiss_ids = search_within(query_vector, candidate_faiss_ids, k=5)

    # Step 3: Retrieve original chunk texts
    top_chunks = get_chunk_texts_by_faiss_ids(top_faiss_ids, req.content_area, req.grade)

    if not top_chunks:
        raise HTTPException(
            status_code=422,
            detail="Could not retrieve relevant chunks from the vector store."
        )

    # Step 4: Generate questions via Gemini
    questions_raw, prompt_sent, raw_response, parse_success, error_msg = generate_questions(
        content_area=req.content_area,
        grade=req.grade,
        question_type=req.question_type,
        difficulty=req.difficulty,
        count=req.count,
        chunks=top_chunks,
        custom_prompt=req.custom_prompt or None,
    )

    # Step 5: Log everything
    log_generation(
        request=req.model_dump(),
        retrieved_chunk_ids=[c["chunk_id"] for c in top_chunks],
        prompt_sent=prompt_sent,
        raw_response=raw_response,
        parse_success=parse_success,
        error=error_msg,
    )

    if not parse_success:
        raise HTTPException(
            status_code=422,
            detail=error_msg or "Failed to generate valid questions from Gemini."
        )

    # Step 6: Validate + return
    doc_ids_used = list({c["doc_id"] for c in top_chunks})
    questions = []
    for q in questions_raw:
        try:
            questions.append(QuestionResult(**q))
        except Exception:
            pass   # Skip malformed entries

    if not questions:
        raise HTTPException(status_code=422, detail="Gemini returned no valid questions.")

    return GenerateResponse(
        questions=questions,
        retrieved_chunk_count=len(top_chunks),
        doc_ids_used=doc_ids_used,
    )


# ---------------------------------------------------------------------------
# POST /regenerate
# ---------------------------------------------------------------------------

@app.post("/regenerate", response_model=RegenerateResponse)
async def regenerate(req: RegenerateRequest):
    """
    Regenerate a single question based on:
      - The original question JSON
      - Teacher modification instructions
      - The same syllabus chunks (identified by source_chunk_ids)
    """
    # Re-fetch the specific chunks used in the original question
    if req.source_chunk_ids:
        top_chunks = get_chunk_texts_by_faiss_ids(
            req.source_chunk_ids, req.content_area, req.grade
        )
    else:
        # Fallback: fetch top chunks by semantic search
        candidate_faiss_ids, _ = get_chunks_for(req.content_area, req.grade)
        if candidate_faiss_ids:
            q_text = f"{req.content_area} {req.grade} {req.question_type} {req.difficulty}"
            query_vector = embed_query(q_text)
            fallback_ids = search_within(query_vector, candidate_faiss_ids, k=5)
            top_chunks = get_chunk_texts_by_faiss_ids(fallback_ids, req.content_area, req.grade)
        else:
            top_chunks = []

    question_dict, prompt_sent, raw_response, parse_success, error_msg = regenerate_question(
        content_area=req.content_area,
        grade=req.grade,
        question_type=req.question_type,
        difficulty=req.difficulty,
        original_question=req.original_question,
        modification_instructions=req.modification_instructions,
        chunks=top_chunks,
    )

    log_generation(
        request={
            **req.model_dump(),
            "action": "regenerate",
        },
        retrieved_chunk_ids=[c["chunk_id"] for c in top_chunks],
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

    try:
        return RegenerateResponse(question=QuestionResult(**question_dict))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid question format returned by LLM: {str(e)}")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-llm"}
