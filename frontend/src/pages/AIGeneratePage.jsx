import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { aiAPI, questionsAPI } from '../services/api';
import { MarkdownText } from 'question-storybook-ui';

const CONTENT_AREAS = ['English Language Arts', 'Mathematics', 'Science'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Multiple Choice (Single Select)', icon: '🔘', desc: '4 options, one correct answer' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Choice (Multiple Select)', icon: '✅', desc: '4-6 options, one or more correct answers' },
  { value: 'TRUE_FALSE', label: 'True / False', icon: '⚖️', desc: 'Statement judged true or false' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', icon: '✏️', desc: 'Type the answer for each blank' },
  { value: 'DROPDOWN', label: 'Dropdown', icon: '📋', desc: 'Select answer for each blank from a list' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', icon: '🔗', desc: 'Match Column A items to Column B' },
  { value: 'ORDERING', label: 'Ordering', icon: '↕️', desc: 'Drag options to place them in correct order' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: '#15803d', bg: '#f0fdf4' },
  { value: 'medium', label: 'Medium', color: '#92400e', bg: '#fffbeb' },
  { value: 'hard', label: 'Hard', color: '#991b1b', bg: '#fef2f2' },
];

const TYPE_META = {
  SINGLE_SELECT: { color: '#4f6ef7', bg: '#eef1fe' },
  MULTIPLE_SELECT: { color: '#3b82f6', bg: '#dbeafe' },
  MCQ: { color: '#4f6ef7', bg: '#eef1fe' },
  TRUE_FALSE: { color: '#22c55e', bg: '#f0fdf4' },
  SHORT_ANSWER: { color: '#f59e0b', bg: '#fffbeb' },
  FILL_IN_BLANK: { color: '#a855f7', bg: '#faf5ff' },   // kept for legacy display
  CONSTRUCTED_RESPONSE: { color: '#7c3aed', bg: '#f5f3ff' },
  DROPDOWN: { color: '#0e7490', bg: '#ecfeff' },
  MATCHING_LINES: { color: '#0891b2', bg: '#ecfeff' },
  ORDERING: { color: '#db2777', bg: '#fdf2f8' },
};

/** Parse "A-2, B-4, C-1, D-3" → { A: '2', B: '4', C: '1', D: '3' } */
function parseMatchingAnswer(answerStr) {
  if (!answerStr) return {};
  const result = {};
  answerStr.split(',').forEach(pair => {
    const [left, right] = pair.trim().split('-');
    if (left && right) result[left.trim()] = right.trim();
  });
  return result;
}

export default function AIGeneratePage() {
  const navigate = useNavigate();

  // Form state
  const [contentArea, setContentArea] = useState(CONTENT_AREAS[0]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [questionType, setQuestionType] = useState('SINGLE_SELECT');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [savingAll, setSavingAll] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [showSource, setShowSource] = useState({});   // {idx: bool}

  // Regenerate modal state
  const [regenModal, setRegenModal] = useState(null); // null | { idx, question }
  const [regenInstructions, setRegenInstructions] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(null);

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState(null); // null | { question }
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  // Stats from last generation
  const [genMeta, setGenMeta] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setQuestions([]);
    setSavedIds(new Set());
    setGenMeta(null);

    try {
      const res = await aiAPI.generate({
        content_area: contentArea,
        grade,
        question_type: questionType,
        difficulty,
        count,
        custom_prompt: customPrompt.trim() || undefined,
      });
      setQuestions(res.data.questions || []);
      setGenMeta({
        retrieved_chunk_count: res.data.retrieved_chunk_count,
        doc_ids_used: res.data.doc_ids_used,
        ungrounded_dropped: res.data.ungrounded_dropped || 0,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed. Please check that a syllabus has been uploaded for this Content Area and Grade.');
    } finally {
      setGenerating(false);
    }
  };

  const saveQuestion = async (q, idx) => {
    setSavingId(idx);
    try {
      await questionsAPI.create({
        type: q.questionType,
        text: q.text,
        options: q.options || null,
        answer: q.answer,
        difficulty: q.difficulty,
        points: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
      });
      setSavedIds(prev => new Set([...prev, idx]));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save question.');
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    const unsaved = questions.filter((q, i) => !savedIds.has(i) && q.grounded !== false);
    for (let i = 0; i < unsaved.length; i++) {
      const q = unsaved[i];
      const idx = questions.indexOf(q);
      try {
        await questionsAPI.create({
          type: q.questionType,
          text: q.text,
          options: q.options || null,
          answer: q.answer,
          difficulty: q.difficulty,
          points: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
        });
        setSavedIds(prev => new Set([...prev, idx]));
      } catch {
        // Continue with remaining
      }
    }
    setSavingAll(false);
  };

  const toggleSource = (idx) => {
    setShowSource(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const openRegenModal = (idx, question) => {
    setRegenModal({ idx, question });
    setRegenInstructions('');
    setRegenError(null);
  };

  const closeRegenModal = () => {
    setRegenModal(null);
    setRegenInstructions('');
    setRegenError(null);
  };

  const handleRegenerate = async () => {
    if (!regenModal) return;
    const { idx, question } = regenModal;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await aiAPI.regenerate({
        content_area: question.contentArea || contentArea,
        grade: question.grade || grade,
        question_type: question.questionType,
        difficulty: question.difficulty,
        original_question: question,
        modification_instructions: regenInstructions.trim(),
        source_chunk_ids: question.sourceChunkIds || [],
      });
      const newQuestion = res.data.question;
      setQuestions(prev => {
        const updated = [...prev];
        updated[idx] = newQuestion;
        return updated;
      });
      // Reset saved status for this index — it's a new question
      setSavedIds(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
      closeRegenModal();
    } catch (err) {
      setRegenError(err.response?.data?.message || 'Regeneration failed. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const openFeedbackModal = (question) => {
    setFeedbackModal({ question });
    setFeedbackRating(0);
    setFeedbackCategory('general');
    setFeedbackText('');
    setFeedbackError(null);
    setFeedbackSuccess(false);
  };

  const closeFeedbackModal = () => {
    setFeedbackModal(null);
    setFeedbackSuccess(false);
    setFeedbackError(null);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal || !feedbackText.trim()) return;
    const { question } = feedbackModal;
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      await aiAPI.feedback({
        content_area: question.contentArea || contentArea,
        grade: question.grade || grade,
        question_type: question.questionType,
        question_text: question.text,
        options: question.options || null,
        answer: question.answer || null,
        sources: question.sources || [],
        feedback_text: feedbackText.trim(),
        rating: feedbackRating || null,
        category: feedbackCategory,
      });
      setFeedbackSuccess(true);
      setFeedbackText('');
      setFeedbackRating(0);
    } catch (err) {
      setFeedbackError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const diffMeta = DIFFICULTIES.find(d => d.value === difficulty) || DIFFICULTIES[1];
  const typeMeta = TYPE_META[questionType] || TYPE_META.MCQ;

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          ✨ AI Question Generator
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          Select parameters below — questions are generated from your uploaded syllabus only.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ─── Left Panel: Form ─── */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 24, boxShadow: 'var(--shadow)', position: 'sticky', top: 24,
          maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
            Generation Parameters
          </h2>

          {/* Content Area */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Content Area</label>
            <select id="ai-content-area" value={contentArea} onChange={e => setContentArea(e.target.value)} style={selectStyle}>
              {CONTENT_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Grade */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Grade</label>
            <select id="ai-grade" value={grade} onChange={e => setGrade(e.target.value)} style={selectStyle}>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>


          {/* Question Type */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Question Type</label>
            <select
              id="ai-question-type"
              value={questionType}
              onChange={e => setQuestionType(e.target.value)}
              style={selectStyle}
            >
              {QUESTION_TYPES.map(qt => (
                <option key={qt.value} value={qt.value}>
                  {qt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Difficulty</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  id={`diff-${d.value}`}
                  onClick={() => setDifficulty(d.value)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${difficulty === d.value ? d.color : 'var(--color-border)'}`,
                    background: difficulty === d.value ? d.bg : 'var(--color-surface)',
                    color: difficulty === d.value ? d.color : 'var(--color-text-muted)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count Slider */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
              <span>Number of Questions</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 16 }}>{count}</span>
            </label>
            <input
              id="question-count"
              type="range"
              min={1} max={20} step={1}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              <span>1</span><span>20</span>
            </div>
          </div>

          {/* Custom Prompt */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Additional Instructions</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <textarea
              id="ai-custom-prompt"
              rows={4}
              placeholder={`Examples:\n• Give 5 options for Multiple Choice instead of 4\n• Include the word "photosynthesis"\n• Focus on Chapter 3`}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              style={{
                ...selectStyle,
                resize: 'vertical',
                minHeight: 90,
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                fontStyle: customPrompt ? 'normal' : 'italic',
              }}
            />
            {customPrompt.trim() && (
              <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>💡</span> AI will follow these instructions during generation
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            id="generate-btn"
            className="btn-generate"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '13px', background: generating ? '#c7d2fe' : 'var(--color-primary)',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              boxShadow: generating ? 'none' : '0 4px 14px rgba(79,110,247,0.35)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating...
              </>
            ) : '✨ Generate Questions'}
          </button>
        </div>

        {/* ─── Right Panel: Results ─── */}
        <div>
          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '14px 18px', marginBottom: 20, color: 'var(--color-danger)', fontSize: 13,
            }}>
              ❌ {error}
              {error.includes('syllabus') && (
                <button
                  onClick={() => navigate('/syllabus')}
                  style={{ marginLeft: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
                >
                  Upload Syllabus →
                </button>
              )}
            </div>
          )}

          {/* Generation meta */}
          {genMeta && questions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Generated <strong style={{ color: 'var(--color-text)' }}>{questions.length}</strong> questions
                from <strong style={{ color: 'var(--color-text)' }}>{genMeta.retrieved_chunk_count}</strong> syllabus chunks
                {genMeta.ungrounded_dropped > 0 && (
                  <span style={{ color: '#b91c1c', fontWeight: 600 }}> · {genMeta.ungrounded_dropped} failed validation</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  id="save-all-btn"
                  className="btn-save-all"
                  onClick={saveAll}
                  disabled={savingAll || savedIds.size === questions.filter(q => q.grounded !== false).length}
                  style={{
                    padding: '9px 20px', background: savedIds.size === questions.filter(q => q.grounded !== false).length ? '#f0fdf4' : 'var(--color-primary)',
                    border: 'none', borderRadius: 8, color: savedIds.size === questions.filter(q => q.grounded !== false).length ? 'var(--color-success)' : '#fff',
                    fontSize: 13, fontWeight: 600, cursor: savingAll || savedIds.size === questions.filter(q => q.grounded !== false).length ? 'default' : 'pointer',
                    boxShadow: savedIds.size === questions.filter(q => q.grounded !== false).length ? 'none' : '0 4px 12px rgba(79,110,247,0.25)',
                    transition: 'all 0.15s',
                  }}
                >
                  {savingAll ? 'Saving...' : savedIds.size === questions.filter(q => q.grounded !== false).length ? '✅ All Saved' : '💾 Save All to Bank'}
                </button>
              </div>
            </div>
          )}

          {/* Empty state while generating */}
          {generating && (
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 60, textAlign: 'center', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>✨</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Retrieving syllabus content...</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                FAISS search → Gemini generation → structured output
              </div>
            </div>
          )}

          {/* Empty state before generation */}
          {!generating && questions.length === 0 && !error && (
            <div style={{
              background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
              borderRadius: 12, padding: 60, textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Ready to Generate</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Configure parameters on the left and click Generate Questions.
              </div>
            </div>
          )}

          {/* Scrollable Questions Container */}
          {questions.length > 0 && (
            <div style={{
              maxHeight: 'calc(100vh - 160px)',
              overflowY: 'auto',
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 20,
              marginTop: 10
            }}>
              {questions.map((q, idx) => {
                const isSaved = savedIds.has(idx);
                const isSaving = savingId === idx;
                const qType = TYPE_META[q.questionType] || TYPE_META.MCQ;
                const qDiff = DIFFICULTIES.find(d => d.value === q.difficulty) || DIFFICULTIES[1];
                const src = showSource[idx];

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--color-surface)',
                      border: `1.5px solid ${isSaved
                          ? '#bbf7d0'
                          : q.grounded === false
                            ? '#fca5a5'
                            : 'var(--color-border)'
                        }`,
                      borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: 'var(--shadow)',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#8b92a5' }}>Q{idx + 1}</span>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: qType.bg, color: qType.color }}>
                        {q.questionType?.replace('_', ' ')}
                      </span>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: qDiff.bg, color: qDiff.color, textTransform: 'capitalize' }}>
                        {q.difficulty}
                      </span>

                      {/* Grounding Status badge — 3-tier classification */}
                      {(() => {
                        const score = typeof q.groundingScore === 'number'
                          ? q.groundingScore
                          : (q.grounded === false ? 0 : 1);
                        let label, bg, color, border;
                        if (score >= 0.6) {
                          label = 'Passed'; bg = '#dcfce7'; color = '#15803d'; border = '#bbf7d0';
                        } else if (score >= 0.4) {
                          label = 'Fair'; bg = '#fef9c3'; color = '#854d0e'; border = '#fde68a';
                        } else {
                          label = 'Failed'; bg = '#fee2e2'; color = '#b91c1c'; border = '#fecaca';
                        }
                        return (
                          <span style={{
                            display: 'inline-flex', padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            background: bg, color, border: `1px solid ${border}`,
                          }}>
                            {label}
                          </span>
                        );
                      })()}

                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Source toggle */}
                        {(q.sources?.length > 0 || q.sourceChunkIds?.length > 0) && (
                          <button
                            className="btn-chunks"
                            onClick={() => toggleSource(idx)}
                            title="Show exactly where this question came from"
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: '1px solid var(--color-border)', background: src ? 'var(--color-primary-light)' : 'transparent',
                              color: src ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            📍 Source{q.sources?.length > 1 ? 's' : ''}
                          </button>
                        )}
                        {/* Feedback button */}
                        <button
                          id={`feedback-q-${idx}`}
                          onClick={() => openFeedbackModal(q)}
                          title="Submit feedback to improve future question generation"
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: '1px solid #e0f2fe', background: '#f0f9ff', color: '#0369a1',
                            cursor: 'pointer', transition: 'all 0.12s',
                          }}
                        >
                          💬 Feedback
                        </button>
                        {/* Regenerate button */}
                        <button
                          id={`regen-q-${idx}`}
                          className="btn-regen-card"
                          onClick={() => openRegenModal(idx, q)}
                          title="Regenerate this question with modifications"
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: '1px solid #e0d7ff',
                            background: '#f5f3ff',
                            color: '#7c3aed',
                            cursor: 'pointer', transition: 'all 0.12s',
                          }}
                        >
                          🔄 Regenerate
                        </button>
                        {/* Save button */}
                        <button
                          id={`save-q-${idx}`}
                          className="btn-save-card"
                          onClick={() => !isSaved && q.grounded !== false && saveQuestion(q, idx)}
                          disabled={isSaved || isSaving || q.grounded === false}
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: q.grounded === false ? '1px solid #e2e8f0' : isSaved ? '1px solid #bbf7d0' : '1px solid var(--color-primary)',
                            background: q.grounded === false ? '#f1f5f9' : isSaved ? '#f0fdf4' : 'var(--color-primary-light)',
                            color: q.grounded === false ? '#94a3b8' : isSaved ? 'var(--color-success)' : 'var(--color-primary)',
                            cursor: q.grounded === false ? 'not-allowed' : isSaved ? 'default' : 'pointer', transition: 'all 0.12s',
                          }}
                        >
                          {isSaving ? '...' : isSaved ? '✅ Saved' : '💾 Save'}
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12, lineHeight: 1.5 }}>
                      <MarkdownText text={q.text} />
                    </div>

                    {/* Multiple Choice Options */}
                    {(q.questionType === 'SINGLE_SELECT' || q.questionType === 'MULTIPLE_SELECT' || q.questionType === 'MULTI_SELECT' || q.questionType === 'MCQ') && q.options && (() => {
                      const correctAnswers = (q.answer || '').replace(/,/g, '|').split('|').map(s => s.trim());
                      const isCorrect = (letter) => correctAnswers.includes(letter);
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                          {Object.entries(q.options).map(([letter, text]) => (
                            <div key={letter} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px',
                              borderRadius: q.questionType === 'MULTIPLE_SELECT' ? 6 : 8,
                              border: `1.5px solid ${isCorrect(letter) ? '#bbf7d0' : 'var(--color-border)'}`,
                              background: isCorrect(letter) ? '#f0fdf4' : '#fafbfc',
                            }}>
                              <span style={{
                                fontWeight: 700, fontSize: 12, color: isCorrect(letter) ? 'var(--color-success)' : 'var(--color-text-muted)',
                                flexShrink: 0, marginTop: 1,
                              }}>{letter}.</span>
                              <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>{text}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Matching Lines columns */}
                    {q.questionType === 'MATCHING_LINES' && q.options?.left && q.options?.right && (() => {
                      const correctPairs = parseMatchingAnswer(q.answer);
                      const leftItems = Object.entries(q.options.left);
                      const rightItems = Object.entries(q.options.right);
                      return (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>Column A</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>Column B</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {leftItems.map(([key, label]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: '#f8fafc' }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, color: '#0891b2', flexShrink: 0, minWidth: 18 }}>{key}.</span>
                                  <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>{label}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {rightItems.map(([key, label]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: '#f8fafc' }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', flexShrink: 0, minWidth: 18 }}>{key}.</span>
                                  <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>{label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {Object.keys(correctPairs).length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Answer Key</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {leftItems.map(([leftKey]) => {
                                  const rightKey = correctPairs[leftKey];
                                  return (
                                    <div key={leftKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#ecfeff', border: '1px solid #a5f3fc', fontSize: 12, fontWeight: 600, color: '#0891b2' }}>
                                      <span>{leftKey}</span><span style={{ color: '#94a3b8' }}>→</span><span>{rightKey}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Ordering preview */}
                    {q.questionType === 'ORDERING' && Array.isArray(q.options) && (() => {
                      const correct = q.answer ? q.answer.split('|').map(s => s.trim()) : [];
                      return (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400, marginBottom: 12 }}>
                            {q.options.map((opt, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: '#fff' }}>
                                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                                <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>{opt}</span>
                              </div>
                            ))}
                          </div>
                          {correct.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Correct Order Key</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {correct.map((item, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 12, padding: '4px 10px', background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 20, color: '#db2777', fontWeight: 600 }}>
                                      {i + 1}. {item}
                                    </span>
                                    {i < correct.length - 1 && <span style={{ color: '#db2777', opacity: 0.5 }}>➔</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Constructed Response — inline text + answer chips */}
                    {q.questionType === 'CONSTRUCTED_RESPONSE' && q.text && (() => {
                      const parts = q.text.split(/_{2,}/);
                      const answers = q.options?.answers || q.answer?.split('|') || [];
                      return (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 14, lineHeight: 2.2, color: 'var(--color-text)', fontWeight: 500, marginBottom: 8 }}>
                            {parts.map((part, i) => {
                              const rawVal = answers[i];
                              const displayVal = Array.isArray(rawVal) ? (rawVal[0] || '') : rawVal;
                              return (
                                <span key={i}>
                                  {part}
                                  {i < parts.length - 1 && (
                                    <span style={{
                                      display: 'inline-block', padding: '2px 10px', margin: '0 4px',
                                      background: '#f5f3ff', border: '1.5px solid #c4b5fd',
                                      borderRadius: 6, color: '#7c3aed', fontWeight: 700, fontSize: 13,
                                    }}>
                                      {displayVal || '___'}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>

                          {/* Acceptable Alternatives list */}
                          {(() => {
                            const hasAlternatives = answers.some(ans => Array.isArray(ans) && ans.length > 1);
                            if (!hasAlternatives) return null;
                            return (
                              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f5f3ff', borderRadius: 8, border: '1px solid #d8b4fe' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Acceptable Answers</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {answers.map((ans, idx) => {
                                    const isArr = Array.isArray(ans);
                                    const primary = isArr ? (ans[0] || '') : ans;
                                    const alts = isArr ? ans.slice(1) : [];
                                    return (
                                      <div key={idx} style={{ fontSize: 12, color: 'var(--color-text)' }}>
                                        Blank {idx + 1}: <strong>{primary}</strong>
                                        {alts.length > 0 && (
                                          <span> (acceptable alternatives: <span style={{ color: 'var(--color-text-muted)' }}>{alts.join(', ')}</span>)</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Dropdown — inline faux-select for each blank */}
                    {q.questionType === 'DROPDOWN' && q.text && q.options?.blanks && (() => {
                      const parts = q.text.split(/_{2,}/);
                      return (
                        <div style={{ marginBottom: 14, fontSize: 14, lineHeight: 2.8, color: 'var(--color-text)', fontWeight: 500 }}>
                          {parts.map((part, i) => (
                            <span key={i}>
                              {part}
                              {i < parts.length - 1 && q.options.blanks[i] && (
                                <span style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', margin: '0 4px', gap: 2 }}>
                                  {q.options.blanks[i].choices.map(choice => (
                                    <span key={choice} style={{
                                      display: 'inline-block', padding: '1px 8px', borderRadius: 4,
                                      fontSize: 12, fontWeight: choice === q.options.blanks[i].correct ? 700 : 400,
                                      background: choice === q.options.blanks[i].correct ? '#d1fae5' : '#f1f5f9',
                                      color: choice === q.options.blanks[i].correct ? '#065f46' : '#64748b',
                                      border: `1px solid ${choice === q.options.blanks[i].correct ? '#6ee7b7' : '#e2e8f0'}`,
                                    }}>
                                      {choice === q.options.blanks[i].correct ? '✓ ' : ''}{choice}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Answer & Explanation */}
                    <div style={{
                      background: '#f8f9fb', borderRadius: 8, padding: '12px 14px',
                      borderLeft: '3px solid var(--color-primary)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Answer
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: q.explanation ? 8 : 0 }}>
                        {q.answer}
                      </div>
                      {q.explanation && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Explanation
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            {q.explanation}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Source detail (expandable): exact file + page + chapter for cross-verification */}
                    {src && (q.sources?.length > 0 || q.sourceChunkIds?.length > 0) && (
                      <div style={{
                        marginTop: 10, padding: '10px 14px', background: '#fffbeb',
                        borderRadius: 8, border: '1px solid #fde68a', fontSize: 12,
                        color: '#92400e',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          Source{q.sources?.length > 1 ? 's' : ''} — for cross-verification against the syllabus
                        </div>
                        {q.sources?.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {q.sources.map((s, si) => (
                              <li key={si} style={{ marginBottom: 2 }}>
                                <strong>{s.filename}</strong>
                                {s.page ? `, page ${s.page}` : ''}
                                {s.chapter ? ` — ${s.chapter}` : ''}
                                {s.chunk_type === 'image' ? ' (image)' : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span>Chunk ids: {q.sourceChunkIds.join(', ')}</span>
                        )}

                        {/* Grounding / fact-check status */}
                        <div style={{ marginTop: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            color: (() => {
                              const s = typeof q.groundingScore === 'number' ? q.groundingScore : (q.grounded === false ? 0 : 1);
                              return s >= 0.6 ? '#15803d' : s >= 0.4 ? '#854d0e' : '#b91c1c';
                            })()
                          }}>
                            {(() => {
                              const s = typeof q.groundingScore === 'number' ? q.groundingScore : (q.grounded === false ? 0 : 1);
                              if (s >= 0.6) return '✅ Passed automated fact-check against the cited source.';
                              if (s >= 0.4) return `⚠️ Fair: ${q.groundingNote || 'partially supported by the cited source — review before use.'}`;
                              return `⚠️ Failed: ${q.groundingNote || 'not clearly supported by the cited source.'}`;
                            })()}
                          </span>
                        </div>

                        {/* Source image thumbnails, if this question drew on a diagram/chart */}
                        {q.imageRefs?.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            {q.imageRefs.map((url, ii) => (
                              <a key={ii} href={url} target="_blank" rel="noreferrer">
                                <img
                                  src={url}
                                  alt="Source diagram/chart"
                                  style={{ height: 90, borderRadius: 6, border: '1px solid #fde68a', display: 'block' }}
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Regenerate Modal ─── */}
      {regenModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeRegenModal(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(10, 10, 20, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 16,
            padding: 28,
            width: '100%',
            maxWidth: 560,
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            border: '1px solid var(--color-border)',
            animation: 'slideUp 0.18s ease',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>🔄 Regenerate Question</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Q{regenModal.idx + 1} — {regenModal.question.questionType?.replace(/_/g, ' ')}
                </div>
              </div>
              <button
                onClick={closeRegenModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-muted)', lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>

            {/* Original Question Preview */}
            <div style={{
              background: '#f8f9fb', borderRadius: 10, padding: '12px 16px',
              marginBottom: 20, border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Original Question
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, fontWeight: 500 }}>
                {regenModal.question.text}
              </div>
            </div>

            {/* Modification Instructions */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>Modification Instructions</label>
              <textarea
                id="regen-instructions"
                rows={4}
                placeholder={'e.g. Make it harder\nFocus on ecosystems instead\nReword more clearly\nAdd a 5th option'}
                value={regenInstructions}
                onChange={e => setRegenInstructions(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1.5px solid var(--color-border)', fontSize: 13,
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  resize: 'vertical', outline: 'none', lineHeight: 1.5,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Leave empty to let AI improve the question automatically.
              </div>
            </div>

            {/* Error */}
            {regenError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#991b1b', fontSize: 13,
              }}>
                ❌ {regenError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn-modal-cancel"
                onClick={closeRegenModal}
                disabled={regenerating}
                style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-muted)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                id="regen-confirm-btn"
                className="btn-modal-confirm"
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{
                  padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: 'none', background: regenerating ? '#c4b5fd' : '#7c3aed',
                  color: '#fff', cursor: regenerating ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}
              >
                {regenerating ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Regenerating…
                  </>
                ) : '🔄 Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .btn-generate:hover:not(:disabled) {
          background: var(--color-primary-dark, #3a55d4) !important;
          box-shadow: 0 6px 20px rgba(79,110,247,0.45) !important;
          transform: translateY(-1px);
        }
        .btn-generate:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-save-all:hover:not(:disabled) {
          background: var(--color-primary-dark, #3a55d4) !important;
          box-shadow: 0 6px 16px rgba(79,110,247,0.35) !important;
          transform: translateY(-1px);
        }
        .btn-save-all:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-chunks:hover {
          background: var(--color-primary-light, #eef1fe) !important;
          border-color: var(--color-primary, #4f6ef7) !important;
          color: var(--color-primary, #4f6ef7) !important;
        }

        .btn-regen-card:hover {
          background: #ebdffd !important;
          border-color: #7c3aed !important;
          color: #6d28d9 !important;
          transform: translateY(-1px);
        }
        .btn-regen-card:active {
          transform: translateY(0);
        }

        .btn-save-card:hover:not(:disabled) {
          background: var(--color-primary, #4f6ef7) !important;
          color: #fff !important;
          border-color: var(--color-primary, #4f6ef7) !important;
          transform: translateY(-1px);
        }
        .btn-save-card:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-modal-cancel:hover {
          background: var(--color-border, #f1f5f9) !important;
          border-color: #94a3b8 !important;
          color: var(--color-text, #1e293b) !important;
        }

        .btn-modal-confirm:hover:not(:disabled) {
          background: #6d28d9 !important;
          transform: translateY(-1px);
        }
        .btn-modal-confirm:active:not(:disabled) {
          transform: translateY(0);
        }

        .star-btn:hover { transform: scale(1.2); }
        .feedback-cat-pill:hover { opacity: 0.85; }
      `}</style>

      {/* ── Feedback Modal ── */}
      {feedbackModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: 'var(--color-surface, #fff)', borderRadius: 16,
            padding: '32px 28px', width: '100%', maxWidth: 520,
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            animation: 'slideUp 0.2s ease',
            position: 'relative',
          }}>
            {/* X close button */}
            <button
              onClick={closeFeedbackModal}
              aria-label="Close feedback modal"
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 30, height: 30, borderRadius: '50%',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 16, fontWeight: 700, lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              &#x2715;
            </button>
            {feedbackSuccess ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                  Thank you for your feedback!
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
                  Your comments have been saved and will be used to improve future question generation for{' '}
                  <strong>{feedbackModal.question.contentArea} {feedbackModal.question.grade}</strong>.
                </div>
                <button
                  onClick={closeFeedbackModal}
                  style={{
                    padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                    💬 Question Feedback
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Your feedback helps the AI generate better questions for future sessions.
                  </div>
                </div>

                {/* Question preview */}
                <div style={{
                  padding: '10px 14px', borderRadius: 8, background: '#f8fafc',
                  border: '1px solid var(--color-border)', marginBottom: 20,
                  fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Question: </span>
                  {feedbackModal.question.text?.slice(0, 160)}{feedbackModal.question.text?.length > 160 ? '…' : ''}
                </div>

                {/* Star rating */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Overall Quality Rating
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        className="star-btn"
                        onClick={() => setFeedbackRating(star === feedbackRating ? 0 : star)}
                        style={{
                          fontSize: 24, background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px 4px', transition: 'transform 0.15s',
                          opacity: star <= feedbackRating ? 1 : 0.3,
                          filter: star <= feedbackRating ? 'none' : 'grayscale(1)',
                        }}
                        title={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        ⭐
                      </button>
                    ))}
                    {feedbackRating > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: 4 }}>
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][feedbackRating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Category pills */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Feedback Category
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { value: 'general', label: 'General' },
                      { value: 'distractor_quality', label: 'Distractor Quality' },
                      { value: 'difficulty', label: 'Difficulty' },
                      { value: 'clarity', label: 'Clarity' },
                      { value: 'accuracy', label: 'Accuracy' },
                      { value: 'topic', label: 'Topic / Coverage' },
                    ].map(cat => {
                      const active = feedbackCategory === cat.value;
                      return (
                        <button
                          key={cat.value}
                          className="feedback-cat-pill"
                          onClick={() => setFeedbackCategory(cat.value)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s',
                            background: active ? '#0369a1' : '#f1f5f9',
                            color: active ? '#fff' : 'var(--color-text-muted)',
                            border: active ? '1px solid #0369a1' : '1px solid var(--color-border)',
                          }}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Free text */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Comments <span style={{ color: '#ef4444' }}>*</span>
                  </div>
                  <textarea
                    id="feedback-text"
                    rows={4}
                    placeholder="e.g. The distractors were too easy to eliminate. Consider using concepts from the same chapter as plausible wrong answers."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                      border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
                      color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                    }}
                  />
                </div>

                {feedbackError && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
                    {feedbackError}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    className="btn-modal-cancel"
                    onClick={closeFeedbackModal}
                    disabled={feedbackSubmitting}
                    style={{
                      padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: '1.5px solid var(--color-border)', background: 'transparent',
                      color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-feedback-btn"
                    onClick={handleSubmitFeedback}
                    disabled={feedbackSubmitting || !feedbackText.trim()}
                    style={{
                      padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      border: 'none',
                      background: !feedbackText.trim() ? '#e2e8f0' : '#0369a1',
                      color: !feedbackText.trim() ? '#94a3b8' : '#fff',
                      cursor: !feedbackText.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {feedbackSubmitting ? 'Submitting…' : '📤 Submit Feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)',
  display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const selectStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid var(--color-border)', fontSize: 14,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  outline: 'none', cursor: 'pointer',
};
