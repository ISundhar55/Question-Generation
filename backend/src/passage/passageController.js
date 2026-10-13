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
    content_approved,
    fairness_approved,
  } = req.body;

  if (!title || !text || !grade || !content_area) {
    return res.status(400).json({ message: 'title, text, grade, and content_area are required' });
  }

  let cApp = content_approved !== undefined ? Boolean(content_approved) : false;
  let fApp = fairness_approved !== undefined ? Boolean(fairness_approved) : false;
  let pStatus = (status && VALID_STATUSES.includes(status)) ? status : 'draft';
  if (pStatus === 'approved' && !cApp && !fApp) {
    cApp = true;
    fApp = true;
  } else if (cApp || fApp) {
    pStatus = 'approved';
  }
  const computedWords = word_count || countWords(text);

  try {
    const result = await pool.query(
      `INSERT INTO passages (
        user_id, title, text, visual, genre, grade, content_area, word_count,
        assessment_target, assessment_boundaries, standard, learning_objective, status,
        content_approved, fairness_approved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        cApp,
        fApp,
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

// PATCH /api/passages/:id/status or PATCH /api/passages/:id/review
const updatePassageStatus = async (req, res) => {
  const { status, review_type, reviewType, approved } = req.body;
  const type = (review_type || reviewType || '').toLowerCase();

  try {
    // 1. Independent Review Flow: 'content' or 'fairness'
    if (type === 'content' || type === 'fairness') {
      const isApproved = approved !== undefined ? Boolean(approved) : true;
      const current = await pool.query(
        `SELECT content_approved, fairness_approved, status FROM passages WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ message: 'Passage not found' });
      }

      const newContent = type === 'content' ? isApproved : Boolean(current.rows[0].content_approved);
      const newFairness = type === 'fairness' ? isApproved : Boolean(current.rows[0].fairness_approved);
      
      // Rule: Approving EITHER ONE is enough to unlock the passage (status = 'approved')!
      const newStatus = (newContent || newFairness) ? 'approved' : 'ready_for_review';

      const result = await pool.query(
        `UPDATE passages 
         SET content_approved = $1, fairness_approved = $2, status = $3, updated_at = NOW() 
         WHERE id = $4 AND user_id = $5 
         RETURNING *`,
        [newContent, newFairness, newStatus, req.params.id, req.user.id]
      );

      return res.json(result.rows[0]);
    }

    // 2. Direct Status Update Flow (e.g. 'rejected', 'ready_for_review', or legacy 'approved')
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    let setContent = null;
    let setFairness = null;

    if (status === 'approved') {
      // Legacy blanket approve: mark both as approved
      setContent = true;
      setFairness = true;
    } else if (status === 'rejected' || status === 'draft' || status === 'ready_for_review') {
      setContent = false;
      setFairness = false;
    }

    const result = await pool.query(
      `UPDATE passages 
       SET 
         status = $1, 
         content_approved = COALESCE($2, content_approved),
         fairness_approved = COALESCE($3, fairness_approved),
         updated_at = NOW() 
       WHERE id = $4 AND user_id = $5 
       RETURNING *`,
      [status, setContent, setFairness, req.params.id, req.user.id]
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
  const {
    title,
    text,
    visual,
    genre,
    grade,
    content_area,
    assessment_target,
    assessment_boundaries,
    status,
    content_approved,
    fairness_approved,
  } = req.body;

  try {
    const computedWords = text ? countWords(text) : undefined;

    let computedStatus = (status && VALID_STATUSES.includes(status)) ? status : null;
    if (content_approved !== undefined || fairness_approved !== undefined) {
      const cApp = content_approved !== undefined ? Boolean(content_approved) : false;
      const fApp = fairness_approved !== undefined ? Boolean(fairness_approved) : false;
      if (cApp || fApp) {
        computedStatus = 'approved';
      }
    }

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
         content_approved = COALESCE($11, content_approved),
         fairness_approved = COALESCE($12, fairness_approved),
         updated_at = NOW()
       WHERE id = $13 AND user_id = $14
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
        computedStatus,
        visual !== undefined ? visual : null,
        content_approved !== undefined ? Boolean(content_approved) : null,
        fairness_approved !== undefined ? Boolean(fairness_approved) : null,
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
