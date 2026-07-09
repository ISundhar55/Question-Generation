import os
import sys
import numpy as np
import faiss

# Add parent dir to path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services import vector_store
from services import metadata_store

def test_reconstruction():
    print("--- Testing FAISS Index Reconstruction ---")
    
    # 1. Initialize FAISS flat index
    dim = vector_store.EMBEDDING_DIM
    index = vector_store._get_index()
    
    # Clear index (for testing)
    vector_store._index = faiss.IndexFlatIP(dim)
    
    # 2. Add mock vectors
    vecs = np.random.random((5, dim)).astype("float32")
    # Normalize for cosine similarity
    for i in range(5):
        vecs[i] = vecs[i] / np.linalg.norm(vecs[i])
        
    indices = vector_store.add_vectors(vecs)
    print("Added mock vectors with indices:", indices)
    assert len(indices) == 5
    assert vector_store.get_total() == 5
    
    # Keep vectors 0, 1, 3, 4 and remove vector 2 (index 2)
    faiss_ids_to_remove = {2}
    
    # Reconstruct vectors directly from index
    old_vec_0 = vector_store._index.reconstruct(0)
    old_vec_3 = vector_store._index.reconstruct(3)
    
    print("Rebuilding index excluding index 2...")
    vector_store.rebuild_index_without(faiss_ids_to_remove)
    
    print("New total in index:", vector_store.get_total())
    assert vector_store.get_total() == 4
    
    # In the rebuilt index:
    # Old vector 0 should be at index 0
    # Old vector 3 should be at index 2 (since index 2 was removed, shifting 3 to 2)
    new_vec_0 = vector_store._index.reconstruct(0)
    new_vec_2 = vector_store._index.reconstruct(2)
    
    # Assert they are equal
    assert np.allclose(old_vec_0, new_vec_0)
    assert np.allclose(old_vec_3, new_vec_2)
    print("[SUCCESS] FAISS Vector Reconstruction and Shift Success!")

def test_metadata_shift():
    print("--- Testing Metadata Index Shifting ---")
    # Clean/Reset metadata file for test
    meta_test_path = metadata_store.METADATA_PATH
    if os.path.exists(meta_test_path):
        os.rename(meta_test_path, meta_test_path + ".bak")
        
    try:
        # Save mock metadata
        metadata_store._save({
            "doc1": {
                "doc_id": "doc1",
                "content_area": "Science",
                "grade": "Grade 6",
                "filename": "sci1.pdf",
                "file_hash": "sha256:111",
                "chunks": [
                    {"chunk_id": 0, "faiss_idx": 0, "text": "chunk 0"},
                    {"chunk_id": 1, "faiss_idx": 1, "text": "chunk 1"},
                    {"chunk_id": 2, "faiss_idx": 2, "text": "chunk 2"},
                ]
            },
            "doc2": {
                "doc_id": "doc2",
                "content_area": "Science",
                "grade": "Grade 6",
                "filename": "sci2.pdf",
                "file_hash": "sha256:222",
                "chunks": [
                    {"chunk_id": 0, "faiss_idx": 3, "text": "chunk 3"},
                    {"chunk_id": 1, "faiss_idx": 4, "text": "chunk 4"},
                ]
            }
        })
        
        # Delete doc1 (removes faiss_idx 0, 1, 2)
        removed_doc, ids_removed = metadata_store.delete_document("doc1")
        assert ids_removed == {0, 1, 2}
        
        # Load metadata and check doc2's chunk indices
        updated_data = metadata_store._load()
        assert "doc1" not in updated_data
        assert "doc2" in updated_data
        
        doc2_chunks = updated_data["doc2"]["chunks"]
        print("Updated doc2 chunks:")
        for chunk in doc2_chunks:
            print(f"  chunk_id={chunk['chunk_id']}, faiss_idx={chunk['faiss_idx']}")
            
        # Chunks 3 and 4 should be shifted to 0 and 1
        assert doc2_chunks[0]["faiss_idx"] == 0
        assert doc2_chunks[1]["faiss_idx"] == 1
        print("[SUCCESS] Metadata Index Shifting Success!")
        
    finally:
        # Restore backup metadata if any
        if os.path.exists(meta_test_path + ".bak"):
            if os.path.exists(meta_test_path):
                os.remove(meta_test_path)
            os.rename(meta_test_path + ".bak", meta_test_path)

if __name__ == "__main__":
    test_reconstruction()
    test_metadata_shift()
    print("[ALL PASSED] All Tests Passed Successfully!")
