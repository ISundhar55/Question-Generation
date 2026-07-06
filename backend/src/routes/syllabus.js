const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadSyllabus, listSyllabi, deleteSyllabus } = require('../controllers/syllabusController');

router.use(auth);

// List all syllabi uploaded by the current user
router.get('/', listSyllabi);

// Upload a new syllabus (multipart/form-data)
router.post('/upload', uploadSyllabus);

// Delete a syllabus by PostgreSQL id
router.delete('/:id', deleteSyllabus);

module.exports = router;
