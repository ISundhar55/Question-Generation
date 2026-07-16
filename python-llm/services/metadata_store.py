"""
metadata_store.py
-----------------
Manages metadata.json — the ground truth for all ingested syllabus chunks.

metadata.json structure:
{
  "<doc_id>": {
    "doc_id": "...",
    "content_area": "Mathematics",
    "grade": "Grade 6",
    "filename": "math_grade6.pdf",
    "file_hash": "sha256:...",
    "chunks": [
      {
        "chunk_id": 0,
        "faiss_idx": 42,
        "chapter": "Fractions",
        "topic": "Improper Fractions",
        "text": "...",
        "embedding_dimension": 384
      }
    ]
  }
}
"""

import json
import os
import threading
import uuid
import hashlib
import re
from typing import Optional

from services.embedder import EMBEDDING_DIM

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
METADATA_PATH = os.path.join(DATA_DIR, "metadata.json")

_lock = threading.Lock()

# ---------------------------------------------------------------------------
# In-memory read cache
# ---------------------------------------------------------------------------
# metadata.json is re-read from disk on every single request in the naive
# version of this module. That's fine for a handful of documents, but as a
# school's syllabus library grows (multiple subjects × grades × chapters),
# re-parsing a multi-MB JSON file on every /generate call becomes real,
# avoidable latency. This cache keeps the parsed dict in memory and only
# re-reads from disk when the file's mtime OR size changes.
#
# NOTE: On Windows, NTFS timestamps have ~100ms resolution. A generate
# request arriving immediately after an ingest (within the same ~100ms
# window) could read a stale mtime and return the pre-ingest cache.
# We guard against this by ALSO comparing file size — any write that adds
# content will change the size even if the mtime appears unchanged.
_cache: dict = {}
_cache_mtime: float = -1.0
_cache_size: int = -1          # extra guard against Windows mtime granularity


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _load() -> dict:
    global _cache, _cache_mtime, _cache_size
    _ensure_data_dir()
    if not os.path.exists(METADATA_PATH):
        _cache, _cache_mtime, _cache_size = {}, -1.0, -1
        return {}

    try:
        stat = os.stat(METADATA_PATH)
        mtime = stat.st_mtime
        size  = stat.st_size
    except OSError:
        # File disappeared between exists() and stat() — return empty
        return {}

    # Invalidate cache if mtime OR size changed (guards against Windows
    # NTFS ~100ms timestamp granularity causing stale reads after ingest).
    if mtime != _cache_mtime or size != _cache_size:
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                _cache = json.load(f)
            _cache_mtime = mtime
            _cache_size  = size
        except (json.JSONDecodeError, OSError) as e:
            # If the file is mid-write (partial JSON), keep the previous
            # cache and log — next request will retry once the file is stable.
            print(f"[metadata_store] WARNING: failed to read metadata.json ({e}); using cached version.")
    return _cache


def _save(data: dict):
    global _cache, _cache_mtime, _cache_size
    _ensure_data_dir()
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    # Update cache immediately so the next _load() call within the same
    # ~100ms mtime window still sees the freshly written data.
    try:
        stat = os.stat(METADATA_PATH)
        _cache_mtime = stat.st_mtime
        _cache_size  = stat.st_size
    except OSError:
        _cache_mtime = -1.0
        _cache_size  = -1
    _cache = data


def compute_file_hash(file_bytes: bytes) -> str:
    """Compute SHA-256 hash of file content."""
    return "sha256:" + hashlib.sha256(file_bytes).hexdigest()


def check_duplicate(file_hash: str) -> Optional[str]:
    """
    Returns the doc_id of the existing document if file_hash already exists,
    otherwise returns None.
    """
    with _lock:
        data = _load()
        for doc_id, doc in data.items():
            if doc.get("file_hash") == file_hash:
                return doc_id
        return None


def new_doc_id() -> str:
    """Generate a doc_id up-front (used when image extraction needs the
    doc_id before metadata is otherwise ready to be saved)."""
    return uuid.uuid4().hex[:12]


def add_document(
    content_area: str,
    grade: str,
    filename: str,
    file_hash: str,
    chunks: list[dict],       # each: {chunk_id, faiss_idx, chapter, topic, text, page, chunk_type}
    doc_id: Optional[str] = None,
) -> str:
    """
    Persist a new document's metadata.
    Returns the doc_id (generated here if not supplied by the caller).
    """
    doc_id = doc_id or uuid.uuid4().hex[:12]
    enriched_chunks = [
        {**chunk, "embedding_dimension": EMBEDDING_DIM}
        for chunk in chunks
    ]

    with _lock:
        data = _load()
        data[doc_id] = {
            "doc_id": doc_id,
            "content_area": content_area,
            "grade": grade,
            "filename": filename,
            "file_hash": file_hash,
            "chunks": enriched_chunks,
        }
        _save(data)

    return doc_id


def get_all_syllabi() -> list[dict]:
    """Return summary info for all indexed syllabi."""
    with _lock:
        data = _load()
        return [
            {
                "doc_id": doc["doc_id"],
                "content_area": doc["content_area"],
                "grade": doc["grade"],
                "filename": doc["filename"],
                "chunk_count": len(doc["chunks"]),
            }
            for doc in data.values()
        ]


def get_document_by_id(doc_id: str) -> Optional[dict]:
    """Return the full document dict for a given doc_id, or None."""
    with _lock:
        data = _load()
        return data.get(doc_id)


def get_chunks_for(
    content_area: str,
    grade: str,
    chapter: str | None = None,
) -> tuple[list[int], list[dict]]:
    """
    Filter metadata.json by content_area + grade, and optionally by chapter.
    Returns:
      - candidate_faiss_ids: list of faiss_idx integers to search within
      - chunk_records: full chunk dicts (for text retrieval after FAISS search)
    """
    with _lock:
        data = _load()

    candidate_faiss_ids = []
    chunk_records = []      # flat list: {faiss_idx, chunk_id, chapter, topic, text, doc_id}

    for doc_id, doc in data.items():
        if (
            doc["content_area"].strip().lower() == content_area.strip().lower()
            and doc["grade"].strip().lower() == grade.strip().lower()
        ):
            for chunk in doc["chunks"]:
                # Apply optional chapter filter (case-insensitive, keyword/phrase matching across chapter, topic, and text)
                if chapter and chapter.strip():
                    query_clean = chapter.strip().lower()
                    chunk_chapter = chunk.get("chapter", "").lower()
                    chunk_topic = chunk.get("topic", "").lower()
                    chunk_text = chunk.get("text", "").lower()

                    # Direct match in chapter or topic fields is preferred
                    if query_clean in chunk_chapter or query_clean in chunk_topic:
                        pass
                    else:
                        # Otherwise, check if all query keywords are present in the combined chunk fields
                        # Filter out common short/stop words to allow flexibility in phrasing
                        stop_words = {'and', 'the', 'of', 'in', 'to', 'a', 'for', 'with', 'on', 'at', 'by', 'an', 'is', 'are', 'was', 'were'}
                        words = [w for w in re.split(r'[^a-z0-9]', query_clean) if w]
                        keywords = [w for w in words if w not in stop_words]
                        
                        # Fallback to all words if query is entirely stop words/short numbers
                        if not keywords:
                            keywords = words

                        if keywords:
                            combined = f"{chunk_chapter} {chunk_topic} {chunk_text}"
                            if not all(k in combined for k in keywords):
                                continue
                        else:
                            if query_clean not in chunk_chapter:
                                continue
                candidate_faiss_ids.append(chunk["faiss_idx"])
                chunk_records.append({
                    **chunk,
                    "doc_id": doc_id,
                })

    return candidate_faiss_ids, chunk_records


def get_chunk_texts_by_faiss_ids(faiss_ids: list[int], content_area: str, grade: str) -> list[dict]:
    """
    Given a list of faiss_idx values (result of FAISS search),
    return the full chunk records in that order.
    """
    with _lock:
        data = _load()

    faiss_to_chunk = {}
    for doc in data.values():
        if (
            doc["content_area"].lower() == content_area.lower()
            and doc["grade"].lower() == grade.lower()
        ):
            for chunk in doc["chunks"]:
                faiss_to_chunk[chunk["faiss_idx"]] = {
                    **chunk,
                    "doc_id": doc["doc_id"],
                    "filename": doc["filename"],
                }

    return [faiss_to_chunk[fi] for fi in faiss_ids if fi in faiss_to_chunk]


def delete_document(doc_id: str) -> tuple[Optional[dict], set[int]]:
    """
    Remove a document from metadata.json and shift remaining faiss_idx values
    so they stay aligned with the rebuilt FAISS index.
    Returns:
      - removed_doc: the deleted document dict or None
      - faiss_ids_to_remove: set of removed faiss_idx values
    """
    with _lock:
        data = _load()
        doc = data.pop(doc_id, None)
        if doc is None:
            return None, set()

        faiss_ids_to_remove = {chunk["faiss_idx"] for chunk in doc["chunks"]}

        # Collect all remaining chunk records to determine shift
        all_remaining_chunks = []
        for d in data.values():
            for chunk in d["chunks"]:
                all_remaining_chunks.append(chunk)

        # Sorted old IDs that are being kept
        kept_ids = sorted(chunk["faiss_idx"] for chunk in all_remaining_chunks)

        # Update metadata to map old faiss_idx -> new position in rebuilt index
        for chunk in all_remaining_chunks:
            old_idx = chunk["faiss_idx"]
            new_idx = kept_ids.index(old_idx)
            chunk["faiss_idx"] = new_idx

        _save(data)
        return doc, faiss_ids_to_remove


def get_all_faiss_vectors_map() -> dict[int, list]:
    """
    Returns {faiss_idx: chunk_text} for all chunks across all docs.
    Used during index rebuild after deletion.
    """
    with _lock:
        data = _load()
    result = {}
    for doc in data.values():
        for chunk in doc["chunks"]:
            result[chunk["faiss_idx"]] = chunk["text"]
    return result
