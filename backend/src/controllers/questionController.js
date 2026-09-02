const pool = require('../db');

// GET /api/questions
const getQuestions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, qb.name AS bank_name
       FROM questions q
       LEFT JOIN question_banks qb ON q.bank_id = qb.id
       WHERE q.user_id = $1
       ORDER BY q.created_at DESC`,
      [req.user.id]
    );
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

// POST /api/questions
const createQuestion = async (req, res) => {
  const { bank_id, type, text, options, visual, answer, difficulty, points, explanation } = req.body;

  if (!type || !text || answer === undefined || answer === null || answer === '')
    return res.status(400).json({ message: 'type, text, and answer are required' });

  const answerVal = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);

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

  try {
    const result = await pool.query(
      `INSERT INTO questions (bank_id, user_id, type, text, options, answer, difficulty, points, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/questions/:id
const updateQuestion = async (req, res) => {
  const { type, text, options, visual, answer, difficulty, points, explanation } = req.body;
  const answerVal = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);

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

  try {
    const result = await pool.query(
      `UPDATE questions
       SET type=$1, text=$2, options=$3, answer=$4, difficulty=$5, points=$6, explanation=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9
       RETURNING *`,
      [type, text, finalOptions ? JSON.stringify(finalOptions) : null, answerVal, difficulty, points, explanation || null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update question error:', err);
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

module.exports = { getQuestions, getQuestionById, createQuestion, updateQuestion, deleteQuestion };
