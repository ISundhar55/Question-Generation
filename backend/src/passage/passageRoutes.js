const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getPassages,
  getPassageById,
  createPassage,
  bulkCreatePassages,
  updatePassageStatus,
  updatePassage,
  deletePassage,
} = require('./passageController');

router.get('/', authMiddleware, getPassages);
router.get('/:id', authMiddleware, getPassageById);
router.post('/', authMiddleware, createPassage);
router.post('/bulk', authMiddleware, bulkCreatePassages);
router.patch('/:id/status', authMiddleware, updatePassageStatus);
router.put('/:id', authMiddleware, updatePassage);
router.delete('/:id', authMiddleware, deletePassage);

module.exports = router;
