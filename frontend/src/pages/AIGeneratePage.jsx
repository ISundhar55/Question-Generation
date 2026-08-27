import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { aiAPI, questionsAPI } from '../services/api';
import { MarkdownText } from 'question-storybook-ui';
import {
  CONTENT_AREAS,
  GRADES,
  QUESTION_TYPES,
  DIFFICULTIES,
  TYPE_META,
  getRefinementTargetsForType,
  parseMatchingAnswer,
} from './aiGenerateConstants';

export default function AIGeneratePage() {
  const navigate = useNavigate();

  // Form state
  const [contentArea, setContentArea] = useState(CONTENT_AREAS[0]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [difficulty, setDifficulty] = useState('medium');
  const [customPrompt, setCustomPrompt] = useState('');

  // Multi-type selection with individual counts (max 20 per type, 50 total)
  const [typeCounts, setTypeCounts] = useState({
    SINGLE_SELECT: 0,
    MULTIPLE_SELECT: 0,
    TRUE_FALSE: 0,
    CONSTRUCTED_RESPONSE: 0,
    DROPDOWN: 0,
    MATCHING_LINES: 0,
    ORDERING: 0,
    GAP_MATCH: 0,
    MULTIPLE_DROP_BUCKET: 0,
    MATRIX_INTERACTION: 0,
    SELECT_TEXT: 0,
    // BACKGROUND_GRAPHIC: 0,
  });

  const [lastNonZeroCounts, setLastNonZeroCounts] = useState({
    SINGLE_SELECT: 1,
    MULTIPLE_SELECT: 1,
    TRUE_FALSE: 1,
    CONSTRUCTED_RESPONSE: 1,
    DROPDOWN: 1,
    MATCHING_LINES: 1,
    ORDERING: 1,
    GAP_MATCH: 1,
    MULTIPLE_DROP_BUCKET: 1,
    MATRIX_INTERACTION: 1,
    SELECT_TEXT: 1,
    // BACKGROUND_GRAPHIC: 1,
  });

  const totalCount = Object.values(typeCounts).reduce((sum, c) => sum + c, 0);

  const handleTypeCountChange = (type, newCount) => {
    const validCount = Math.max(0, Math.min(20, newCount));
    setTypeCounts(prev => ({ ...prev, [type]: validCount }));
    if (validCount > 0) {
      setLastNonZeroCounts(prev => ({ ...prev, [type]: validCount }));
    }
  };

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
  const [refinementTargets, setRefinementTargets] = useState([]); // all unchecked by default
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

  // Assessment-specific prompt inputs
  const [assessmentTarget, setAssessmentTarget] = useState('');
  const [assessmentBoundaries, setAssessmentBoundaries] = useState('');
  const [cognitiveComplexity, setCognitiveComplexity] = useState('');

  // Stats from last generation
  const [genMeta, setGenMeta] = useState(null);

  const handleGenerate = async () => {
    const activeTypes = Object.entries(typeCounts).filter(([_, count]) => count > 0);
    if (activeTypes.length === 0 || totalCount > 50) return;

    setGenerating(true);
    setError(null);
    setQuestions([]);
    setSavedIds(new Set());
    setGenMeta(null);

    // Combine structured assessment fields into priority instructions for the LLM
    const promptParts = [];
    if (assessmentTarget.trim()) {
      promptParts.push(`🎯 Assessment Target:\n${assessmentTarget.trim()}`);
    }
    if (assessmentBoundaries.trim()) {
      promptParts.push(`🛑 Assessment Boundaries:\n${assessmentBoundaries.trim()}`);
    }
    if (cognitiveComplexity.trim()) {
      promptParts.push(`🧠 Cognitive Complexity:\n${cognitiveComplexity.trim()}`);
    }
    if (customPrompt.trim()) {
      promptParts.push(`Additional Instructions:\n${customPrompt.trim()}`);
    }
    const combinedCustomPrompt = promptParts.length > 0 ? promptParts.join('\n\n') : undefined;

    try {
      // Execute requests with a concurrency limit of 3 to avoid burst rate limits on LLMs
      const runWithConcurrency = async (items, limit, fn) => {
        const results = [];
        const executing = [];
        for (const item of items) {
          const p = Promise.resolve().then(() => fn(item));
          results.push(p);
          if (limit <= items.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
              await Promise.race(executing);
            }
          }
        }
        return Promise.all(results);
      };

      const responses = await runWithConcurrency(activeTypes, 3, ([type, count]) =>
        aiAPI.generateFromInternet({
          content_area: contentArea,
          grade,
          question_type: type,
          difficulty,
          count,
          custom_prompt: combinedCustomPrompt,
        })
      );
      const allQuestions = responses.flatMap(res =>
        (res.data.questions || []).map(q => ({ ...q, _internetSource: true }))
      );
      setQuestions(allQuestions);
      setGenMeta({
        retrieved_chunk_count: 0,
        doc_ids_used: [],
        ungrounded_dropped: 0,
        internetSource: true,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed. Please try again.');
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
    const unsaved = questions.filter((q, i) => !savedIds.has(i));
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
    setRefinementTargets([]); // All unchecked by default
    setRegenError(null);
  };

  const closeRegenModal = () => {
    setRegenModal(null);
    setRegenInstructions('');
    setRefinementTargets([]);
    setRegenError(null);
  };

  const toggleRefinementTarget = (id) => {
    setRefinementTargets(prev => {
      if (prev.includes(id)) {
        return prev.filter(t => t !== id);
      } else {
        if (id === 'entire_item') {
          return ['entire_item'];
        } else {
          return [...prev.filter(t => t !== 'entire_item'), id];
        }
      }
    });
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
        refinement_targets: refinementTargets,
        source_chunk_ids: question.sourceChunkIds || [],
      });
      const newQuestion = {
        ...res.data.question,
        _internetSource: question._internetSource
      };
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

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          ✨ AI Question Generator
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          Select parameters below — questions are generated using general curriculum knowledge and web sources.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '390px 1fr', gap: 24, alignItems: 'start' }}>

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


          {/* Question Types Multi-Select Card (Matching Screenshot) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Question Types <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--color-text-muted)', fontSize: 11 }}>(Total: {totalCount} {totalCount === 1 ? 'item' : 'items'})</span>
              </label>
            </div>

            <div style={{
              border: '1.5px solid var(--color-border)',
              borderRadius: 10,
              background: 'var(--color-surface)',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
            }}>
              {/* Scrollable Question Types List */}
              <div style={{
                maxHeight: 280,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {QUESTION_TYPES.map(qt => {
                  const currentCount = typeCounts[qt.value] || 0;
                  const isChecked = currentCount > 0;
                  return (
                    <div
                      key={qt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: isChecked ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isChecked ? 600 : 500,
                        color: isChecked ? 'var(--color-text)' : 'var(--color-text-muted)',
                        userSelect: 'none',
                        flex: 1,
                        minWidth: 0,
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const checked = e.target.checked;
                            handleTypeCountChange(qt.value, checked ? (lastNonZeroCounts[qt.value] || 1) : 0);
                          }}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: 'var(--color-primary)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ lineHeight: 1.35 }}>{qt.label}</span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>Count:</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={currentCount}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            handleTypeCountChange(qt.value, isNaN(val) ? 0 : Math.max(0, Math.min(20, val)));
                          }}
                          style={{
                            width: 52,
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: `1.5px solid ${isChecked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: isChecked ? 'var(--color-surface)' : '#f8fafc',
                            color: isChecked ? 'var(--color-text)' : 'var(--color-text-muted)',
                            fontSize: 13,
                            fontWeight: 600,
                            textAlign: 'center',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fixed Summary Footer */}
              <div style={{
                borderTop: '1.5px solid var(--color-border)',
                background: '#f8fafc',
                padding: '10px 16px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Total Items:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: totalCount > 50 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                    {totalCount}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: totalCount > 50 ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: 2 }}>
                  Max 20 items per type, 50 total
                  {totalCount > 50 && ' (⚠️ Exceeds 50 total maximum)'}
                </div>
              </div>
            </div>
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Level of Difficulty</label>
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

          {/* Assessment Boundaries */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Assessment Boundaries</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <input
              id="ai-assessment-boundaries"
              type="text"
              placeholder="e.g. Exclude biochemical mechanisms (Calvin cycle, Krebs cycle)"
              value={assessmentBoundaries}
              onChange={e => setAssessmentBoundaries(e.target.value)}
              style={{
                ...selectStyle,
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'text',
              }}
            />
          </div>

          {/* Assessment Target */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Assessment Target</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <textarea
              id="ai-assessment-target"
              rows={3}
              placeholder="e.g. MS-LS1-6: Construct a scientific explanation based on evidence for the role of photosynthesis in the cycling of matter and flow of energy into and out of organisms."
              value={assessmentTarget}
              onChange={e => setAssessmentTarget(e.target.value)}
              style={{
                ...selectStyle,
                resize: 'vertical',
                minHeight: 70,
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.45,
                fontStyle: assessmentTarget ? 'normal' : 'italic',
                cursor: 'text',
              }}
            />
          </div>

          {/* Cognitive Complexity */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cognitive Complexity</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <input
              id="ai-cognitive-complexity"
              type="text"
              placeholder="e.g. DOK Level 2 / Bloom's: Analysis (cause-and-effect reasoning)"
              value={cognitiveComplexity}
              onChange={e => setCognitiveComplexity(e.target.value)}
              style={{
                ...selectStyle,
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'text',
              }}
            />
          </div>

          {/* Additional Instructions */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Additional Instructions</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
            </label>
            <textarea
              id="ai-custom-prompt"
              rows={3}
              placeholder={`Examples:\n• Create questions from Trigonometry\n• Focus on Chapter 3 — Algebra\n• Give 5 options instead of 4\n• Include word problems only`}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              style={{
                ...selectStyle,
                resize: 'vertical',
                minHeight: 80,
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                fontStyle: customPrompt ? 'normal' : 'italic',
                cursor: 'text',
              }}
            />
            {(assessmentTarget.trim() || assessmentBoundaries.trim() || cognitiveComplexity.trim() || customPrompt.trim()) && (
              <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>💡</span> AI will strictly apply these assessment parameters and instructions
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            id="generate-btn"
            className="btn-generate"
            onClick={handleGenerate}
            disabled={generating || totalCount === 0 || totalCount > 50}
            style={{
              width: '100%', padding: '13px',
              background: (generating || totalCount === 0 || totalCount > 50) ? '#c7d2fe' : 'var(--color-primary)',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: (generating || totalCount === 0 || totalCount > 50) ? 'not-allowed' : 'pointer',
              boxShadow: (generating || totalCount === 0 || totalCount > 50) ? 'none' : '0 4px 14px rgba(79,110,247,0.35)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating {totalCount} Question{totalCount > 1 ? 's' : ''}...
              </>
            ) : totalCount === 0 ? 'Select a Question Type' : totalCount > 50 ? 'Exceeds 50 Max Total' : `✨ Generate ${totalCount} Question${totalCount > 1 ? 's' : ''}`}
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
                {genMeta.internetSource ? (
                  <span style={{ marginLeft: 6 }}>
                    for <strong style={{ color: 'var(--color-text)' }}>{grade} {contentArea}</strong>
                  </span>
                ) : (
                  <span>
                    {' '}from <strong style={{ color: 'var(--color-text)' }}>{genMeta.retrieved_chunk_count}</strong> syllabus chunks
                    {genMeta.ungrounded_dropped > 0 && (
                      <span style={{ color: '#b91c1c', fontWeight: 600 }}> · {genMeta.ungrounded_dropped} failed validation</span>
                    )}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  id="save-all-btn"
                  className="btn-save-all"
                  onClick={saveAll}
                  disabled={savingAll || savedIds.size === questions.length}
                  style={{
                    padding: '9px 20px',
                    background: savedIds.size === questions.length ? '#f0fdf4' : 'var(--color-primary)',
                    border: 'none',
                    borderRadius: 8,
                    color: savedIds.size === questions.length ? 'var(--color-success)' : '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: savingAll || savedIds.size === questions.length ? 'default' : 'pointer',
                    boxShadow: savedIds.size === questions.length ? 'none' : '0 4px 12px rgba(79,110,247,0.25)',
                    transition: 'all 0.15s',
                  }}
                >
                  {savingAll ? '💾 Saving...' : savedIds.size === questions.length ? '✅ All Saved' : '💾 Save All to Bank'}
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
              <div style={{ fontSize: 36, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>
                ✨
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                Generating questions...
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                AI is creating {totalCount} questions across selected types for {grade} {contentArea}
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
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0c0101ff' }}>Q{idx + 1}</span>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: qType.bg, color: qType.color }}>
                        {q.questionType?.replace('_', ' ')}
                      </span>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: qDiff.bg, color: qDiff.color, textTransform: 'capitalize' }}>
                        {q.difficulty}
                      </span>

                      {/* Grounding Status badge — only for syllabus-sourced questions */}
                      {!q._internetSource && (() => {
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
                            display: 'inline-flex', padding: '3px 10px', borderRadius: 5,
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
                            title="Show source references for this question"
                            style={{
                              padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
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
                          onClick={() => !isSaved && saveQuestion(q, idx)}
                          disabled={isSaved || isSaving}
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: isSaved ? '1px solid #bbf7d0' : '1px solid #ccd6ff',
                            background: isSaved ? '#f0fdf4' : 'var(--color-primary-light)',
                            color: isSaved ? 'var(--color-success)' : 'var(--color-primary)',
                            cursor: isSaved ? 'default' : 'pointer', transition: 'all 0.12s',
                          }}
                        >
                          {isSaving ? '💾 Saving...' : isSaved ? '✅ Saved' : '💾 Save'}
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

                    {/* Gap Match Passage & Response Options Display */}
                    {q.questionType === 'GAP_MATCH' && q.options && (() => {
                      const passageText = q.options.passage || '';
                      const responseOptions = Array.isArray(q.options.response_options)
                        ? q.options.response_options
                        : Array.isArray(q.options.label_bank)
                          ? q.options.label_bank
                          : [];
                      let answersObj = {};
                      if (typeof q.answer === 'object' && q.answer !== null) {
                        answersObj = q.answer;
                      } else if (typeof q.answer === 'string') {
                        try {
                          answersObj = JSON.parse(q.answer);
                        } catch (_) {
                          try {
                            const fixed = q.answer.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
                            answersObj = JSON.parse(fixed);
                          } catch (_) {}
                        }
                      }

                      const renderPassageWithGaps = () => {
                        if (!passageText) return <span style={{ color: 'var(--color-text-muted)' }}>No passage provided</span>;
                        const parts = passageText.split(/(\[gap_[a-zA-Z0-9_-]+\]|\[gap\s*[0-9]+\])/gi);
                        return parts.map((part, pIdx) => {
                          const match = part.match(/\[(gap_[a-zA-Z0-9_-]+|gap\s*[0-9]+)\]/i);
                          if (match) {
                            const gapKey = match[1].toLowerCase().replace(/\s+/g, '_');
                            return (
                              <span
                                key={pIdx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 100,
                                  height: 32,
                                  margin: '0 4px',
                                  padding: '2px 10px',
                                  borderRadius: 6,
                                  border: '2px dashed #2563eb',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontWeight: 600,
                                  fontSize: 12,
                                  verticalAlign: 'middle',
                                }}
                              >
                                [ {match[1]} ]
                              </span>
                            );
                          }
                          return <span key={pIdx}>{part}</span>;
                        });
                      };

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* Response Options Bank */}
                          {responseOptions.length > 0 && (
                            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#eff6ff', border: '1.5px solid #bfdbfe', marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                                📦 Response Options Bank
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {responseOptions.map((opt, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      background: '#ffffff',
                                      border: '1px solid #93c5fd',
                                      color: '#1e40af',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    }}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Passage Box with clean empty gaps */}
                          <div style={{
                            padding: '16px 20px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            lineHeight: 2.0,
                            fontSize: 14,
                            color: 'var(--color-text)',
                            marginBottom: 14,
                          }}>
                            {renderPassageWithGaps()}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Multiple Drop Bucket Display */}
                    {q.questionType === 'MULTIPLE_DROP_BUCKET' && q.options && (() => {
                      const optionBuckets = Array.isArray(q.options.option_buckets) ? q.options.option_buckets : [];
                      const dropBuckets = Array.isArray(q.options.drop_buckets) ? q.options.drop_buckets : [];

                      let answersObj = {};
                      const rawAns = q.answer;
                      if (typeof rawAns === 'object' && rawAns !== null && !Array.isArray(rawAns)) {
                        answersObj = rawAns;
                      } else if (typeof rawAns === 'string') {
                        try {
                          answersObj = JSON.parse(rawAns);
                        } catch (_) {
                          try {
                            const fixed = rawAns.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
                            answersObj = JSON.parse(fixed);
                          } catch (_) {}
                        }
                      }

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* Option Buckets */}
                          {optionBuckets.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>
                                📦 Option Buckets
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {optionBuckets.map((oBucket, bIdx) => (
                                  <div key={oBucket.id || bIdx} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1.5px solid #e2e8f0' }}>
                                    {oBucket.title && (
                                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0d6efd', marginBottom: 6 }}>
                                        {oBucket.title}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {(oBucket.options || []).map((opt, oIdx) => (
                                        <span
                                          key={oIdx}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            color: 'var(--color-text)',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                          }}
                                        >
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Target Drop Buckets */}
                          {dropBuckets.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>
                                📥 Target Drop Buckets
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(dropBuckets.length, 3)}, 1fr)`, gap: 10 }}>
                                {dropBuckets.map((dBucket, dIdx) => {
                                  const assigned = answersObj[dBucket.id] || answersObj[dBucket.name] || [];
                                  const assignedList = Array.isArray(assigned) ? assigned : [assigned].filter(Boolean);

                                  return (
                                    <div
                                      key={dBucket.id || dIdx}
                                      style={{
                                        padding: '12px 14px',
                                        background: '#f0f9ff',
                                        borderRadius: 8,
                                        border: '2px dashed #0284c7',
                                        minHeight: 100,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                      }}
                                    >
                                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>📥</span>
                                        <span>{dBucket.name || `Category ${dIdx + 1}`}</span>
                                      </div>
                                      {assignedList.length === 0 ? (
                                        <div style={{ fontSize: 11, color: '#0284c7', fontStyle: 'italic', opacity: 0.7, marginTop: 6 }}>
                                          [ Drop items here ]
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                          {assignedList.map((item, i) => (
                                            <span
                                              key={i}
                                              style={{
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                background: '#ffffff',
                                                border: '1px solid #7dd3fc',
                                                color: '#0369a1',
                                                fontSize: 12,
                                                fontWeight: 600,
                                              }}
                                            >
                                              {item}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Matrix Interaction Display */}
                    {q.questionType === 'MATRIX_INTERACTION' && q.options && (() => {
                      const headerText = q.options?.header || 'Header';
                      const rawCols = Array.isArray(q.options?.columns) ? q.options.columns : [];
                      const columns = rawCols.map((c, i) => (typeof c === 'object' ? c : { id: `col_${i + 1}`, value: String(c) }));
                      const rawRows = Array.isArray(q.options?.rows) ? q.options.rows : [];
                      const rows = rawRows.map((r, i) => (typeof r === 'object' ? r : { id: `row_${i + 1}`, value: String(r) }));

                      let answersObj = {};
                      const rawAns = q.answer;
                      if (typeof rawAns === 'object' && rawAns !== null && !Array.isArray(rawAns)) {
                        answersObj = rawAns;
                      } else if (typeof rawAns === 'string') {
                        const trimmed = rawAns.trim();
                        try {
                          answersObj = JSON.parse(trimmed);
                        } catch (_) {
                          try {
                            const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
                            let match;
                            while ((match = regex.exec(trimmed)) !== null) {
                              answersObj[match[1].trim()] = match[2].trim();
                            }
                          } catch (_) {}
                        }
                      }

                      const clean = (s) => (s || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '');

                      const isMatch = (row, col, rIdx, cIdx) => {
                        const cRowVal = clean(row.value);
                        const cRowId = clean(row.id);
                        const cColVal = clean(col.value);
                        const cColId = clean(col.id);

                        for (const [k, v] of Object.entries(answersObj)) {
                          const cK = clean(k);
                          const cV = clean(v);

                          const rowMatches =
                            k === row.value ||
                            k === row.id ||
                            cK === cRowVal ||
                            cK === cRowId ||
                            cK === `row${rIdx + 1}` ||
                            cK === `${rIdx + 1}` ||
                            (cRowVal.length > 8 && (cK.includes(cRowVal) || cRowVal.includes(cK)));

                          if (rowMatches) {
                            const colMatches =
                              v === col.value ||
                              v === col.id ||
                              cV === cColVal ||
                              cV === cColId ||
                              cV === `col${cIdx + 1}` ||
                              cV === `${cIdx + 1}`;

                            if (colMatches) return true;
                          }
                        }
                        return false;
                      };

                      return (
                        <div style={{ marginBottom: 16 }}>
                          <div
                            style={{
                              background: '#ffffff',
                              borderRadius: 10,
                              border: '1.5px solid #cbd5e1',
                              overflowX: 'auto',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 450 }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                  <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', width: '40%' }}>
                                    {headerText}
                                  </th>
                                  {columns.map((col, cIdx) => (
                                    <th
                                      key={col.id || cIdx}
                                      style={{
                                        padding: '12px 14px',
                                        fontWeight: 700,
                                        fontSize: 13,
                                        color: 'var(--color-text)',
                                        textAlign: 'center',
                                        borderRight: cIdx < columns.length - 1 ? '1.5px solid #cbd5e1' : 'none',
                                      }}
                                    >
                                      {col.value || `col ${cIdx + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row, rIdx) => (
                                  <tr
                                    key={row.id || rIdx}
                                    style={{
                                      borderBottom: rIdx < rows.length - 1 ? '1.5px solid #e2e8f0' : 'none',
                                      background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                                    }}
                                  >
                                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', fontWeight: 500 }}>
                                      {row.value || `Row ${rIdx + 1}`}
                                    </td>
                                    {columns.map((col, cIdx) => {
                                      const selected = isMatch(row, col, rIdx, cIdx);

                                      return (
                                        <td
                                          key={col.id || cIdx}
                                          style={{
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                            borderRight: cIdx < columns.length - 1 ? '1.5px solid #cbd5e1' : 'none',
                                            background: selected ? '#f0fdf4' : 'transparent',
                                          }}
                                        >
                                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selected ? (
                                              <div
                                                style={{
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: '50%',
                                                  background: '#22c55e',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                                                }}
                                              >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                              </div>
                                            ) : (
                                              <div
                                                style={{
                                                  width: 22,
                                                  height: 22,
                                                  borderRadius: '50%',
                                                  border: '2px solid #3b82f6',
                                                  background: '#ffffff',
                                                }}
                                              />
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Select Text Display */}
                    {q.questionType === 'SELECT_TEXT' && q.options && (() => {
                      const selectionType = q.options?.selection_type || 'Sentence';
                      const maxSelections = q.options?.max_selections || 1;
                      const passageText = q.options?.passage || '';

                      let targetAnswers = [];
                      const rawAns = q.answer;
                      if (Array.isArray(rawAns)) {
                        targetAnswers = rawAns.flatMap(item => typeof item === 'string' && item.includes('|') ? item.split('|').map(s => s.trim()) : [item]);
                      } else if (typeof rawAns === 'string') {
                        const trimmed = rawAns.trim();
                        try {
                          const p = JSON.parse(trimmed);
                          if (Array.isArray(p)) targetAnswers = p.flatMap(item => typeof item === 'string' && item.includes('|') ? item.split('|').map(s => s.trim()) : [item]);
                          else if (trimmed.includes('|')) targetAnswers = trimmed.split('|').map(s => s.trim());
                          else targetAnswers = [trimmed];
                        } catch (_) {
                          try {
                            const fixed = trimmed.replace(/'/g, '"');
                            const p = JSON.parse(fixed);
                            if (Array.isArray(p)) targetAnswers = p.flatMap(item => typeof item === 'string' && item.includes('|') ? item.split('|').map(s => s.trim()) : [item]);
                            else if (trimmed.includes('|')) targetAnswers = trimmed.split('|').map(s => s.trim());
                            else targetAnswers = [trimmed];
                          } catch (_) {
                            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                              const inner = trimmed.slice(1, -1);
                              targetAnswers = inner.split(',').flatMap(s => s.trim().replace(/^['"]|['"]$/g, '').split('|').map(x => x.trim())).filter(Boolean);
                            } else if (trimmed.includes('|')) {
                              targetAnswers = trimmed.split('|').map(s => s.trim()).filter(Boolean);
                            } else {
                              targetAnswers = [trimmed];
                            }
                          }
                        }
                      }

                      let tokens = [];
                      if (selectionType === 'Paragraph') {
                        tokens = passageText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
                      } else if (selectionType === 'Words') {
                        tokens = passageText.split(/\s+/).map(w => w.trim()).filter(Boolean);
                      } else {
                        tokens = passageText.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$/g) || [passageText];
                        tokens = tokens.map(s => s.trim()).filter(Boolean);
                      }

                      // Build set of target words when in Words selection mode
                      const cleanWord = (s) => (s || '').trim().replace(/^[“"'.,;:!?|/\\_-]+|[”"'.,;:!?|/\\_-]+$/g, '').toLowerCase();
                      const targetWordSet = new Set();
                      if (selectionType === 'Words') {
                        targetAnswers.forEach(ans => {
                          (ans || '').toLowerCase().replace(/[“"'.,;:!?|/\\_-]/g, ' ').split(/\s+/).forEach(w => {
                            if (w.trim()) targetWordSet.add(w.trim());
                          });
                        });
                      }

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* Selection Type & Max Selections Metadata Pill Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                              <span>Selection Type:</span>
                              <strong style={{ color: '#6d28d9' }}>{selectionType}</strong>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                              <span>Max Selections:</span>
                              <strong style={{ color: '#1e40af' }}>{maxSelections}</strong>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: '16px 18px',
                              borderRadius: 10,
                              background: '#f8fafc',
                              border: '1.5px solid #e2e8f0',
                              lineHeight: 2.0,
                              fontSize: 14,
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: selectionType === 'Paragraph' ? 14 : selectionType === 'Words' ? 6 : 8,
                            }}
                          >
                            {tokens.map((tokenText, idx) => {
                              const cTok = cleanWord(tokenText);
                              const isSelected = selectionType === 'Words'
                                ? targetWordSet.has(cTok)
                                : targetAnswers.some(ans => {
                                    const cAns = cleanWord(ans);
                                    if (!cAns || !cTok) return false;
                                    return cAns === cTok || (cAns.length >= 6 && cTok.includes(cAns)) || (cTok.length >= 6 && cAns.includes(cTok));
                                  });

                              return (
                                <span
                                  key={idx}
                                  style={{
                                    display: selectionType === 'Paragraph' ? 'block' : 'inline-flex',
                                    width: selectionType === 'Paragraph' ? '100%' : 'auto',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: selectionType === 'Paragraph' ? '10px 14px' : '4px 10px',
                                    borderRadius: 6,
                                    background: isSelected ? '#dcfce7' : '#ffffff',
                                    border: `1.5px solid ${isSelected ? '#16a34a' : '#cbd5e1'}`,
                                    color: isSelected ? '#15803d' : 'var(--color-text)',
                                    fontWeight: isSelected ? 600 : 400,
                                    boxShadow: isSelected ? '0 2px 4px rgba(22, 163, 74, 0.15)' : 'none',
                                  }}
                                >
                                  {isSelected && (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#16a34a',
                                        color: '#ffffff',
                                        fontSize: 10,
                                        fontWeight: 900,
                                        marginRight: 2,
                                        flexShrink: 0,
                                      }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                  <span>{tokenText}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Background Graphic Interactive SVG Display */}
                    {q.questionType === 'BACKGROUND_GRAPHIC' && q.options && (() => {
                      const dropZones = q.options.drop_zones || [];
                      const labelBank = q.options.label_bank || [];
                      const zoneWidth = q.options.drop_zone_width || 120;
                      const zoneHeight = q.options.drop_zone_height || 36;
                      const answersObj = typeof q.answer === 'object' && q.answer !== null ? q.answer : {};

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* SVG Diagram Canvas */}
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 620,
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '1.5px solid #cbd5e1',
                            background: '#f8fafc',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
                            marginBottom: 14,
                          }}>
                            {/* Raw SVG rendering */}
                            {q.options.svg_graphic ? (
                              <div
                                dangerouslySetInnerHTML={{ __html: q.options.svg_graphic }}
                                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                              />
                            ) : (
                              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                🖼️ Diagram Graphic
                              </div>
                            )}

                            {/* Drop Zone Pins Overlay (Empty Target Boxes) */}
                            {dropZones.map((zone) => (
                              <div
                                key={zone.id}
                                title={zone.description ? `Pin ${zone.pin_label}: ${zone.description}` : `Drop Zone ${zone.pin_label}`}
                                style={{
                                  position: 'absolute',
                                  left: `${zone.x_percent || 50}%`,
                                  top: `${zone.y_percent || 50}%`,
                                  transform: 'translate(-50%, -50%)',
                                  width: zoneWidth,
                                  height: zoneHeight,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  border: '2px dashed #059669',
                                  background: 'rgba(255, 255, 255, 0.88)',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  backdropFilter: 'blur(3px)',
                                  zIndex: 2,
                                  cursor: 'pointer',
                                }}
                              >
                                <span style={{
                                  background: '#059669',
                                  color: '#fff',
                                  borderRadius: '50%',
                                  width: 22,
                                  height: 22,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}>
                                  {zone.pin_label || '•'}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  color: '#059669',
                                  fontWeight: 500,
                                  opacity: 0.7,
                                  fontStyle: 'italic',
                                  letterSpacing: '0.02em',
                                }}>
                                  [ Drop Here ]
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Label Bank */}
                          {labelBank.length > 0 && (
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', marginBottom: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                🏷️ Label Bank
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {labelBank.map((lbl, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      background: '#ffffff',
                                      border: '1.5px solid #6ee7b7',
                                      color: '#065f46',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}
                                  >
                                    {lbl}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Answer & Rationale */}
                    <div style={{
                      background: '#f8f9fb', borderRadius: 8, padding: '12px 14px',
                      borderLeft: '3px solid var(--color-primary)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Answer Key
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: q.explanation ? 10 : 0 }}>
                        {(() => {
                          let ansObj = null;
                          let ansArray = null;

                          if (Array.isArray(q.answer)) {
                            ansArray = q.answer;
                          } else if (typeof q.answer === 'string') {
                            const trimmed = q.answer.trim();
                            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                              try {
                                const parsed = JSON.parse(trimmed);
                                if (Array.isArray(parsed)) ansArray = parsed;
                              } catch (_) {}
                            } else if (trimmed.startsWith('{') || trimmed.includes(':')) {
                              try {
                                ansObj = JSON.parse(trimmed);
                              } catch (_) {
                                try {
                                  const fixed = trimmed.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
                                  ansObj = JSON.parse(fixed);
                                } catch (_) {}
                              }
                            }
                          } else if (typeof q.answer === 'object' && q.answer !== null) {
                            ansObj = q.answer;
                          }

                          if (ansArray && ansArray.length > 0) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ansArray.map((ansText, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 600, fontSize: 13 }}>
                                    <span>✓</span>
                                    <span>"{ansText}"</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }

                          if (ansObj && typeof ansObj === 'object') {
                            const normalized = [];
                            const seen = new Set();
                            Object.entries(ansObj).forEach(([k, v]) => {
                              let keyLabel = k;
                              const gapMatch = k.match(/gap_?([0-9]+)/i);
                              if (gapMatch) {
                                keyLabel = `Gap ${gapMatch[1]}`;
                              } else if (k.toLowerCase().startsWith('drop_bucket_') || k.toLowerCase().startsWith('bucket_')) {
                                const bucketName = q.options?.drop_buckets?.find(b => b.id === k)?.name;
                                keyLabel = bucketName || k;
                              } else if (k.toLowerCase().startsWith('zone_')) {
                                const pin = q.options?.drop_zones?.find(z => z.id === k)?.pin_label;
                                keyLabel = pin ? `Pin ${pin}` : k;
                              }
                              const valStr = Array.isArray(v) ? v.join(', ') : String(v);
                              if (!seen.has(keyLabel)) {
                                seen.add(keyLabel);
                                normalized.push([keyLabel, valStr]);
                              }
                            });

                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {normalized.map(([k, v]) => (
                                  <span key={k} style={{ padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                                    <strong>{k}:</strong> {v}
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          return <span>{q.answer}</span>;
                        })()}
                      </div>
                      {q.explanation && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Rationale
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {q.explanation}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Source detail (expandable): exact file + page + chapter for cross-verification */}
                    {src && (q.sources?.length > 0 || q.sourceChunkIds?.length > 0) && (
                      <div style={{
                        marginTop: 10, padding: '10px 14px',
                        background: q._internetSource ? '#f0fdf4' : '#fffbeb',
                        borderRadius: 8,
                        border: q._internetSource ? '1px solid #bbf7d0' : '1px solid #fde68a',
                        fontSize: 12,
                        color: q._internetSource ? '#166534' : '#92400e',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {q._internetSource
                            ? `Reference Website${q.sources?.length > 1 ? 's' : ''}`
                            : `Source${q.sources?.length > 1 ? 's' : ''} — for cross-verification against the syllabus`
                          }
                        </div>
                        {q.sources?.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {q.sources.map((s, si) => {
                              const isHttp = s.filename?.startsWith('http://') || s.filename?.startsWith('https://');
                              // For internet sources: always link to root domain to avoid hallucinated 404 paths.
                              // e.g. https://www.mathsisfun.com/algebra/radical-expressions.html → https://www.mathsisfun.com
                              let safeHref = s.filename;
                              if (q._internetSource && isHttp) {
                                try { safeHref = new URL(s.filename).origin; } catch (_) { /* keep original */ }
                              }
                              return (
                                <li key={si} style={{ marginBottom: 2 }}>
                                  {isHttp ? (
                                    <a
                                      href={safeHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#16a34a',
                                        textDecoration: 'underline',
                                        fontWeight: 600,
                                        wordBreak: 'break-all',
                                      }}
                                    >
                                      {q._internetSource ? (s.chapter || 'Web Link') : s.filename}
                                    </a>
                                  ) : (
                                    <strong>{s.filename}</strong>
                                  )}
                                  {s.page ? `, page ${s.page}` : ''}
                                  {s.chapter && !q._internetSource ? ` — ${s.chapter}` : ''}
                                  {s.chunk_type === 'image' ? ' (image)' : ''}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <span>Chunk ids: {q.sourceChunkIds.join(', ')}</span>
                        )}

                        {/* Grounding / fact-check status — only shown for syllabus-sourced questions */}
                        {!q._internetSource && (
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
                        )}

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
            position: 'relative',
          }}>
            {/* X close button */}
            <button
              onClick={closeRegenModal}
              aria-label="Close regenerate modal"
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
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>🔄 Regenerate / Refine Question</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Q{regenModal.idx + 1} — {regenModal.question.questionType?.replace(/_/g, ' ')} ({regenModal.question.difficulty})
                </div>
              </div>
            </div>

            {/* Original Question Stem Preview */}
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
              marginBottom: 18, border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Original Question Stem
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, fontWeight: 600 }}>
                {regenModal.question.text}
              </div>
            </div>

            {/* What would you like to refine? (Target Checkboxes) */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>
                What would you like to refine?
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}>
                {getRefinementTargetsForType(regenModal.question.questionType).map(target => {
                  const isChecked = refinementTargets.includes(target.id);
                  return (
                    <label
                      key={target.id}
                      onClick={() => toggleRefinementTarget(target.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1.5px solid ${isChecked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isChecked ? '#f0f4ff' : 'var(--color-surface)',
                        color: isChecked ? 'var(--color-primary)' : 'var(--color-text)',
                        fontSize: 13,
                        fontWeight: isChecked ? 600 : 500,
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.12s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => { }} // handled by label onClick
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: 'var(--color-primary)',
                          cursor: 'pointer',
                        }}
                      />
                      <span>{target.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Refinement Instructions (Mandatory) */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...labelStyle, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Refinement Instructions</span>
              </label>
              <textarea
                id="regen-instructions"
                rows={3}
                placeholder={`Examples:\n• Change Option C to focus on chloroplasts instead of cell walls\n• Make the question stem more concise and direct\n• Provide more tempting distractors for Grade 8 level`}
                value={regenInstructions}
                onChange={e => setRegenInstructions(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${!regenInstructions.trim() && refinementTargets.length > 0 ? '#fca5a5' : 'var(--color-border)'}`,
                  fontSize: 13,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  resize: 'vertical', outline: 'none', lineHeight: 1.5,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {/* Validation helper hints */}
              {refinementTargets.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 6, fontWeight: 500 }}>
                  ⚠️ Please select at least one component above to refine.
                </div>
              ) : !regenInstructions.trim() ? (
                <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 6, fontWeight: 500 }}>
                  ✍️ Please specify what you would like the AI to change in the instructions above.
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 6, fontWeight: 500 }}>
                  💡 AI will surgically apply these instructions to the selected component(s).
                </div>
              )}
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                className="btn-modal-cancel"
                onClick={closeRegenModal}
                disabled={regenerating}
                style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: '1.5px solid #cbd5e1', background: '#f8fafc',
                  color: '#475569', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                id="regen-confirm-btn"
                className="btn-modal-confirm"
                onClick={handleRegenerate}
                disabled={regenerating || refinementTargets.length === 0 || !regenInstructions.trim()}
                style={{
                  padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: 'none',
                  background: (regenerating || refinementTargets.length === 0 || !regenInstructions.trim()) ? '#cbd5e1' : '#7c3aed',
                  color: (regenerating || refinementTargets.length === 0 || !regenInstructions.trim()) ? '#64748b' : '#fff',
                  cursor: (regenerating || refinementTargets.length === 0 || !regenInstructions.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                  boxShadow: (regenerating || refinementTargets.length === 0 || !regenInstructions.trim()) ? 'none' : '0 4px 14px rgba(124, 58, 237, 0.35)',
                }}
              >
                {regenerating ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Applying Refinement…
                  </>
                ) : '✨ Apply Refinement'}
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
                      border: '1.5px solid #cbd5e1', background: '#f8fafc',
                      color: '#475569', cursor: 'pointer',
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
  fontSize: 12, fontWeight: 700, color: '#1e293b',
  display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const selectStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #cbd5e1', fontSize: 14,
  background: 'var(--color-surface)', color: '#0f172a',
  outline: 'none', cursor: 'pointer',
};
