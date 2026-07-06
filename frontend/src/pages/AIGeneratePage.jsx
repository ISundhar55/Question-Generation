import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { aiAPI, questionsAPI } from '../services/api';
import { MarkdownText } from 'question-storybook-ui';

const CONTENT_AREAS = ['English Language Arts', 'Mathematics', 'Science'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice', icon: '🔘', desc: '4 options, one correct answer' },
  { value: 'TRUE_FALSE', label: 'True / False', icon: '⚖️', desc: 'Statement judged true or false' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', icon: '✏️', desc: 'Type the answer for each blank' },
  { value: 'DROPDOWN', label: 'Dropdown', icon: '📋', desc: 'Select answer for each blank from a list' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', icon: '🔗', desc: 'Match Column A items to Column B' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: '#15803d', bg: '#f0fdf4' },
  { value: 'medium', label: 'Medium', color: '#92400e', bg: '#fffbeb' },
  { value: 'hard', label: 'Hard', color: '#991b1b', bg: '#fef2f2' },
];

const TYPE_META = {
  MCQ: { color: '#4f6ef7', bg: '#eef1fe' },
  TRUE_FALSE: { color: '#22c55e', bg: '#f0fdf4' },
  SHORT_ANSWER: { color: '#f59e0b', bg: '#fffbeb' },
  FILL_IN_BLANK: { color: '#a855f7', bg: '#faf5ff' },   // kept for legacy display
  CONSTRUCTED_RESPONSE: { color: '#7c3aed', bg: '#f5f3ff' },
  DROPDOWN: { color: '#0e7490', bg: '#ecfeff' },
  MATCHING_LINES: { color: '#0891b2', bg: '#ecfeff' },
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
  const [chapter, setChapter] = useState('');
  const [questionType, setQuestionType] = useState('MCQ');
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
        chapter: chapter.trim() || undefined,
        question_type: questionType,
        difficulty,
        count,
        custom_prompt: customPrompt.trim() || undefined,
      });
      setQuestions(res.data.questions || []);
      setGenMeta({
        retrieved_chunk_count: res.data.retrieved_chunk_count,
        doc_ids_used: res.data.doc_ids_used,
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
    const unsaved = questions.filter((_, i) => !savedIds.has(i));
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

          {/* Chapter (optional) */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Chapter</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <input
              id="ai-chapter"
              type="text"
              placeholder="e.g. Fractions, Photosynthesis…"
              value={chapter}
              onChange={e => setChapter(e.target.value)}
              style={{
                ...selectStyle,
                fontStyle: chapter ? 'normal' : 'italic',
              }}
            />
            {chapter.trim() && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                🔍 Only chunks matching &ldquo;{chapter.trim()}&rdquo; will be used
              </div>
            )}
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
              placeholder={`Examples:\n• Give 5 options for MCQ instead of 4\n• Include the word "photosynthesis"\n• Focus on Chapter 3 diagrams`}
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
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  id="save-all-btn"
                  onClick={saveAll}
                  disabled={savingAll || savedIds.size === questions.length}
                  style={{
                    padding: '9px 20px', background: savedIds.size === questions.length ? '#f0fdf4' : 'var(--color-primary)',
                    border: 'none', borderRadius: 8, color: savedIds.size === questions.length ? 'var(--color-success)' : '#fff',
                    fontSize: 13, fontWeight: 600, cursor: savingAll || savedIds.size === questions.length ? 'default' : 'pointer',
                    boxShadow: savedIds.size === questions.length ? 'none' : '0 4px 12px rgba(79,110,247,0.25)',
                  }}
                >
                  {savingAll ? 'Saving...' : savedIds.size === questions.length ? '✅ All Saved' : '💾 Save All to Bank'}
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

          {/* Question Cards */}
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
                  background: 'var(--color-surface)', border: `1px solid ${isSaved ? '#bbf7d0' : 'var(--color-border)'}`,
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
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Source toggle */}
                    {q.sourceChunkIds?.length > 0 && (
                      <button
                        onClick={() => toggleSource(idx)}
                        title="Show source chunks"
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: '1px solid var(--color-border)', background: src ? 'var(--color-primary-light)' : 'transparent',
                          color: src ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer',
                        }}
                      >
                        📍 Chunks {q.sourceChunkIds.join(', ')}
                      </button>
                    )}
                    {/* Save button */}
                    <button
                      id={`save-q-${idx}`}
                      onClick={() => !isSaved && saveQuestion(q, idx)}
                      disabled={isSaved || isSaving}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: isSaved ? '1px solid #bbf7d0' : '1px solid var(--color-primary)',
                        background: isSaved ? '#f0fdf4' : 'var(--color-primary-light)',
                        color: isSaved ? 'var(--color-success)' : 'var(--color-primary)',
                        cursor: isSaved ? 'default' : 'pointer', transition: 'all 0.12s',
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

                {/* MCQ Options */}
                {q.questionType === 'MCQ' && q.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {Object.entries(q.options).map(([letter, text]) => (
                      <div key={letter} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px',
                        borderRadius: 8, border: `1.5px solid ${letter === q.answer ? '#bbf7d0' : 'var(--color-border)'}`,
                        background: letter === q.answer ? '#f0fdf4' : '#fafbfc',
                      }}>
                        <span style={{
                          fontWeight: 700, fontSize: 12, color: letter === q.answer ? 'var(--color-success)' : 'var(--color-text-muted)',
                          flexShrink: 0, marginTop: 1,
                        }}>{letter}.</span>
                        <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                )}

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

                {/* Constructed Response — inline text + answer chips */}
                {q.questionType === 'CONSTRUCTED_RESPONSE' && q.text && (() => {
                  const parts = q.text.split('___');
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
                  const parts = q.text.split('___');
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

                {/* Source chunk detail (expandable) */}
                {src && q.sourceChunkIds?.length > 0 && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px', background: '#fffbeb',
                    borderRadius: 8, border: '1px solid #fde68a', fontSize: 12,
                    color: '#92400e',
                  }}>
                    <span style={{ fontWeight: 700 }}>Source Chunk IDs: </span>
                    {q.sourceChunkIds.join(', ')} — these are the syllabus chunk indices used to generate this question.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
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
