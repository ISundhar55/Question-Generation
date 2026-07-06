const fetch = require('node-fetch');

const PYTHON_SERVICE = process.env.PYTHON_LLM_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// POST /api/ai/generate
// ---------------------------------------------------------------------------

const generateQuestions = async (req, res) => {
  try {
    const { content_area, grade, chapter, question_type, difficulty, count, custom_prompt } = req.body;

    // Validate required fields
    if (!content_area || !grade || !question_type || !difficulty || !count) {
      return res.status(400).json({
        message: 'content_area, grade, question_type, difficulty, and count are required.',
      });
    }

    const validTypes = ['MCQ', 'TRUE_FALSE', 'CONSTRUCTED_RESPONSE', 'DROPDOWN', 'MATCHING_LINES'];
    const validDifficulties = ['easy', 'medium', 'hard'];

    if (!validTypes.includes(question_type)) {
      return res.status(400).json({ message: `Invalid question_type. Must be one of: ${validTypes.join(', ')}` });
    }

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({ message: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}` });
    }

    const questionCount = parseInt(count, 10);
    if (isNaN(questionCount) || questionCount < 1 || questionCount > 20) {
      return res.status(400).json({ message: 'count must be an integer between 1 and 20.' });
    }

    // Proxy to Python RAG service
    let pyRes;
    try {
      pyRes = await fetch(`${PYTHON_SERVICE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_area, grade, chapter: chapter || null, question_type, difficulty, count: questionCount, custom_prompt: custom_prompt || null }),
      });
    } catch (err) {
      return res.status(503).json({ message: 'Python LLM service is unavailable.', detail: err.message });
    }

    const pyData = await pyRes.json();

    if (!pyRes.ok) {
      return res.status(pyRes.status).json({ message: pyData.detail || 'Question generation failed.' });
    }

    res.json(pyData);
  } catch (err) {
    console.error('[aiController] generateQuestions error:', err);
    res.status(500).json({ message: 'Server error during generation.' });
  }
};

module.exports = { generateQuestions };
