import React, { useState } from 'react';
import { aiAPI } from '../services/api';

/**
 * FeedbackModal
 * -------------
 * Modal dialog for collecting teacher feedback, star rating, category,
 * and comments on a generated question.
 */
export default function FeedbackModal({
  question,
  contentArea,
  grade,
  onClose,
}) {
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  if (!question) return null;

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
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
          onClick={onClose}
          aria-label="Close feedback modal"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: '50%',
            border: 'none', background: 'var(--color-border, #f1f5f9)',
            color: 'var(--color-text-muted, #64748b)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, lineHeight: 1,
          }}
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
            <div style={{ fontSize: 13, color: 'var(--color-text-muted, #64748b)', marginBottom: 24, lineHeight: 1.5 }}>
              Your comments have been saved and will be used to improve future question generation for{' '}
              <strong>{question.contentArea || contentArea} {question.grade || grade}</strong>.
            </div>
            <button
              type="button"
              onClick={onClose}
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
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text, #0f172a)', marginBottom: 4 }}>
                💬 Question Feedback
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted, #64748b)' }}>
                Your feedback helps the AI generate better questions for future sessions.
              </div>
            </div>

            {/* Question preview */}
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: '#f8fafc',
              border: '1px solid var(--color-border, #e2e8f0)', marginBottom: 20,
              fontSize: 12, color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>Question: </span>
              {question.text?.slice(0, 160)}{question.text?.length > 160 ? '…' : ''}
            </div>

            {/* Star rating */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Overall Quality Rating
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
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
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted, #64748b)', alignSelf: 'center', marginLeft: 4 }}>
                    {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][feedbackRating]}
                  </span>
                )}
              </div>
            </div>

            {/* Category pills */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
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
                      type="button"
                      className="feedback-cat-pill"
                      onClick={() => setFeedbackCategory(cat.value)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: active ? '#0369a1' : '#f1f5f9',
                        color: active ? '#fff' : 'var(--color-text-muted, #64748b)',
                        border: active ? '1px solid #0369a1' : '1px solid var(--color-border, #e2e8f0)',
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
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
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
                  border: '1.5px solid var(--color-border, #cbd5e1)', background: 'var(--color-surface, #fff)',
                  color: 'var(--color-text, #0f172a)', resize: 'vertical', fontFamily: 'inherit',
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
                type="button"
                className="btn-modal-cancel"
                onClick={onClose}
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
                type="button"
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
  );
}
