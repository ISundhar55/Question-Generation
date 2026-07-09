import os
import sys
import time
import numpy as np
import faiss
import google.generativeai as genai

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services import embedder
from services import metadata_store
from services import vector_store

def restore():
    print("=== Re-building FAISS Index from metadata.json ===")
    
    # 1. Load all chunks and sort by faiss_idx
    metadata = metadata_store._load()
    if not metadata:
        print("Error: metadata.json is empty or not found.")
        return
        
    all_chunks = []
    for doc in metadata.values():
        for chunk in doc.get("chunks", []):
            all_chunks.append(chunk)
            
    if not all_chunks:
        print("Error: No chunks found in metadata.")
        return
        
    # Sort by faiss_idx to maintain correct row order
    all_chunks.sort(key=lambda c: c["faiss_idx"])
    
    # Check if indices are contiguous
    for i, c in enumerate(all_chunks):
        if c["faiss_idx"] != i:
            print(f"Warning: chunk index mismatch: expected {i}, got {c['faiss_idx']}. Fixing in metadata...")
            c["faiss_idx"] = i
            
    # Save metadata back if we fixed indices
    metadata_store._save(metadata)
    
    # 2. Extract texts
    texts = [c["text"] for c in all_chunks]
    print(f"Embedding {len(texts)} chunks...")
    
    # Configure Gemini API Key
    api_key = os.getenv("GEMINI_API_KEY", "")
    genai.configure(api_key=api_key)
    
    # 3. Generate embeddings with rate-limit retry
    embeddings_list = []
    batch_size = 16
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(texts)+batch_size-1)//batch_size}...")
        
        # Retry loop for rate limit
        for attempt in range(5):
            try:
                res = genai.embed_content(
                    model=embedder.EMBEDDING_MODEL,
                    content=batch,
                    task_type="retrieval_document"
                )
                embeddings_list.extend(res['embedding'])
                # Sleep a little to be gentle to the rate limit
                time.sleep(2.5)
                break
            except Exception as e:
                err_str = str(e).lower()
                is_quota = any(p in err_str for p in ["429", "quota", "rate limit", "resource_exhausted"])
                if is_quota and attempt < 4:
                    wait_time = 8 * (attempt + 1)
                    print(f"Rate limit hit. Waiting {wait_time}s before retry (attempt {attempt+1}/5)...")
                    time.sleep(wait_time)
                else:
                    raise e
                    
    # Convert to numpy array
    arr = np.array(embeddings_list, dtype="float32")
    
    # L2 normalize each row to perform cosine similarity via inner product
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    normalized_embeddings = arr / norms
    print(f"Embedding matrix shape: {normalized_embeddings.shape}")
    
    # 4. Create new index and save
    new_index = faiss.IndexFlatIP(vector_store.EMBEDDING_DIM)
    new_index.add(normalized_embeddings)
    
    # Overwrite the global in-memory index
    vector_store._index = new_index
    vector_store._save_index()
    
    print(f"=== Successfully restored FAISS index with {new_index.ntotal} vectors! ===")

if __name__ == "__main__":
    restore()
