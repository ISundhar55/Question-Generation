const fetch = require('node-fetch');

const PYTHON_SERVICE = process.env.PYTHON_LLM_URL || 'http://localhost:8000';
const PYTHON_LLM_API_KEY = process.env.PYTHON_LLM_API_KEY || '';

// Shared-secret header sent on every call to the Python RAG service — must
// match INTERNAL_API_KEY in python-llm/.env. See services/security.py there
// for details; if PYTHON_LLM_API_KEY is blank here, the header is just empty
// and the Python side's own startup warning covers that case.
const internalHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Internal-Key': PYTHON_LLM_API_KEY,
});

const cleanErrorMessage = (errorMsg) => {
  if (!errorMsg || typeof errorMsg !== 'string') {
    return 'Question generation failed. Please try again.';
  }
  
  const low = errorMsg.toLowerCase();
  
  // Rate limit / Quota patterns
  if (
    low.includes('429') || 
    low.includes('rate_limit_exceeded') || 
    low.includes('rate limit') || 
    low.includes('quota') || 
    low.includes('limit exceeded') || 
    low.includes('exhausted')
  ) {
    return 'The AI service is temporarily busy due to high demand (Rate Limit Reached). Please wait a moment and try again.';
  }
  
  // Request too large
  if (low.includes('413') || low.includes('too large') || low.includes('size')) {
    return 'The syllabus content is too large to process. Please reduce the number of selected chapters or topics and try again.';
  }
  
  // Auth / Key issues — be specific to avoid false positives from Python errors
  // like "KeyError: 'field'", "keyword argument", or field names containing "key".
  if (
    low.includes('api_key') ||
    low.includes('api key') ||
    low.includes('unauthorized') ||
    /\bkey\b.*(not set|is missing|invalid|expired)/.test(low) ||
    /invalid.*(api|auth).*\bkey\b/.test(low)
  ) {
    return 'AI service configuration error. Please contact the administrator to verify the API keys.';
  }
  
  // Timeout / Offline
  if (low.includes('503') || low.includes('504') || low.includes('timeout') || low.includes('unavailable') || low.includes('connection')) {
    return 'The AI service is temporarily offline or took too long to respond. Please check your internet connection and try again.';
  }
  
  return errorMsg;
};

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

    const validTypes = ['SINGLE_SELECT', 'MULTIPLE_SELECT', 'MCQ', 'TRUE_FALSE', 'CONSTRUCTED_RESPONSE', 'DROPDOWN', 'MATCHING_LINES', 'ORDERING'];
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
        headers: internalHeaders(),
        body: JSON.stringify({ content_area, grade, chapter: chapter || null, question_type, difficulty, count: questionCount, custom_prompt: custom_prompt || null }),
      });
    } catch (err) {
      return res.status(503).json({ message: 'Python LLM service is unavailable.', detail: err.message });
    }

    const pyData = await pyRes.json();

    if (!pyRes.ok) {
      return res.status(pyRes.status).json({ message: cleanErrorMessage(pyData.detail) });
    }

    res.json(pyData);
  } catch (err) {
    console.error('[aiController] generateQuestions error:', err);
    res.status(500).json({ message: 'Server error during generation.' });
  }
};


// ---------------------------------------------------------------------------
// POST /api/ai/regenerate
// ---------------------------------------------------------------------------

const regenerateQuestion = async (req, res) => {
  try {
    const {
      content_area, grade, question_type, difficulty,
      original_question, modification_instructions, source_chunk_ids,
    } = req.body;

    // Validate required fields
    if (!content_area || !grade || !question_type || !difficulty || !original_question) {
      return res.status(400).json({
        message: 'content_area, grade, question_type, difficulty, and original_question are required.',
      });
    }

    // Normalize type (e.g. MULTI_SELECT -> MULTIPLE_SELECT)
    let normalizedType = (question_type || '').toUpperCase().trim();
    if (normalizedType === 'MULTI_SELECT') {
      normalizedType = 'MULTIPLE_SELECT';
    }

    const validTypes = ['SINGLE_SELECT', 'MULTIPLE_SELECT', 'MCQ', 'TRUE_FALSE', 'CONSTRUCTED_RESPONSE', 'DROPDOWN', 'MATCHING_LINES', 'ORDERING'];
    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({ message: `Invalid question_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({ message: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}` });
    }

    // Proxy to Python service
    let pyRes;
    try {
      pyRes = await fetch(`${PYTHON_SERVICE}/regenerate`, {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify({
          content_area,
          grade,
          question_type: normalizedType,
          difficulty,
          original_question,
          modification_instructions: modification_instructions || '',
          source_chunk_ids: source_chunk_ids || [],
        }),
      });
    } catch (err) {
      return res.status(503).json({ message: 'Python LLM service is unavailable.', detail: err.message });
    }

    const pyData = await pyRes.json();

    if (!pyRes.ok) {
      return res.status(pyRes.status).json({ message: cleanErrorMessage(pyData.detail) });
    }

    res.json(pyData);
  } catch (err) {
    console.error('[aiController] regenerateQuestion error:', err);
    res.status(500).json({ message: 'Server error during regeneration.' });
  }
};


// ---------------------------------------------------------------------------
// POST /api/ai/feedback
// ---------------------------------------------------------------------------

const submitFeedback = async (req, res) => {
  try {
    const { content_area, grade, question_type, question_text, feedback_text, rating, category, options, answer, sources } = req.body;

    if (!content_area || !grade || !question_type || !question_text || !feedback_text) {
      return res.status(400).json({
        message: 'content_area, grade, question_type, question_text, and feedback_text are required.',
      });
    }

    if (rating !== undefined && rating !== null && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'rating must be an integer between 1 and 5.' });
    }

    let pyRes;
    try {
      pyRes = await fetch(`${PYTHON_SERVICE}/feedback`, {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify({
          content_area,
          grade,
          question_type,
          question_text,
          feedback_text,
          rating: rating || null,
          category: category || null,
          options: options || null,
          answer: answer || null,
          sources: sources || []
        }),
      });
    } catch (err) {
      return res.status(503).json({ message: 'Python LLM service is unavailable.', detail: err.message });
    }

    const pyData = await pyRes.json();
    if (!pyRes.ok) {
      return res.status(pyRes.status).json({ message: cleanErrorMessage(pyData.detail) });
    }
    res.json(pyData);
  } catch (err) {
    console.error('[aiController] submitFeedback error:', err);
    res.status(500).json({ message: 'Server error while saving feedback.' });
  }
};


module.exports = { generateQuestions, regenerateQuestion, submitFeedback };

