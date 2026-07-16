const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const syllabusRoutes = require('./routes/syllabus');
const aiRoutes = require('./routes/aiGenerate');
const imageRoutes = require('./routes/images');

const app = express();

// Security headers (CSP, X-Frame-Options, etc.) — standard baseline hardening.
app.use(helmet());
app.use(cors());
app.use(express.json());

// General API rate limit — protects against abuse/scraping across all routes.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});
app.use('/api', generalLimiter);

// Tighter limit specifically on AI generation — these calls cost real money
// (LLM API usage) and are the most attractive target for abuse.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI generation rate limit reached. Please wait a moment before trying again.' },
});
app.use('/api/ai', aiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
