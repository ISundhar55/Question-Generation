"""
pdf_parser.py
-------------
Extracts text from PDF and DOCX files, then splits into topic-aware chunks.

Chunking strategy (priority order):
  1. Topic boundary detection — split at heading patterns (Chapter, Topic,
     Learning Objective, numbered sections, ALL-CAPS lines, etc.)
  2. 500-token hard cap — if a topic section is too long, slide-split it
     with 50-token overlap.
  3. Fallback — if no headings detected, pure sliding-window 500/50.

Each chunk carries: chapter, topic, text.
"""

import re
from typing import Optional

import docx
import fitz
from services.llm import transcribe_page_image


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from a PDF file using multimodal Gemini transcription.
    Renders pages as images to capture tables, diagrams, and graphs.
    Falls back to normal PyMuPDF text extraction if the API call fails.
    """
    import io
    
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    
    print(f"[pdf_parser] Processing PDF with {len(doc)} pages")
    
    for i, page in enumerate(doc):
        page_num = i + 1
        
        # Extract local text first (takes < 5ms)
        local_text = (page.get_text() or "").strip()
        
        # Check if the page contains images or tables (for scanned OCR fallback)
        has_images = len(page.get_images()) > 0
        has_tables = False
        try:
            has_tables = len(page.find_tables().tables) > 0
        except Exception:
            pass
            
        # We only fall back to Gemini multimodal OCR if the page has no extractable text
        # (scanned PDF page) but contains visual contents (images/tables).
        is_scanned_ocr = len(local_text) < 150 and (has_images or has_tables)
        
        if not is_scanned_ocr:
            print(f"[pdf_parser] Page {page_num}/{len(doc)} extracted locally in milliseconds.")
            pages.append(local_text)
        else:
            print(f"[pdf_parser] Page {page_num}/{len(doc)} has low extractable text but contains images/tables. Ingesting via Gemini Multimodal...")
            try:
                # Render page as PNG image at 150 DPI
                pix = page.get_pixmap(dpi=150)
                image_bytes = pix.tobytes("png")
                
                # Send to Gemini for multimodal transcription
                page_text = transcribe_page_image(image_bytes)
                pages.append(page_text)
            except Exception as e:
                # Fallback to local text extraction for this page
                print(f"[pdf_parser] ⚠️ Page {page_num} multimodal failed: {e}. Falling back to local text extraction.")
                pages.append(local_text)
            
    return "\n\n".join(pages)


def _format_docx_table_as_markdown(table) -> str:
    """Format a python-docx Table object as a Markdown table."""
    rows = []
    for row in table.rows:
        row_text = [cell.text.strip().replace("\n", " ") for cell in row.cells]
        rows.append(row_text)
        
    if not rows:
        return ""
        
    # Build Markdown table
    col_count = len(rows[0])
    markdown_lines = []
    
    # Header
    markdown_lines.append("| " + " | ".join(rows[0]) + " |")
    # Divider
    markdown_lines.append("| " + " | ".join(["---"] * col_count) + " |")
    # Data Rows
    for row in rows[1:]:
        if len(row) < col_count:
            row.extend([""] * (col_count - len(row)))
        elif len(row) > col_count:
            row = row[:col_count]
        markdown_lines.append("| " + " | ".join(row) + " |")
        
    return "\n" + "\n".join(markdown_lines) + "\n"


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract all text from a DOCX file, including tables in Markdown format."""
    import io
    from docx.text.paragraph import Paragraph
    from docx.table import Table

    doc = docx.Document(io.BytesIO(file_bytes))
    body_elements = []
    
    # Iterate through body elements in logical reading order
    for element in doc.element.body:
        if element.tag.endswith('p'):
            p = Paragraph(element, doc)
            if p.text.strip():
                body_elements.append(p.text.strip())
        elif element.tag.endswith('tbl'):
            table = Table(element, doc)
            markdown_table = _format_docx_table_as_markdown(table)
            if markdown_table:
                body_elements.append(markdown_table)
                
    return "\n\n".join(body_elements)


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Dispatch to the correct extractor based on file extension."""
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file format: .{ext}")


# ---------------------------------------------------------------------------
# Heading detection
# ---------------------------------------------------------------------------

# Patterns that signal a new Chapter / Topic / Section heading
_HEADING_PATTERNS = [
    re.compile(r"^\s*chapter\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*unit\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*topic\s*[:\-–]", re.IGNORECASE),
    re.compile(r"^\s*lesson\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*learning\s+objective", re.IGNORECASE),
    re.compile(r"^\s*\d+\.\s+[A-Z]"),           # "1. Introduction"
    re.compile(r"^\s*\d+\.\d+\s+[A-Za-z]"),     # "1.1 Fractions"
    re.compile(r"^[A-Z][A-Z\s]{5,}$"),           # ALL CAPS heading
]

_CHAPTER_PATTERNS = [
    re.compile(r"^\s*chapter\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*unit\s+\d+", re.IGNORECASE),
]


def _is_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return any(p.match(stripped) for p in _HEADING_PATTERNS)


def _is_chapter(line: str) -> bool:
    stripped = line.strip()
    return any(p.match(stripped) for p in _CHAPTER_PATTERNS)


# ---------------------------------------------------------------------------
# Tokenisation (word-level, simple)
# ---------------------------------------------------------------------------

def _word_count(text: str) -> int:
    return len(text.split())


# ---------------------------------------------------------------------------
# Sliding-window split for oversized sections
# ---------------------------------------------------------------------------

MAX_TOKENS = 500
OVERLAP_TOKENS = 50


def _split_long_text(text: str, chapter: str, topic: str) -> list[dict]:
    """Split text that exceeds MAX_TOKENS with overlap."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + MAX_TOKENS, len(words))
        chunk_text = " ".join(words[start:end])
        chunks.append({"chapter": chapter, "topic": topic, "text": chunk_text})
        if end == len(words):
            break
        start = end - OVERLAP_TOKENS
    return chunks


# ---------------------------------------------------------------------------
# Topic-aware chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str) -> list[dict]:
    """
    Split text into chunks using heading detection first,
    then enforce the 500-token max with 50-token overlap.

    Returns list of dicts: {chapter, topic, text}
    """
    lines = text.splitlines()

    sections = []          # [{chapter, topic, lines: []}]
    current_chapter = "Introduction"
    current_topic = "General"
    current_lines: list[str] = []

    for line in lines:
        if _is_heading(line):
            # Save previous section
            if current_lines:
                sections.append({
                    "chapter": current_chapter,
                    "topic": current_topic,
                    "lines": current_lines,
                })
                current_lines = []

            stripped = line.strip()
            if _is_chapter(stripped):
                current_chapter = stripped
                current_topic = stripped
            else:
                current_topic = stripped
        else:
            if line.strip():
                current_lines.append(line)

    # Don't forget the last section
    if current_lines:
        sections.append({
            "chapter": current_chapter,
            "topic": current_topic,
            "lines": current_lines,
        })

    # Enforce 500-token max
    final_chunks: list[dict] = []
    for section in sections:
        section_text = " ".join(section["lines"])
        if _word_count(section_text) <= MAX_TOKENS:
            if section_text.strip():
                final_chunks.append({
                    "chapter": section["chapter"],
                    "topic": section["topic"],
                    "text": section_text.strip(),
                })
        else:
            final_chunks.extend(
                _split_long_text(section_text, section["chapter"], section["topic"])
            )

    # Fallback: if no structure found at all, sliding window
    if not final_chunks:
        final_chunks = _split_long_text(text, "General", "General")

    return final_chunks
