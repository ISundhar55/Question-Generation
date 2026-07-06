const pool = require('../db');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const path = require('path');

const PYTHON_SERVICE = process.env.PYTHON_LLM_URL || 'http://localhost:8000';

// Multer — store in memory, validate file type
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are supported.'));
    }
  },
});

// ---------------------------------------------------------------------------
// POST /api/syllabus/upload
// ---------------------------------------------------------------------------

const uploadSyllabus = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file provided.' });
      }

      const { content_area, grade } = req.body;
      if (!content_area || !grade) {
        return res.status(400).json({ message: 'content_area and grade are required.' });
      }

      // Forward file + metadata to Python service
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      form.append('content_area', content_area);
      form.append('grade', grade);

      let pyRes;
      try {
        pyRes = await fetch(`${PYTHON_SERVICE}/ingest`, {
          method: 'POST',
          body: form,
          headers: form.getHeaders(),
        });
      } catch (err) {
        return res.status(503).json({ message: 'Python LLM service is unavailable.', detail: err.message });
      }

      const pyData = await pyRes.json();

      if (!pyRes.ok) {
        const detail = pyData.detail || {};

        // ── 409: file already in FAISS. Auto-repair if DB record is missing ──
        if (pyRes.status === 409 && detail.already_indexed) {
          const existing = await pool.query(
            'SELECT id FROM syllabi WHERE file_hash = $1',
            [detail.file_hash]
          );

          if (existing.rows.length === 0) {
            // DB record was lost (e.g. table didn't exist during first upload)
            // — save it now so the UI can see it
            await pool.query(
              `INSERT INTO syllabi (content_area, grade, filename, file_hash, doc_id, uploaded_by)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                detail.content_area,
                detail.grade,
                detail.filename,
                detail.file_hash,
                detail.doc_id,
                req.user.id,
              ]
            );
            return res.status(201).json({
              message: `Syllabus already indexed in FAISS — record recovered successfully.`,
              doc_id: detail.doc_id,
              chunks_indexed: detail.chunks_indexed,
              content_area: detail.content_area,
              grade: detail.grade,
              filename: detail.filename,
              recovered: true,
            });
          }

          // Already in both FAISS and DB — genuine duplicate
          return res.status(409).json({ message: detail.message });
        }

        // Other errors (400, 503, …)
        return res.status(pyRes.status).json({ message: detail.message || detail || 'Ingestion failed.' });
      }

      // Persist record in PostgreSQL
      await pool.query(
        `INSERT INTO syllabi (content_area, grade, filename, file_hash, doc_id, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (file_hash) DO NOTHING`,
        [content_area, grade, req.file.originalname, pyData.file_hash, pyData.doc_id, req.user.id]
      );

      res.status(201).json({
        message: pyData.message,
        doc_id: pyData.doc_id,
        chunks_indexed: pyData.chunks_indexed,
        content_area,
        grade,
        filename: req.file.originalname,
      });
    } catch (err) {
      console.error('[syllabusController] uploadSyllabus error:', err);
      res.status(500).json({ message: 'Server error during upload.' });
    }
  },
];

// ---------------------------------------------------------------------------
// GET /api/syllabus
// ---------------------------------------------------------------------------

const listSyllabi = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, content_area, grade, filename, doc_id, created_at
       FROM syllabi
       WHERE uploaded_by = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[syllabusController] listSyllabi error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/syllabus/:id
// ---------------------------------------------------------------------------

const deleteSyllabus = async (req, res) => {
  try {
    // Fetch the record first to get doc_id
    const result = await pool.query(
      'SELECT * FROM syllabi WHERE id = $1 AND uploaded_by = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Syllabus not found.' });
    }

    const { doc_id } = result.rows[0];

    // Call Python service to remove from FAISS + metadata.json
    try {
      const pyRes = await fetch(`${PYTHON_SERVICE}/syllabi/${doc_id}`, { method: 'DELETE' });
      if (!pyRes.ok && pyRes.status !== 404) {
        const pyData = await pyRes.json();
        return res.status(pyRes.status).json({ message: pyData.detail || 'Python deletion failed.' });
      }
    } catch (err) {
      console.warn('[syllabusController] Python service unreachable during delete:', err.message);
      // Continue with DB deletion even if Python is unavailable
    }

    await pool.query('DELETE FROM syllabi WHERE id = $1', [req.params.id]);
    res.json({ message: 'Syllabus deleted successfully.' });
  } catch (err) {
    console.error('[syllabusController] deleteSyllabus error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { uploadSyllabus, listSyllabi, deleteSyllabus };
