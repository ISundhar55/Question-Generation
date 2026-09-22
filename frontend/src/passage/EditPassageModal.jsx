import React, { useState } from 'react';
import { passagesAPI } from '../services/api';

export default function EditPassageModal({ passage, onSaveSuccess, onClose }) {
  if (!passage) return null;

  const [title, setTitle] = useState(passage.title || '');
  const [text, setText] = useState(passage.text || '');
  const [genre, setGenre] = useState(passage.genre || 'informational');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  const handleSave = async (e, forceStatus = null) => {
    e && e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!text.trim()) {
      setError('Passage text is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const targetStatus = forceStatus || passage.status || 'ready_for_review';
    const updatePayload = {
      title: title.trim(),
      text: text.trim(),
      genre,
      word_count: wordCount,
      grade: passage.grade,
      content_area: passage.content_area,
      assessment_target: passage.assessment_target,
      assessment_boundaries: passage.assessment_boundaries,
      status: targetStatus,
      visual: passage.visual || null,
    };

    try {
      let updated = { ...passage, ...updatePayload };
      if (passage.id) {
        const res = await passagesAPI.update(passage.id, updatePayload);
        if (res.data) {
          updated = { ...updated, ...res.data };
        }
      } else {
        const res = await passagesAPI.create(updatePayload);
        if (res.data) {
          updated = { ...updated, ...res.data };
        }
      }
      onSaveSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update passage:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        width: '100%',
        maxWidth: 720,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid #e2e8f0',
      }} onClick={e => e.stopPropagation()}>

        {/* Modal Header */}
        <div style={{
          padding: '16px 22px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                Edit Stimulus Passage
              </h3>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                Update title, genre, or reading text
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Form */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 16,
            }}>
              ❌ {error}
            </div>
          )}

          {/* Title Field */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Passage Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Deep Ocean Hydrothermal Vents"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                fontSize: 14,
                fontWeight: 600,
                color: '#1e293b',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Genre Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Genre Discipline
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setGenre('informational')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1.5px solid ${genre === 'informational' ? '#0d9488' : '#cbd5e1'}`,
                  background: genre === 'informational' ? '#f0fdfa' : '#ffffff',
                  color: genre === 'informational' ? '#0f766e' : '#64748b',
                  transition: 'all 0.12s',
                }}
              >
                🔬 Informational / Non-Fiction
              </button>
              <button
                type="button"
                onClick={() => setGenre('literary')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1.5px solid ${genre === 'literary' ? '#db2777' : '#cbd5e1'}`,
                  background: genre === 'literary' ? '#fdf2f8' : '#ffffff',
                  color: genre === 'literary' ? '#be185d' : '#64748b',
                  transition: 'all 0.12s',
                }}
              >
                📖 Literary Fiction / Prose
              </button>
            </div>
          </div>

          {/* Reading Text Box */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                Reading Text Content <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {wordCount} words
              </span>
            </div>
            <textarea
              rows={12}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Enter or paste reading passage text here..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                fontSize: 14,
                lineHeight: 1.65,
                color: '#1e293b',
                fontFamily: 'Georgia, serif',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                minHeight: 240,
              }}
            />
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div style={{
          padding: '12px 22px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSave(e)}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              color: '#1e293b',
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
          {passage.status !== 'approved' && (
            <button
              type="button"
              onClick={(e) => handleSave(e, 'approved')}
              disabled={saving}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: saving ? '#86efac' : '#16a34a',
                fontSize: 13,
                fontWeight: 700,
                color: '#ffffff',
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: saving ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {saving ? 'Saving...' : '✓ Save & Approve'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
