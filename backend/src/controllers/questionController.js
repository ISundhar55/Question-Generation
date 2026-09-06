const pool = require('../db');

const VALID_STATUSES = ['draft', 'ready_for_review', 'approved', 'rejected'];

// GET /api/questions?status=ready_for_review|approved|draft|rejected
const getQuestions = async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT q.*, qb.name AS bank_name
      FROM questions q
      LEFT JOIN question_banks qb ON q.bank_id = qb.id
      WHERE q.user_id = $1
    `;
    const params = [req.user.id];

    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      query += ` AND q.status = $2`;
    }

    query += ` ORDER BY q.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get questions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/questions/:id
const getQuestionById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM questions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const formatOptionsWithVisual = (options, visual) => {
  let finalOptions = options;
  if (visual) {
    if (typeof finalOptions === 'object' && finalOptions !== null && !Array.isArray(finalOptions)) {
      finalOptions = { ...finalOptions, visual };
    } else if (Array.isArray(finalOptions)) {
      finalOptions = { items: finalOptions, visual };
    } else if (!finalOptions) {
      finalOptions = { visual };
    }
  }
  return finalOptions;
};

// POST /api/questions
const createQuestion = async (req, res) => {
  const { bank_id, type, text, options, visual, answer, difficulty, points, explanation, status } = req.body;

  if (!type || !text || answer === undefined || answer === null || answer === '')
    return res.status(400).json({ message: 'type, text, and answer are required' });

  const answerVal = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
  const finalOptions = formatOptionsWithVisual(options, visual);
  const qStatus = (status && VALID_STATUSES.includes(status)) ? status : 'ready_for_review';

  try {
    const result = await pool.query(
      `INSERT INTO questions (bank_id, user_id, type, text, options, answer, difficulty, points, explanation, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        bank_id || null,
        req.user.id,
        type,
        text,
        finalOptions ? JSON.stringify(finalOptions) : null,
        answerVal,
        difficulty || 'medium',
        points || 1,
        explanation || null,
        qStatus,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/questions/bulk
const bulkCreateQuestions = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.questions;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'questions array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    for (const item of items) {
      const { bank_id, type, text, options, visual, answer, difficulty, points, explanation, status } = item;
      if (!type || !text || answer === undefined || answer === null) continue;

      const answerVal = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
      const finalOptions = formatOptionsWithVisual(options, visual);
      const qStatus = (status && VALID_STATUSES.includes(status)) ? status : 'draft';

      const resInsert = await client.query(
        `INSERT INTO questions (bank_id, user_id, type, text, options, answer, difficulty, points, explanation, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          bank_id || null,
          req.user.id,
          type,
          text,
          finalOptions ? JSON.stringify(finalOptions) : null,
          answerVal,
          difficulty || 'medium',
          points || 1,
          explanation || null,
          qStatus,
        ]
      );
      inserted.push(resInsert.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk create questions error:', err);
    res.status(500).json({ message: 'Server error during bulk question creation' });
  } finally {
    client.release();
  }
};

// PUT /api/questions/:id
const updateQuestion = async (req, res) => {
  const { type, text, options, visual, answer, difficulty, points, explanation, status } = req.body;
  const answerVal = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
  const finalOptions = formatOptionsWithVisual(options, visual);

  try {
    let query;
    let params;

    if (status && VALID_STATUSES.includes(status)) {
      query = `UPDATE questions
        SET type=$1, text=$2, options=$3, answer=$4, difficulty=$5, points=$6, explanation=$7, status=$8, updated_at=NOW()
        WHERE id=$9 AND user_id=$10
        RETURNING *`;
      params = [
        type,
        text,
        finalOptions ? JSON.stringify(finalOptions) : null,
        answerVal,
        difficulty,
        points,
        explanation || null,
        status,
        req.params.id,
        req.user.id,
      ];
    } else {
      query = `UPDATE questions
        SET type=$1, text=$2, options=$3, answer=$4, difficulty=$5, points=$6, explanation=$7, updated_at=NOW()
        WHERE id=$8 AND user_id=$9
        RETURNING *`;
      params = [
        type,
        text,
        finalOptions ? JSON.stringify(finalOptions) : null,
        answerVal,
        difficulty,
        points,
        explanation || null,
        req.params.id,
        req.user.id,
      ];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/questions/:id/status
const updateQuestionStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE questions
       SET status=$1, updated_at=NOW()
       WHERE id=$2 AND user_id=$3
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update question status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/questions/:id
const deleteQuestion = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM questions WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  bulkCreateQuestions,
  updateQuestion,
  updateQuestionStatus,
  deleteQuestion,
};
