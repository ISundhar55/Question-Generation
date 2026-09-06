const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  bulkCreateQuestions,
  updateQuestion,
  updateQuestionStatus,
  deleteQuestion,
} = require('../controllers/questionController');

router.use(auth); // all question routes require login

router.get('/', getQuestions);
router.post('/bulk', bulkCreateQuestions);
router.get('/:id', getQuestionById);
router.post('/', createQuestion);
router.put('/:id', updateQuestion);
router.patch('/:id/status', updateQuestionStatus);
router.delete('/:id', deleteQuestion);

module.exports = router;

