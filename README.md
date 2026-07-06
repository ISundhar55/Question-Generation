# Question Creator App — RAG Edition

A full-stack assessment question platform powered by a **RAG (Retrieval-Augmented Generation)** pipeline.
Educators upload syllabi → the system embeds them locally → Gemini generates curriculum-grounded questions.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite (JavaScript) |
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`) |
| Auth | JWT |
| Embedding | `BAAI/bge-small-en-v1.5` (local, HuggingFace) |
| Vector DB | FAISS (`IndexFlatIP`, cosine similarity) |
| LLM | Google Gemini (`gemini-2.5-flash`) |
| Python service | FastAPI + uvicorn |

---

## Architecture

```
Frontend (React/Vite :3005)
   │
   ▼
Backend (Node/Express :5000)   ← JWT auth, PostgreSQL
   │
   ├── POST /api/syllabus/upload  → Python /ingest
   └── POST /api/ai/generate      → Python /generate
                                           │
                                    Python FastAPI (:8000)
                                           │
                                   ┌───────┴───────┐
                                   FAISS IndexFlatIP  Gemini API
                                   + metadata.json    (gemini-1.5-flash)
```

### Admin Upload Flow
```
Upload PDF/DOCX → SHA-256 duplicate check → extract text
  → topic-boundary chunking (500-token max)
  → BAAI/bge-small-en-v1.5 embeddings (normalized)
  → FAISS IndexFlatIP + metadata.json
```

### Question Generation Flow
```
Select Content Area + Grade + Type + Difficulty + Count
  → metadata.json filter → candidate chunk IDs
  → FAISS cosine search → Top 5 chunks
  → Restrictive Gemini prompt (syllabus-only, no hallucination)
  → Structured JSON questions with sourceChunkIds
  → JSONL audit log saved to data/prompt_logs/
```

---

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.11+
- Google Gemini API key (free tier: https://aistudio.google.com)

---

### 1. Start PostgreSQL

```bash
docker-compose up -d postgres
```

---

### 2. Backend Setup

```bash
cd backend
npm install
# .env is already configured with local defaults
npm run dev
# Runs on http://localhost:5000
```

---

### 3. Python LLM Service Setup

```bash
cd python-llm

# Add your Gemini API key:
# Edit .env and set GEMINI_API_KEY=your_key_here

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
# Runs on http://localhost:8000
# API docs at http://localhost:8000/docs
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3005
```

---

### 5. Default Login

```
Email:    admin@school.com
Password: admin123
```

---

## API Reference

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/register` | Register |

### Questions
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/questions` | ✅ | List all questions |
| POST | `/api/questions` | ✅ | Create question |
| PUT | `/api/questions/:id` | ✅ | Update question |
| DELETE | `/api/questions/:id` | ✅ | Delete question |

### Syllabus (RAG)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/syllabus/upload` | ✅ | Upload PDF/DOCX syllabus |
| GET | `/api/syllabus` | ✅ | List uploaded syllabi |
| DELETE | `/api/syllabus/:id` | ✅ | Delete syllabus |

### AI Generation (RAG)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/ai/generate` | ✅ | Generate questions from syllabus |

**Generate request body:**
```json
{
  "content_area": "Mathematics",
  "grade": "Grade 6",
  "question_type": "MCQ",
  "difficulty": "medium",
  "count": 5
}
```

---

## Supported Values

| Field | Options |
|-------|---------|
| Content Area | `English Language Arts`, `Mathematics`, `Science` |
| Grade | `Grade 6`, `Grade 7`, `Grade 8`, `Grade 9` |
| Question Type | `MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `FILL_IN_BLANK` |
| Difficulty | `easy`, `medium`, `hard` |
| Count | 1 – 20 |

---

## Project Structure

```
question-app/
├── docker-compose.yml
├── backend/
│   ├── migrations.sql           ← DB schema (users, questions, syllabi)
│   ├── .env                     ← PORT, DATABASE_URL, JWT_SECRET, PYTHON_LLM_URL
│   └── src/
│       ├── index.js
│       ├── db.js
│       ├── routes/              ← auth, questions, syllabus, aiGenerate
│       ├── controllers/         ← authController, questionController,
│       │                           syllabusController, aiController
│       └── middleware/auth.js
├── python-llm/
│   ├── main.py                  ← FastAPI app (4 endpoints)
│   ├── models.py                ← Pydantic schemas
│   ├── requirements.txt
│   ├── .env                     ← GEMINI_API_KEY  ← SET THIS
│   ├── Dockerfile
│   └── services/
│       ├── embedder.py          ← BAAI/bge-small-en-v1.5 + normalize
│       ├── vector_store.py      ← FAISS IndexFlatIP
│       ├── metadata_store.py    ← metadata.json CRUD + duplicate check
│       ├── pdf_parser.py        ← PDF/DOCX + topic-aware chunking
│       ├── llm.py               ← Gemini restrictive prompt
│       └── prompt_logger.py     ← JSONL audit logs
└── frontend/
    └── src/
        ├── App.jsx
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── CreateQuestionPage.jsx
        │   ├── SyllabusPage.jsx    ← NEW: upload + manage syllabi
        │   └── AIGeneratePage.jsx  ← NEW: RAG question generation
        ├── components/Layout.jsx
        ├── services/api.js
        └── store/AuthContext.jsx
```

---

## Docker — Full Stack

```bash
# Build and start everything (PostgreSQL + Python LLM service)
docker-compose up -d --build

# Then start Node backend + frontend manually:
cd backend && npm run dev
cd frontend && npm run dev
```

---

## Debugging

- **Prompt audit logs**: `python-llm/data/prompt_logs/YYYY-MM-DD.jsonl`
- **FAISS index**: `python-llm/data/faiss.index`
- **Metadata**: `python-llm/data/metadata.json`
- **Python API docs**: http://localhost:8000/docs (Swagger UI)
