const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestions, regenerateQuestion } = require('../controllers/aiController');

router.use(auth);

// Generate questions from syllabus via RAG pipeline
router.post('/generate', generateQuestions);

// Regenerate a single question with modification instructions
router.post('/regenerate', regenerateQuestion);

module.exports = router;

