# This directory stores persisted FAISS index, metadata, and extracted images.
# Contents are generated at runtime — do NOT delete this file.
# 
# Files created here:
#   faiss.index      — FAISS IndexFlatIP vector store
#   metadata.json    — chunk metadata (content_area, grade, chapter, topic,
#                       text, page, chunk_type, image_path)
#   images/{doc_id}/ — embedded diagrams/charts/photos extracted from each
#                       PDF at ingest time, served at GET /images/{doc_id}/{file}
#                       (proxied by the Node backend at /api/images/...)
#   prompt_logs/     — daily JSONL audit logs of Gemini prompts + responses
