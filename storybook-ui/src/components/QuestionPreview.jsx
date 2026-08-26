import { useState, useEffect } from 'react';
import './styles.css';
import { MCQQuestion } from './MCQQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import { ShortAnswerQuestion } from './ShortAnswerQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';

/**
 * QuestionPreview
 * Renders the correct preview component based on question type.
 * Pass the full question payload from QuestionCreator.
 */
export function QuestionPreview({ question, onBack, backLabel }) {
  const [studentOrder, setStudentOrder] = useState([]);
  const [draggedItemIdx, setDraggedItemIdx] = useState(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState(null);

  useEffect(() => {
    if (question?.type === 'ORDERING' && Array.isArray(question.options)) {
      setStudentOrder(question.options.filter(o => o.trim()));
    }
  }, [question]);

  if (!question) {
    return (
      <div className="qc-preview" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 48 }}>
        No question to preview
      </div>
    );
  }

  const renderPreview = () => {
    switch (question.type) {
      case 'MCQ':
      case 'SINGLE_SELECT':
      case 'MULTIPLE_SELECT': {
        const rawOpts = question.options || [];
        const isDict = typeof rawOpts === 'object' && !Array.isArray(rawOpts);
        const processedOptions = isDict ? Object.values(rawOpts) : rawOpts;

        let processedAnswer = question.answer || '';
        if (isDict && typeof processedAnswer === 'string') {
          // Map letter-based answers (e.g. 'A|C') to actual option text values
          const letters = processedAnswer.split('|').map(s => s.trim());
          const mapped = letters.map(l => rawOpts[l]).filter(Boolean);
          if (mapped.length > 0) {
            processedAnswer = mapped.join('|');
          }
        }

        return (
          <MCQQuestion
            question={question.text}
            options={processedOptions}
            correctAnswer={processedAnswer}
            mode="preview"
            type={question.type}
          />
        );
      }
      case 'TRUE_FALSE':
        return (
          <TrueFalseQuestion
            question={question.text}
            correctAnswer={question.answer}
            mode="preview"
          />
        );
      case 'SHORT_ANSWER':
        return (
          <ShortAnswerQuestion
            question={question.text}
            correctAnswer={question.answer}
            mode="preview"
          />
        );
      case 'FILL_IN_BLANK':         // legacy
      case 'CONSTRUCTED_RESPONSE':
        return (
          <FillBlankQuestion
            questionTemplate={question.text}
            correctAnswers={question.options?.answers || question.answer?.split('|') || []}
            mode="preview"
          />
        );
      case 'DROPDOWN': {
        const blanks = question.options?.blanks || [];
        const parts  = (question.text || '').split('___');
        return (
          <div className="qc-preview">
            <div className="qc-preview-title">
              <span className="qc-badge qc-badge-dd">Dropdown</span>
            </div>
            <div className="qc-preview-question" style={{ lineHeight: 2.4 }}>
              {parts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < parts.length - 1 && blanks[i] && (
                    <select
                      defaultValue=""
                      style={{
                        display: 'inline-block', margin: '0 4px', padding: '3px 8px',
                        borderRadius: 6, border: '1.5px solid var(--color-primary)',
                        background: 'var(--color-primary-light)', fontFamily: 'var(--font)',
                        fontSize: 13, color: 'var(--color-text)', cursor: 'pointer',
                      }}
                    >
                      <option value="" disabled>Select…</option>
                      {blanks[i].choices.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#ecfeff', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#0e7490', fontWeight: 500 }}>
              <strong>Correct answers:</strong> {blanks.map(b => b.correct).join(', ')}
            </div>
          </div>
        );
      }
      case 'MATCHING_LINES': {
        const left  = question.options?.left  || {};
        const right = question.options?.right || {};
        const pairs = question.answer
          ? Object.fromEntries(
              question.answer.split(',').map(p => {
                const [l, r] = p.trim().split('-');
                return [l?.trim(), r?.trim()];
              })
            )
          : {};
        return (
          <div style={{ fontFamily: 'inherit' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{question.text}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 6, textTransform: 'uppercase' }}>Column A</div>
                {Object.entries(left).map(([k, v]) => (
                  <div key={k} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 5, fontSize: 13, display: 'flex', gap: 8 }}>
                    <strong style={{ color: '#0891b2' }}>{k}.</strong> {v}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Column B</div>
                {Object.entries(right).map(([k, v]) => (
                  <div key={k} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 5, fontSize: 13, display: 'flex', gap: 8 }}>
                    <strong style={{ color: '#6b7280' }}>{k}.</strong> {v}
                  </div>
                ))}
              </div>
            </div>
            {Object.keys(pairs).length > 0 && (
              <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 600 }}>
                Answer: {question.answer}
              </div>
            )}
          </div>
        );
      }
      case 'ORDERING': {
        const correct = question.answer ? question.answer.split('|').map(s => s.trim()) : [];
        return (
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge qc-badge-ord">Ordering</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{question.text}</p>
            
            <div style={{ maxWidth: 480 }}>
              {studentOrder.map((item, idx) => {
                const isDragging = draggedItemIdx === idx;
                const isOver = dragOverItemIdx === idx;
                return (
                  <div
                    key={item}
                    draggable
                    onDragStart={(e) => {
                      setDraggedItemIdx(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDragOverItemIdx(idx)}
                    onDragEnd={() => {
                      setDraggedItemIdx(null);
                      setDragOverItemIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedItemIdx === null || draggedItemIdx === idx) return;
                      const next = [...studentOrder];
                      const [moved] = next.splice(draggedItemIdx, 1);
                      next.splice(idx, 0, moved);
                      setStudentOrder(next);
                      setDraggedItemIdx(null);
                      setDragOverItemIdx(null);
                    }}
                    className={`qc-order-item ${isDragging ? 'dragging' : ''}`}
                    style={{
                      borderTop: isOver && draggedItemIdx > idx ? '2px solid var(--color-primary)' : undefined,
                      borderBottom: isOver && draggedItemIdx < idx ? '2px solid var(--color-primary)' : undefined,
                      background: '#fff',
                      margin: '6px 0',
                    }}
                  >
                    <div className="qc-order-item-num">{idx + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{item}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>☰</div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
              💡 Practice drag-and-dropping the items to test the ordering.
            </p>

            {correct.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#fdf2f8', borderRadius: 'var(--radius-sm)', border: '1px solid #fbcfe8' }}>
                <div style={{ fontSize: 13, color: '#db2777', fontWeight: 600 }}>Correct Answer Order:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  {correct.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, padding: '4px 10px', background: '#fff', border: '1px solid #fbcfe8', borderRadius: 20, color: '#db2777', fontWeight: 600 }}>
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
      }
      case 'BACKGROUND_GRAPHIC': {
        const svg = question.options?.svg_graphic || '';
        const dropZones = question.options?.drop_zones || [];
        const labelBank = question.options?.label_bank || [];
        const zoneWidth = question.options?.drop_zone_width || 120;
        const zoneHeight = question.options?.drop_zone_height || 36;
        let answersObj = {};
        if (typeof question.answer === 'object' && question.answer !== null) {
          answersObj = question.answer;
        } else if (typeof question.answer === 'string') {
          try {
            answersObj = JSON.parse(question.answer) || {};
          } catch {
            answersObj = {};
          }
        }

        return (
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                🖼️ Background Graphic
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{question.text}</p>

            {/* SVG Diagram Canvas */}
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: 580,
              borderRadius: 10,
              overflow: 'hidden',
              border: '1.5px solid #cbd5e1',
              background: '#f8fafc',
              marginBottom: 14,
            }}>
              {svg ? (
                <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No SVG graphic provided</div>
              )}

              {/* Overlaid Drop Zone Pins (Empty Target Boxes) */}
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
                  }}
                >
                  <span style={{
                    background: '#059669',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {zone.pin_label}
                  </span>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 500, opacity: 0.7, fontStyle: 'italic' }}>
                    [ Drop Here ]
                  </span>
                </div>
              ))}
            </div>

            {/* Label Bank */}
            {labelBank.length > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 6 }}>
                  🏷️ Label Bank
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {labelBank.map((lbl, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, background: '#fff', border: '1px solid #6ee7b7', color: '#065f46', fontSize: 12, fontWeight: 600 }}>
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Mapping Key */}
            {Object.keys(answersObj).length > 0 && (
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Correct Answer Key:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(answersObj).map(([k, v]) => (
                    <span key={k} style={{ padding: '3px 8px', borderRadius: 4, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'GAP_MATCH': {
        const qOptions = question?.options || {};
        const passageText = typeof qOptions === 'object' && qOptions?.passage ? qOptions.passage : '';
        const responseOptions = Array.isArray(qOptions?.response_options)
          ? qOptions.response_options
          : Array.isArray(qOptions?.label_bank)
            ? qOptions.label_bank
            : [];
        let answersObj = {};
        const rawAns = question?.answer;
        if (typeof rawAns === 'object' && rawAns !== null) {
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

        // Render passage with interactive gap badges
        const renderPassageWithGaps = () => {
          if (!passageText) return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No passage provided</span>;
          const parts = passageText.split(/(\[gap_[a-zA-Z0-9_-]+\]|\[gap\s*[0-9]+\])/gi);
          return parts.map((part, idx) => {
            const match = part.match(/\[(gap_[a-zA-Z0-9_-]+|gap\s*[0-9]+)\]/i);
            if (match) {
              const gapKey = match[1].toLowerCase().replace(/\s+/g, '_');
              const assigned = answersObj[gapKey] || answersObj[match[1]] || '';
              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 100,
                    height: 30,
                    margin: '0 4px',
                    padding: '2px 10px',
                    borderRadius: 6,
                    border: '2px dashed #2563eb',
                    background: assigned ? '#eff6ff' : '#f8fafc',
                    color: assigned ? '#1d4ed8' : '#2563eb',
                    fontWeight: 600,
                    fontSize: 12,
                    verticalAlign: 'middle',
                  }}
                >
                  {assigned || `[ ${match[1]} ]`}
                </span>
              );
            }
            return <span key={idx}>{part}</span>;
          });
        };

        return (
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                🧩 Gap Match
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{question?.text}</p>

            {/* Response Options Bank */}
            {responseOptions.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: '#eff6ff', border: '1.5px solid #bfdbfe', marginBottom: 16 }}>
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

            {/* Passage Box */}
            <div style={{
              padding: '16px 20px',
              borderRadius: 10,
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              lineHeight: 2.0,
              fontSize: 14,
              color: 'var(--color-text)',
              marginBottom: 16,
            }}>
              {renderPassageWithGaps()}
            </div>

            {/* Correct Answer Key */}
            {Object.keys(answersObj).length > 0 && (
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Correct Answer Key:
                </div>
                {(() => {
                  const normalizedEntries = [];
                  const seenGaps = new Set();
                  Object.entries(answersObj).forEach(([k, v]) => {
                    const match = k.match(/gap_?([0-9]+)/i);
                    const keyLabel = match ? `Gap ${match[1]}` : k;
                    if (!seenGaps.has(keyLabel)) {
                      seenGaps.add(keyLabel);
                      normalizedEntries.push([keyLabel, v]);
                    }
                  });

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {normalizedEntries.map(([k, v]) => (
                        <span key={k} style={{ padding: '3px 8px', borderRadius: 4, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                          {k}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      }
      default:
        return <div>Unknown question type</div>;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Preview</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            This is how students will see the question
          </p>
        </div>
        {onBack && (
          <button className="qc-btn qc-btn-ghost" onClick={onBack}>
            ← {backLabel || 'Back to Editor'}
          </button>
        )}
      </div>
      {renderPreview()}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
        <span>Difficulty: <strong style={{ color: 'var(--color-text)' }}>{question.difficulty || 'medium'}</strong></span>
        <span>Points: <strong style={{ color: 'var(--color-text)' }}>{question.points || 1}</strong></span>
      </div>
    </div>
  );
}

export default QuestionPreview;
