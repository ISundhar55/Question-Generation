-- ============================================
-- Question Creation App - Database Schema
-- Run this file once to set up all tables
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Question banks table
CREATE TABLE IF NOT EXISTS question_banks (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  subject     VARCHAR(100),
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id           SERIAL PRIMARY KEY,
  bank_id      INTEGER REFERENCES question_banks(id) ON DELETE SET NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(30) NOT NULL CHECK (type IN ('SINGLE_SELECT', 'MULTIPLE_SELECT', 'MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_IN_BLANK', 'CONSTRUCTED_RESPONSE', 'DROPDOWN', 'MATCHING_LINES')),
  text         TEXT NOT NULL,
  options      JSONB,
  answer       TEXT NOT NULL,
  difficulty   VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points       INTEGER DEFAULT 1,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Seed a default admin user (password: admin123)
INSERT INTO users (name, email, password)
VALUES ('Admin', 'admin@school.com', '$2b$10$6nl9xUkax58BYAyDyKxwfuCe4N0pkIfyvS5XWgVbQkSwOIWIZV3M6')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Syllabi table (RAG pipeline)
-- ============================================
CREATE TABLE IF NOT EXISTS syllabi (
  id            SERIAL PRIMARY KEY,
  content_area  VARCHAR(100) NOT NULL,
  grade         VARCHAR(50)  NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  file_hash     VARCHAR(80)  NOT NULL UNIQUE,  -- sha256: (7) + 64 hex = 71 chars
  doc_id        VARCHAR(50)  NOT NULL,          -- matches metadata.json key
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Widen file_hash if the column was created with old VARCHAR(70) limit
DO $$ BEGIN
  ALTER TABLE syllabi ALTER COLUMN file_hash TYPE VARCHAR(80);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- Patch: Add MATCHING_LINES to question type constraint
-- Safe to run on existing databases — drops the old check and recreates it
-- ============================================
DO $$ BEGIN
  ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
  ALTER TABLE questions
    ADD CONSTRAINT questions_type_check
    CHECK (type IN (
      'SINGLE_SELECT', 'MULTIPLE_SELECT',
      'MCQ', 'TRUE_FALSE',
      'FILL_IN_BLANK',
      'CONSTRUCTED_RESPONSE', 'DROPDOWN',
      'MATCHING_LINES'
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;
