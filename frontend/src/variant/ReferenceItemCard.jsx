import React, { useState, useEffect } from 'react';
import { MarkdownText, DiagramViewer } from 'question-storybook-ui';
import { TYPE_META, DIFFICULTIES } from '../pages/aiGenerateConstants';

export default function ReferenceItemCard({
  question,
  referenceQuestion,
  defaultExpanded = false,
  onClear,
  onChangeClick,
  onPickNew,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const q = referenceQuestion || question;
  const handlePickNew = onPickNew || onChangeClick;

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [q?.id, q?.text, defaultExpanded]);

  if (!q) return null;

  const rawType = (q.questionType || q.type || 'SINGLE_SELECT').toUpperCase();
  const typeMeta = TYPE_META[rawType] || { label: rawType, color: '#4f6ef7', bg: '#eef1fe' };
  const diffMeta = DIFFICULTIES.find(d => d.value === q.difficulty?.toLowerCase()) || { label: q.difficulty || 'Medium', color: '#d97706', bg: '#fef3c7' };

  const stem = q.text || q.question || q.stem || q.prompt || '';
  const options = q.options;
  const answer = q.answer;
  const explanation = q.explanation;

  const renderTypeSpecificDetails = () => {
    // 1. CONSTRUCTED_RESPONSE with options.answers array
    if (rawType === 'CONSTRUCTED_RESPONSE' && options?.answers && Array.isArray(options.answers)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {options.answers.map((blankGroup, idx) => {
            const list = Array.isArray(blankGroup) ? blankGroup : [blankGroup];
            const primary = list[0];
            const alts = list.slice(1);
            return (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1.5px solid #86efac',
                  background: '#f0fdf4',
                  fontSize: 12.5,
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <strong style={{ minWidth: 60 }}>Blank {idx + 1}:</strong>
                <span style={{ fontWeight: 700 }}>{primary}</span>
                {alts.length > 0 && (
                  <span style={{ fontSize: 11.5, color: '#15803d', fontStyle: 'italic' }}>
                    (acceptable: {alts.join(', ')})
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Correct</span>
              </div>
            );
          })}
        </div>
      );
    }

    // 2. DROPDOWN with options.blanks
    if (rawType === 'DROPDOWN' && options?.blanks && Array.isArray(options.blanks)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {options.blanks.map((b, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                Dropdown {idx + 1}:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(b.choices || []).map((ch, cIdx) => {
                  const isCorrect = ch === b.correct || String(answer).split('|')[idx] === ch;
                  return (
                    <span
                      key={cIdx}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11.5,
                        fontWeight: isCorrect ? 700 : 500,
                        border: isCorrect ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                        background: isCorrect ? '#f0fdf4' : '#ffffff',
                        color: isCorrect ? '#166534' : '#475569',
                      }}
                    >
                      {ch} {isCorrect && '✓'}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 3. MATCHING_LINES with options.left and options.right
    if (rawType === 'MATCHING_LINES' && options?.left && options?.right) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}>Column A</strong>
            {Object.entries(options.left).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, color: '#0f172a', marginBottom: 2 }}>
                <strong>{k}.</strong> {v}
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}>Column B</strong>
            {Object.entries(options.right).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, color: '#0f172a', marginBottom: 2 }}>
                <strong>{k}.</strong> {v}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4. ORDERING (array of steps)
    if (rawType === 'ORDERING' && Array.isArray(options) && options.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {options.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                #{idx + 1}
              </span>
              <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
            </div>
          ))}
        </div>
      );
    }

    // 5. Standard MCQ / Multi-Select / True-False Key-Value options
    if (options && typeof options === 'object' && !Array.isArray(options) && !options.answers && !options.blanks && !options.left) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginBottom: 12 }}>
          {Object.entries(options)
            .filter(([k]) => k !== 'visual')
            .map(([k, val]) => {
              const isCorrect = String(answer).split('|').includes(k) || String(answer) === k;
              return (
                <div
                  key={k}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: isCorrect ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    background: isCorrect ? '#f0fdf4' : '#ffffff',
                    fontSize: 12.5,
                    color: isCorrect ? '#166534' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <strong style={{ minWidth: 16 }}>{k}.</strong>
                  <span style={{ flex: 1 }}>
                    <MarkdownText text={typeof val === 'string' ? val : JSON.stringify(val)} />
                  </span>
                  {isCorrect && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Correct</span>}
                </div>
              );
            })}
        </div>
      );
    }

    // Fallback: array of strings
    if (Array.isArray(options) && options.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {options.map((opt, idx) => (
            <div
              key={idx}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: 12.5,
                color: '#334155',
              }}
            >
              <MarkdownText text={typeof opt === 'string' ? opt : JSON.stringify(opt)} />
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧬</span> Seed Reference Item
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: typeMeta.bg,
              color: typeMeta.color,
            }}
          >
            {typeMeta.label}
          </span>
          {q.difficulty && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: diffMeta.bg,
                color: diffMeta.color,
              }}
            >
              {diffMeta.label}
            </span>
          )}
          {q.id && (
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              (ID: #{q.id})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
          {handlePickNew && (
            <button
              type="button"
              onClick={handlePickNew}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Change Item
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
              }}
              title="Remove reference question"
            >
              ✕ Remove
            </button>
          )}
        </div>
      </div>

      {/* Compact Preview when Collapsed */}
      {!expanded && stem && (
        <div
          onClick={() => setExpanded(true)}
          style={{
            padding: '8px 14px',
            fontSize: 12.5,
            color: '#475569',
            background: '#fafbfc',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderTop: '1px solid #e2e8f0',
          }}
          title={`${stem} (Click to expand)`}
        >
          {stem}
        </div>
      )}

      {/* Body Preview */}
      {expanded && (
        <div style={{ padding: '14px 16px', background: '#fafbfc' }}>
          {/* Question Stem Text + Visual Diagram */}
          {(q.options?.visual || q.visual) ? (
            <div style={{ marginBottom: 12 }}>
              <DiagramViewer
                svgCode={q.options?.visual || q.visual}
                stemText={stem}
                filename={`seed_item_diagram_${q.id || 'ref'}`}
              />
            </div>
          ) : (
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.5, marginBottom: 12 }}>
              {(q.image || q.image_url || q.imageUrl) && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={q.image || q.image_url || q.imageUrl}
                    alt="Seed Visual"
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </div>
              )}
              <MarkdownText text={stem} />
            </div>
          )}

          {/* Type-Specific Options & Structure Rendering */}
          {renderTypeSpecificDetails()}

          {/* Answer Key & Explanation snippet */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            {answer && (
              <div>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Correct Answer: </span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>
                  {typeof answer === 'object' ? JSON.stringify(answer) : String(answer)}
                </span>
              </div>
            )}
            {explanation && (
              <div style={{ flex: 1, minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={explanation}>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Rationale: </span>
                <span>{explanation}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
