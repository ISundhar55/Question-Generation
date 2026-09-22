const pool = require('../db');

const VALID_STATUSES = ['draft', 'ready_for_review', 'approved', 'rejected'];

// GET /api/passages
// Supports query params: status, grade, content_area, search
const getPassages = async (req, res) => {
  const { status, grade, content_area, search } = req.query;

  try {
    let query = `
      SELECT 
        p.*,
        u.name AS author_name,
        COALESCE(qc.questions_count, 0)::int AS questions_count
      FROM passages p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT passage_id, COUNT(*) AS questions_count
        FROM questions
        WHERE passage_id IS NOT NULL
        GROUP BY passage_id
      ) qc ON p.id = qc.passage_id
      WHERE p.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s));
      if (statuses.length > 0) {
        query += ` AND p.status = ANY($${paramIndex}::varchar[])`;
        params.push(statuses);
        paramIndex++;
      }
    }

    if (grade && grade.trim() !== '' && grade.toUpperCase() !== 'ALL') {
      query += ` AND LOWER(p.grade) = LOWER($${paramIndex})`;
      params.push(grade.trim());
      paramIndex++;
    }

    if (content_area && content_area.trim() !== '' && content_area.toUpperCase() !== 'ALL') {
      query += ` AND LOWER(p.content_area) = LOWER($${paramIndex})`;
      params.push(content_area.trim());
      paramIndex++;
    }

    if (search && search.trim() !== '') {
      query += ` AND (p.title ILIKE $${paramIndex} OR p.text ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get passages error:', err);
    res.status(500).json({ message: 'Server error while fetching passages' });
  }
};

// GET /api/passages/:id
const getPassageById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, COALESCE(qc.questions_count, 0)::int AS questions_count
       FROM passages p
       LEFT JOIN (
         SELECT passage_id, COUNT(*) AS questions_count
         FROM questions
         WHERE passage_id IS NOT NULL
         GROUP BY passage_id
       ) qc ON p.id = qc.passage_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Passage not found' });
    }

    // Also fetch the questions linked to this passage
    const questionsResult = await pool.query(
      `SELECT id, type, text, difficulty, status, created_at 
       FROM questions 
       WHERE passage_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [req.params.id, req.user.id]
    );

    const passage = result.rows[0];
    passage.linked_questions = questionsResult.rows;

    res.json(passage);
  } catch (err) {
    console.error('Get passage by id error:', err);
    res.status(500).json({ message: 'Server error while fetching passage' });
  }
};

// Helper to count words
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

// POST /api/passages
const createPassage = async (req, res) => {
  const {
    title,
    text,
    visual,
    genre,
    grade,
    content_area,
    word_count,
    assessment_target,
    assessment_boundaries,
    standard,
    learning_objective,
    status,
  } = req.body;

  if (!title || !text || !grade || !content_area) {
    return res.status(400).json({ message: 'title, text, grade, and content_area are required' });
  }

  const pStatus = (status && VALID_STATUSES.includes(status)) ? status : 'draft';
  const computedWords = word_count || countWords(text);

  try {
    const result = await pool.query(
      `INSERT INTO passages (
        user_id, title, text, visual, genre, grade, content_area, word_count,
        assessment_target, assessment_boundaries, standard, learning_objective, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.id,
        title.trim(),
        text.trim(),
        visual || null,
        genre || 'informational',
        grade.trim(),
        content_area.trim(),
        computedWords,
        assessment_target || null,
        assessment_boundaries || null,
        standard || null,
        learning_objective || null,
        pStatus,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create passage error:', err);
    res.status(500).json({ message: 'Server error while creating passage' });
  }
};

// POST /api/passages/bulk
const bulkCreatePassages = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.passages;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'passages array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    for (const item of items) {
      const {
        title,
        text,
        visual,
        genre,
        grade,
        content_area,
        word_count,
        assessment_target,
        assessment_boundaries,
        standard,
        learning_objective,
        status,
      } = item;

      if (!title || !text || !grade || !content_area) continue;

      const pStatus = (status && VALID_STATUSES.includes(status)) ? status : 'draft';
      const computedWords = word_count || countWords(text);

      const resInsert = await client.query(
        `INSERT INTO passages (
          user_id, title, text, visual, genre, grade, content_area, word_count,
          assessment_target, assessment_boundaries, standard, learning_objective, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          req.user.id,
          title.trim(),
          text.trim(),
          visual || null,
          genre || 'informational',
          grade.trim(),
          content_area.trim(),
          computedWords,
          assessment_target || null,
          assessment_boundaries || null,
          standard || null,
          learning_objective || null,
          pStatus,
        ]
      );
      inserted.push(resInsert.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk create passages error:', err);
    res.status(500).json({ message: 'Server error during bulk passage creation' });
  } finally {
    client.release();
  }
};

// PATCH /api/passages/:id/status
const updatePassageStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE passages 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Passage not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update passage status error:', err);
    res.status(500).json({ message: 'Server error while updating passage status' });
  }
};

// PUT /api/passages/:id
const updatePassage = async (req, res) => {
  const { title, text, visual, genre, grade, content_area, assessment_target, assessment_boundaries, status } = req.body;

  try {
    const computedWords = text ? countWords(text) : undefined;
    const result = await pool.query(
      `UPDATE passages 
       SET 
         title = COALESCE($1, title),
         text = COALESCE($2, text),
         genre = COALESCE($3, genre),
         grade = COALESCE($4, grade),
         content_area = COALESCE($5, content_area),
         word_count = COALESCE($6, word_count),
         assessment_target = COALESCE($7, assessment_target),
         assessment_boundaries = COALESCE($8, assessment_boundaries),
         status = COALESCE($9, status),
         visual = COALESCE($10, visual),
         updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [
        title ? title.trim() : null,
        text ? text.trim() : null,
        genre || null,
        grade ? grade.trim() : null,
        content_area ? content_area.trim() : null,
        computedWords,
        assessment_target || null,
        assessment_boundaries || null,
        (status && VALID_STATUSES.includes(status)) ? status : null,
        visual !== undefined ? visual : null,
        req.params.id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Passage not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update passage error:', err);
    res.status(500).json({ message: 'Server error while updating passage' });
  }
};

// DELETE /api/passages/:id
const deletePassage = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM passages WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Passage not found' });
    }

    res.json({ message: 'Passage deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('Delete passage error:', err);
    res.status(500).json({ message: 'Server error while deleting passage' });
  }
};

module.exports = {
  getPassages,
  getPassageById,
  createPassage,
  bulkCreatePassages,
  updatePassageStatus,
  updatePassage,
  deletePassage,
};
