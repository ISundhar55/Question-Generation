import React, { useState } from 'react';
import { DiagramViewer } from 'question-storybook-ui';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  ready_for_review: { label: 'Ready for Review', color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' },
  approved: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
};

export default function PassageCard({
  passage,
  index,
  onUpdateStatus,
  onDelete,
  onGenerateQuestions,
  onEdit,
  readOnly = false,
  showCopy = true,
  showTargetBoundaries = true,
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const status = passage.status || 'draft';
  const statusMeta = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  const handleCopy = () => {
    const textToCopy = `${passage.title}\n\n${passage.text}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="passage-card"
      style={{
        background: 'var(--color-surface, #ffffff)',
        borderRadius: 12,
        border: `1.5px solid ${statusMeta.border}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: 20,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header bar */}
      <div style={{
        padding: '12px 18px',
        background: '#f8fafc',
        borderBottom: '1px solid var(--color-border, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            background: '#0d9488',
            color: '#ffffff',
            fontSize: 11.5,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
          }}>
            📖 Stimulus Passage
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
            {passage.title}
          </h3>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 12,
            background: passage.genre === 'literary' ? '#fdf2f8' : '#eff6ff',
            color: passage.genre === 'literary' ? '#db2777' : '#2563eb',
            border: `1px solid ${passage.genre === 'literary' ? '#fbcfe8' : '#bfdbfe'}`,
            textTransform: 'capitalize',
          }}>
            {passage.genre === 'literary' ? '📖 Literary Fiction' : '🔬 Informational'}
          </span>
        </div>

        {/* Status Badge & Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 14,
            background: statusMeta.bg,
            color: statusMeta.color,
            border: `1px solid ${statusMeta.border}`,
          }}>
            {statusMeta.label}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11.5,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '16px 20px' }}>

          {/* Visual Stimulus Diagram */}
          {passage.visual && (
            <div style={{ marginBottom: 16 }}>
              <DiagramViewer
                svgCode={passage.visual}
                filename={`passage_${(passage.title || 'diagram').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
              />
            </div>
          )}

          {/* Reading text box */}
          <div style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--color-text, #1e293b)',
            background: '#ffffff',
            padding: '14px 18px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            whiteSpace: 'pre-line',
            fontFamily: 'Georgia, serif',
            maxHeight: 450,
            overflowY: 'auto',
          }}>
            {passage.text}
          </div>
        </div>
      )}

      {/* Action Footer Bar */}
      <div style={{
        padding: '10px 18px',
        background: '#f8fafc',
        borderTop: '1px solid var(--color-border, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {/* Left side actions (copy, edit, generate questions) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                color: copied ? '#16a34a' : '#475569',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy Text'}
            </button>
          )}

          {onGenerateQuestions && status === 'approved' && (
            <button
              type="button"
              onClick={() => onGenerateQuestions(passage)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#0d9488',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              ⚡ Generate Items from this Passage
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(passage)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {/* Right side review/status buttons */}
        {!readOnly && onUpdateStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status !== 'approved' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(passage, 'approved')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1.5px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✓ Approve
              </button>
            )}

            {status !== 'ready_for_review' && status !== 'approved' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(passage, 'ready_for_review')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1.5px solid #7dd3fc',
                  background: '#f0f9ff',
                  color: '#0369a1',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Submit for Review
              </button>
            )}

            {status !== 'rejected' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(passage, 'rejected')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1.5px solid #fca5a5',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✕ Reject
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(passage)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #fecaca',
                  background: '#ffffff',
                  color: '#dc2626',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🗑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
