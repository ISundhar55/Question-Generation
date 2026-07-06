"""
embedder.py
-----------
Wraps Google Gemini API (gemini-embedding-2) for text embedding.

Key design decisions:
- Replaces sentence-transformers and PyTorch to eliminate startup hang issues on Windows.
- Runs via API, reducing memory usage to near zero and server startup to <1 second.
- Normalizes embeddings to unit vectors so FAISS IndexFlatIP computes cosine similarity.
"""

import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_DIM = 3072

_gemini_configured = False


def _configure_gemini():
    global _gemini_configured
    if not _gemini_configured:
        api_key = os.getenv("GEMINI_API_KEY", "")
        genai.configure(api_key=api_key)
        _gemini_configured = True


def embed_texts(texts: list[str]) -> np.ndarray:
    """
    Embed a list of strings using Google Gemini API's gemini-embedding-2.
    Returns a float32 ndarray of shape (len(texts), EMBEDDING_DIM).
    """
    if not texts:
        return np.empty((0, EMBEDDING_DIM), dtype="float32")

    _configure_gemini()

    # Batch requests to avoid hitting payload size limits
    batch_size = 32
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        res = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=batch,
            task_type="retrieval_document"
        )
        all_embeddings.extend(res['embedding'])

    # Convert to numpy array
    arr = np.array(all_embeddings, dtype="float32")
    
    # L2 normalize each row to perform cosine similarity via inner product
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return arr / norms


def embed_query(text: str) -> np.ndarray:
    """
    Embed a single query string using Gemini embedding API.
    Returns a float32 ndarray of shape (1, EMBEDDING_DIM), normalized.
    """
    _configure_gemini()
    res = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_query"
    )
    arr = np.array([res['embedding']], dtype="float32")
    
    # L2 normalize
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return arr / norms
