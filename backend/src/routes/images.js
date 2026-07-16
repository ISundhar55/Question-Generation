const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getImage } = require('../controllers/imageController');

router.use(auth);

// Serve extracted syllabus images (diagrams/charts/photos) used as
// picture-based question sources.
router.get('/:docId/:filename', getImage);

module.exports = router;
