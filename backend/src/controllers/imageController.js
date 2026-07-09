const fetch = require('node-fetch');

const PYTHON_SERVICE = process.env.PYTHON_LLM_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// GET /api/images/:docId/:filename
// ---------------------------------------------------------------------------
// Streams an extracted syllabus image (diagram/chart/photo) from the Python
// service. Kept behind auth (see routes/images.js) so images from a school's
// uploaded syllabus aren't publicly servable by guessing a URL.

const getImage = async (req, res) => {
  const { docId, filename } = req.params;

  // Basic path-safety: reject anything that isn't a plain filename/docId
  // (no slashes or traversal sequences) before forwarding upstream.
  if (!/^[\w-]+$/.test(docId) || !/^[\w.-]+$/.test(filename)) {
    return res.status(400).json({ message: 'Invalid image reference.' });
  }

  try {
    const pyRes = await fetch(`${PYTHON_SERVICE}/images/${docId}/${filename}`);
    if (!pyRes.ok) {
      return res.status(pyRes.status === 404 ? 404 : 502).json({ message: 'Image not found.' });
    }
    res.set('Content-Type', pyRes.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'private, max-age=3600');
    pyRes.body.pipe(res);
  } catch (err) {
    console.error('[imageController] getImage error:', err);
    res.status(503).json({ message: 'Python LLM service is unavailable.' });
  }
};

module.exports = { getImage };
