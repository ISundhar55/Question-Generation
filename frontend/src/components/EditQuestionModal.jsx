import React from 'react';
import { QuestionCreator } from 'question-storybook-ui';
import { questionsAPI } from '../services/api';

/**
 * EditQuestionModal
 * -----------------
 * Standalone modal dialog that hosts QuestionCreator and encapsulates
 * the full save/update API lifecycle for editing AI-generated questions.
 */
export default function EditQuestionModal({ question, idx, onSaveSuccess, onClose }) {
  if (!question) return null;

  // Prepare initialData for QuestionCreator with accurate points calculation
  const initialData = {
    ...question,
    type: question.questionType || question.type || 'SINGLE_SELECT',
    points: question.points || (question.difficulty === 'hard' ? 3 : question.difficulty === 'medium' ? 2 : 1),
    visual: question.visual || (typeof question.options === 'object' && question.options !== null ? question.options.visual : null) || null,
  };

  const handleSaveEditedQuestion = async (payload) => {
    let savedId = question.id;
    const computedPoints = payload.points || question.points || (payload.difficulty === 'hard' ? 3 : payload.difficulty === 'medium' ? 2 : 1);

    const apiPayload = {
      type: payload.type || question.questionType || question.type,
      text: payload.text,
      options: payload.options || null,
      answer: payload.answer,
      difficulty: payload.difficulty || question.difficulty || 'medium',
      points: computedPoints,
      explanation: payload.explanation || question.explanation || null,
    };

    try {
      if (savedId) {
        // If question already exists in DB, update it
        const res = await questionsAPI.update(savedId, apiPayload);
        if (res.data?.id) savedId = res.data.id;
      } else {
        // If question was not yet in DB, create it
        const res = await questionsAPI.create(apiPayload);
        if (res.data?.id) savedId = res.data.id;
      }

      // Merge updated fields and DB id back into the question state object
      const updatedQuestion = {
        ...question,
        ...apiPayload,
        id: savedId,
        questionType: apiPayload.type,
        // Preserve AI grounding, sources, and visual diagram metadata
        explanation: payload.explanation || question.explanation,
        sources: question.sources || [],
        sourceChunkIds: question.sourceChunkIds || [],
        _internetSource: question._internetSource || false,
        grounded: question.grounded,
        groundingScore: question.groundingScore,
        groundingNote: question.groundingNote,
        visual: question.visual || question.options?.visual || payload.options?.visual || null,
      };

      if (onSaveSuccess) {
        onSaveSuccess(updatedQuestion, idx);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Save edited question API error:', err);
      // Fallback: update local UI state even if network fails
      const fallbackQuestion = {
        ...question,
        ...apiPayload,
        questionType: apiPayload.type,
        explanation: payload.explanation || question.explanation,
      };
      if (onSaveSuccess) {
        onSaveSuccess(fallbackQuestion, idx);
      }
      if (onClose) {
        onClose();
      }
      alert(err.response?.data?.message || 'Failed to save changes to server. Please check your connection.');
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 1080,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--color-border, #e2e8f0)',
          animation: 'slideUp 0.18s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Clean Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Edit Question Q{idx + 1}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted, #64748b)', marginTop: 1 }}>
                Type: <strong>{initialData.type?.replace(/_/g, ' ')}</strong>
              </div>
            </div>
          </div>

          {/* Top-Right X Close Button */}
          <button
            onClick={onClose}
            aria-label="Close edit modal"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--color-border, #cbd5e1)',
              background: '#ffffff',
              color: 'var(--color-text-muted, #64748b)',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              lineHeight: 1,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = 'var(--color-text-muted, #64748b)';
              e.currentTarget.style.borderColor = 'var(--color-border, #cbd5e1)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable QuestionCreator Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: 'var(--color-surface, #ffffff)',
          }}
        >
          <QuestionCreator
            initialData={initialData}
            onSave={handleSaveEditedQuestion}
            onClose={onClose}
            hideHeader={true}
            hideTypeSelect={true}
          />
        </div>
      </div>
    </div>
  );
}
