import os
import sys
import time
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services import embedder
from services import vector_store
from services import metadata_store
from services import llm

def diagnose():
    provider = os.getenv("LLM_PROVIDER", "gemini")
    enable_grounding = os.getenv("ENABLE_GROUNDING_CHECK", "True").lower() == "true"
    k_val = int(os.getenv("RETRIEVAL_K", "5"))

    print(f"=== Starting Latency Diagnosis (Provider: {provider}, Grounding: {enable_grounding}, K: {k_val}) ===")
    
    # 1. Test Metadata filtering & search candidate retrieval
    t0 = time.time()
    candidates, records = metadata_store.get_chunks_for("Science", "Grade 6")
    t_meta = time.time() - t0
    print(f"1. Metadata Filter: {t_meta:.4f}s ({len(candidates)} chunks found)")
    
    if not candidates:
        print("Error: No chunks found in database. Ingest a syllabus first to run diagnosis.")
        return

    # 2. Test Query Embedding
    t0 = time.time()
    query_text = "Science Grade 6 MCQ medium photosynthesis"
    query_vector = embedder.embed_query(query_text)
    t_embed = time.time() - t0
    print(f"2. Query Embedding API Call: {t_embed:.4f}s")

    # 3. Test FAISS Search
    t0 = time.time()
    scored_results = vector_store.search_within_scored(query_vector, candidates, k=k_val)
    t_faiss = time.time() - t0
    print(f"3. FAISS Vector Search: {t_faiss:.4f}s (results: {len(scored_results)})")

    # 4. Test Text Retrieval by FAISS IDs
    t0 = time.time()
    top_faiss_ids = [fid for fid, _ in scored_results]
    top_chunks = metadata_store.get_chunk_texts_by_faiss_ids(top_faiss_ids, "Science", "Grade 6")
    chunks_for_prompt = [{**c, "chunk_id": c["faiss_idx"]} for c in top_chunks]
    chunks_by_faiss_id = {c["faiss_idx"]: c for c in top_chunks}
    t_retrieve = time.time() - t0
    print(f"4. Chunk text retrieval: {t_retrieve:.4f}s")

    # 5. Test LLM Question Generation
    print(f"5. Calling {provider} for question generation (generating 3 MCQs)...")
    t0 = time.time()
    questions_raw, prompt_sent, raw_response, parse_success, error_msg = llm.generate_questions(
        content_area="Science",
        grade="Grade 6",
        question_type="MCQ",
        difficulty="medium",
        count=3,
        chunks=chunks_for_prompt,
        custom_prompt="Include photosynthesis"
    )
    t_gen = time.time() - t0
    print(f"   => Question Generation complete: {t_gen:.4f}s (parsed: {parse_success}, count: {len(questions_raw)})")

    if not parse_success or not questions_raw:
        print(f"Error generating questions: {error_msg}")
        return

    # 6. Test Grounding Verification
    print(f"6. Running Grounding Verification (enabled={enable_grounding})...")
    t0 = time.time()
    grounding_results = llm.verify_grounding_batch(questions_raw, chunks_by_faiss_id)
    t_ground = time.time() - t0
    print(f"   => Grounding check complete: {t_ground:.4f}s")
    
    total = t_meta + t_embed + t_faiss + t_retrieve + t_gen + t_ground
    print(f"\n=== LATENCY SUMMARY ===")
    print(f"Embedding:   {t_embed:.2f}s ({t_embed/total*100:.1f}%)")
    print(f"Generation:  {t_gen:.2f}s ({t_gen/total*100:.1f}%)")
    print(f"Grounding:   {t_ground:.2f}s ({t_ground/total*100:.1f}%)")
    print(f"Other:       {t_meta+t_faiss+t_retrieve:.2f}s")
    print(f"Total Time:  {total:.2f}s")

if __name__ == "__main__":
    diagnose()
