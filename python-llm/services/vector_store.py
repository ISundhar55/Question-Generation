"""
vector_store.py
---------------
FAISS IndexFlatIP wrapper.

Design decisions:
- IndexFlatIP + normalized vectors = cosine similarity (correct for bge models).
- Index is persisted to disk after every write so restarts are safe.
- faiss_idx stored in metadata.json is the integer row position in the index.
  Because we never delete individual vectors (only full doc removal rebuilds),
  this position is stable.
"""

import os
import threading
import numpy as np
import faiss

from services.embedder import EMBEDDING_DIM

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
INDEX_PATH = os.path.join(DATA_DIR, "faiss.index")

_lock = threading.Lock()
_index: faiss.IndexFlatIP | None = None


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "prompt_logs"), exist_ok=True)


def _get_index() -> faiss.IndexFlatIP:
    global _index
    if _index is None:
        _ensure_data_dir()
        metadata_path = os.path.join(DATA_DIR, "metadata.json")
        if os.path.exists(INDEX_PATH):
            try:
                print(f"[vector_store] Loading FAISS index from {INDEX_PATH}")
                loaded_index = faiss.read_index(INDEX_PATH)
                if loaded_index.d == EMBEDDING_DIM:
                    _index = loaded_index
                else:
                    print(f"[vector_store] Dimension mismatch (expected {EMBEDDING_DIM}, got {loaded_index.d}). Resetting database...")
                    if os.path.exists(INDEX_PATH):
                        os.remove(INDEX_PATH)
                    if os.path.exists(metadata_path):
                        os.remove(metadata_path)
                    _index = faiss.IndexFlatIP(EMBEDDING_DIM)
            except Exception as e:
                print(f"[vector_store] Error loading index: {e}. Re-creating.")
                _index = faiss.IndexFlatIP(EMBEDDING_DIM)
        else:
            print("[vector_store] Creating new FAISS IndexFlatIP")
            _index = faiss.IndexFlatIP(EMBEDDING_DIM)
    return _index


def _save_index():
    _ensure_data_dir()
    faiss.write_index(_get_index(), INDEX_PATH)


def add_vectors(vectors: np.ndarray) -> list[int]:
    """
    Add rows to the FAISS index.
    Returns the list of integer faiss_idx values assigned (sequential from ntotal).
    Persists the index to disk after adding.
    """
    with _lock:
        index = _get_index()
        start_idx = index.ntotal
        index.add(vectors)
        _save_index()
        return list(range(start_idx, index.ntotal))


def search(query_vector: np.ndarray, k: int = 5) -> tuple[list[float], list[int]]:
    """
    Search the index for the top-k nearest vectors.
    Returns (distances, faiss_indices).
    """
    with _lock:
        index = _get_index()
        if index.ntotal == 0:
            return [], []
        actual_k = min(k, index.ntotal)
        distances, indices = index.search(query_vector, actual_k)
        return distances[0].tolist(), indices[0].tolist()


def search_within(query_vector: np.ndarray, candidate_faiss_ids: list[int], k: int = 5) -> list[int]:
    """
    Search FAISS but only return results whose faiss_idx is in candidate_faiss_ids.
    This implements the metadata-filter-then-FAISS pattern.
    Returns up to k faiss_idx values ranked by cosine similarity.
    """
    with _lock:
        index = _get_index()
        if index.ntotal == 0 or not candidate_faiss_ids:
            return []

        # Search broader to improve recall after filtering
        search_k = min(index.ntotal, max(k * 10, len(candidate_faiss_ids)))
        distances, indices = index.search(query_vector, search_k)

        candidate_set = set(candidate_faiss_ids)
        filtered = [
            idx for idx in indices[0].tolist()
            if idx in candidate_set and idx != -1
        ]
        return filtered[:k]


def rebuild_index_without(faiss_ids_to_remove: set[int], all_vectors_by_id: dict[int, np.ndarray]):
    """
    Rebuild the FAISS index excluding the given faiss_ids.
    Called when deleting a syllabus document.
    all_vectors_by_id: {faiss_idx: vector (shape 1,384)}
    """
    global _index
    with _lock:
        new_index = faiss.IndexFlatIP(EMBEDDING_DIM)
        kept_ids = sorted(k for k in all_vectors_by_id if k not in faiss_ids_to_remove)
        if kept_ids:
            matrix = np.vstack([all_vectors_by_id[i] for i in kept_ids])
            new_index.add(matrix)
        _index = new_index
        _save_index()


def get_total() -> int:
    return _get_index().ntotal
