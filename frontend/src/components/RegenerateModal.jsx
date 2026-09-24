import React, { useState } from 'react';
import { aiAPI, questionsAPI } from '../services/api';
import { sanitizeOptions } from '../utils/questionUtils';
import { getRefinementTargetsForType } from '../pages/aiGenerateConstants';

/**
 * Helper to compile rationales into explanation string
 */
const resolveExplanation = (q) => {
  if (q.explanation && typeof q.explanation === 'string' && q.explanation.trim()) return q.explanation.trim();
  if (q.rationale && typeof q.rationale === 'string' && q.rationale.trim()) return q.rationale.trim();
  if (q.options?.explanation && typeof q.options.explanation === 'string' && q.options.explanation.trim()) return q.options.explanation.trim();
  if (q.options?.rationale && typeof q.options.rationale === 'string' && q.options.rationale.trim()) return q.options.rationale.trim();

  if (Array.isArray(q.options?.rationales) && q.options.rationales.length > 0) {
    const bullets = q.options.rationales
      .map((r, i) => (typeof r === 'string' && r.trim()) ? `• Option ${String.fromCharCode(65 + i)}: ${r.trim()}` : null)
      .filter(Boolean);
    if (bullets.length > 0) return bullets.join('\n');
  } else if (q.options?.rationales && typeof q.options.rationales === 'object') {
    const bullets = Object.entries(q.options.rationales)
      .map(([k, r]) => (typeof r === 'string' && r.trim()) ? `• ${k}: ${r.trim()}` : null)
      .filter(Boolean);
    if (bullets.length > 0) return bullets.join('\n');
  }
  return null;
};

const buildSavePayload = (q, targetStatus = 'draft') => {
  let payloadOptions = sanitizeOptions(q.options);
  const visualSvg = q.visual || (typeof q.options === 'object' && q.options !== null ? q.options.visual : null);
  if (visualSvg) {
    if (typeof payloadOptions === 'object' && payloadOptions !== null && !Array.isArray(payloadOptions)) {
      payloadOptions = { ...payloadOptions, visual: visualSvg };
    }
  }
  return {
    type: q.questionType,
    text: q.text,
    options: payloadOptions,
    answer: q.answer,
    difficulty: q.difficulty,
    points: q.points || (q.difficulty === 'hard' ? 3 : q.difficulty === 'medium' ? 2 : 1),
    explanation: resolveExplanation(q),
    status: targetStatus,
    passage_id: q.passage_id || undefined,
  };
};

/**
 * RegenerateModal
 * ---------------
 * Modal dialog that allows refining and regenerating an individual question
 * using specific targets and teacher instructions.
 */
export default function RegenerateModal({
  question,
  idx,
  sourceMode,
  selectedPassage,
  contentArea,
  grade,
  onSuccess,
  onClose,
}) {
  const [regenInstructions, setRegenInstructions] = useState('');
  const [refinementTargets, setRefinementTargets] = useState([]); // all unchecked by default
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(null);

  if (!question) return null;

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
    setRegenerating(true);
    setRegenError(null);
    try {
      const isPassageQuestion = Boolean(
        question.passage_id ||
        question.passageId ||
        question._passageGrounded ||
        (sourceMode === 'passage' && selectedPassage)
      );
      const passageTextToUse = isPassageQuestion
        ? (question.passage_text || (selectedPassage?.text || null))
        : null;
      const passageIdToUse = isPassageQuestion
        ? (question.passage_id || question.passageId || selectedPassage?.id || null)
        : null;
      const passageTitleToUse = isPassageQuestion
        ? (question.passage_title || selectedPassage?.title || null)
        : null;

      const res = await aiAPI.regenerate({
        content_area: question.contentArea || contentArea,
        grade: question.grade || grade,
        question_type: question.questionType,
        difficulty: question.difficulty,
        original_question: question,
        modification_instructions: regenInstructions.trim(),
        refinement_targets: refinementTargets,
        source_chunk_ids: question.sourceChunkIds || [],
        passage_text: passageTextToUse,
        passage_id: passageIdToUse,
        passage_title: passageTitleToUse,
      });

      const newQuestion = {
        ...res.data.question,
        points: res.data.question.points || question.points || (question.difficulty === 'hard' ? 3 : question.difficulty === 'medium' ? 2 : 1),
        _internetSource: isPassageQuestion ? false : question._internetSource,
        _passageGrounded: isPassageQuestion,
        passage_id: passageIdToUse,
        passage_title: passageTitleToUse,
        passage_text: passageTextToUse,
        status: 'draft',
      };

      // Auto-save the regenerated question to DB
      try {
        if (question.id) {
          await questionsAPI.update(question.id, buildSavePayload(newQuestion, 'draft'));
          newQuestion.id = question.id;
        } else {
          const saveRes = await questionsAPI.create(buildSavePayload(newQuestion, 'draft'));
          if (saveRes.data?.id) newQuestion.id = saveRes.data.id;
        }
      } catch (saveErr) {
        console.warn('Auto-saving regenerated question failed:', saveErr);
      }

      if (onSuccess) {
        onSuccess(idx, newQuestion);
      }
      onClose();
    } catch (err) {
      setRegenError(err.response?.data?.message || 'Regeneration failed. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: '#1e293b',
    display: 'block',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
        background: 'var(--color-surface, #fff)',
        borderRadius: 16,
        padding: 28,
        width: '100%',
        maxWidth: 560,
        maxHeight: '95vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        border: '1px solid var(--color-border, #e2e8f0)',
        animation: 'slideUp 0.18s ease',
        position: 'relative',
      }}>
        {/* X close button */}
        <button
          onClick={onClose}
          aria-label="Close regenerate modal"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid var(--color-border, #e2e8f0)',
            background: 'transparent',
            color: 'var(--color-text-muted, #64748b)',
            fontSize: 16, fontWeight: 700, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--color-text, #0f172a)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted, #64748b)'; }}
        >
          &#x2715;
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              🔄 Regenerate / Refine Question
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted, #64748b)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Q{idx + 1} — {question.questionType?.replace(/_/g, ' ')} ({question.difficulty})</span>
              {(question.passage_title || question.passage_id || question._passageGrounded || (sourceMode === 'passage' && selectedPassage)) && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  color: '#0f766e',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}>
                  📖 Stimulus: {question.passage_title || selectedPassage?.title || (question.passage_id ? `Passage #${question.passage_id}` : 'Reading Passage')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Original Question Stem Preview */}
        <div style={{
          background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
          marginBottom: 16, border: '1px solid var(--color-border, #e2e8f0)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Original Question Stem
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text, #0f172a)', lineHeight: 1.5, fontWeight: 600, maxHeight: 72, overflowY: 'auto' }}>
            {question.text}
          </div>
        </div>

        {/* What would you like to refine? (Target Checkboxes) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>
            What would you like to refine?
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            {getRefinementTargetsForType(question.questionType).map(target => {
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
                    border: `1.5px solid ${isChecked ? 'var(--color-primary, #4f6ef7)' : 'var(--color-border, #e2e8f0)'}`,
                    background: isChecked ? '#f0f4ff' : 'var(--color-surface, #fff)',
                    color: isChecked ? 'var(--color-primary, #4f6ef7)' : 'var(--color-text, #0f172a)',
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
                      accentColor: 'var(--color-primary, #4f6ef7)',
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
        <div style={{ marginBottom: 18 }}>
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
              border: `1.5px solid ${!regenInstructions.trim() && refinementTargets.length > 0 ? '#fca5a5' : 'var(--color-border, #cbd5e1)'}`,
              fontSize: 13,
              background: 'var(--color-surface, #fff)', color: 'var(--color-text, #0f172a)',
              resize: 'vertical', outline: 'none', lineHeight: 1.5,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          {/* Validation helper hints */}
          {refinementTargets.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--color-primary, #4f6ef7)', marginTop: 6, fontWeight: 500 }}>
              ⚠️ Please select at least one component above to refine.
            </div>
          ) : !regenInstructions.trim() ? (
            <div style={{ fontSize: 11, color: 'var(--color-primary, #4f6ef7)', marginTop: 6, fontWeight: 500 }}>
              ✍️ Please specify what you would like the AI to change in the instructions above.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--color-primary, #4f6ef7)', marginTop: 6, fontWeight: 500 }}>
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
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
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
            type="button"
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
  );
}
