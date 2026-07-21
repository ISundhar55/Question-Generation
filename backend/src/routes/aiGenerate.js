const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestions, regenerateQuestion, submitFeedback, generateFromInternet } = require('../controllers/aiController');

router.use(auth);

// Generate questions from syllabus via RAG pipeline
router.post('/generate', generateQuestions);

// Generate questions from the internet (no syllabus required)
router.post('/generate-internet', generateFromInternet);

// Regenerate a single question with modification instructions
router.post('/regenerate', regenerateQuestion);

// Submit teacher feedback on a generated question
router.post('/feedback', submitFeedback);

module.exports = router;

