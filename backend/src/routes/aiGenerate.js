const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestions } = require('../controllers/aiController');

router.use(auth);

// Generate questions from syllabus via RAG pipeline
router.post('/generate', generateQuestions);

module.exports = router;
