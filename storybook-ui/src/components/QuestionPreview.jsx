import { useState, useEffect } from 'react';
import './styles.css';
import { MCQQuestion } from './MCQQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import { ShortAnswerQuestion } from './ShortAnswerQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';
import { MarkdownText } from './MarkdownText';
import { DiagramViewer } from './DiagramViewer';

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

  const qType = (question.type || question.questionType || question.question_type || '').toUpperCase();

  const parsedOptions = (() => {
    if (!question?.options) return {};
    if (typeof question.options === 'object' && question.options !== null) return question.options;
    if (typeof question.options === 'string') {
      const trimmed = question.options.trim();
      if (!trimmed) return {};
      try {
        const p = JSON.parse(trimmed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) {}
      try {
        const fixed = trimmed
          .replace(/'/g, '"')
          .replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
        const p = JSON.parse(fixed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) {}
    }
    return {};
  })();

  const explanationText = (() => {
    if (typeof question.explanation === 'string' && question.explanation.trim()) {
      return question.explanation.trim();
    }
    if (typeof question.rationale === 'string' && question.rationale.trim()) {
      return question.rationale.trim();
    }
    if (typeof parsedOptions.explanation === 'string' && parsedOptions.explanation.trim()) {
      return parsedOptions.explanation.trim();
    }
    if (typeof parsedOptions.rationale === 'string' && parsedOptions.rationale.trim()) {
      return parsedOptions.rationale.trim();
    }

    // Auto-compile from parsedOptions.rationales fallback
    if (Array.isArray(parsedOptions.rationales) && parsedOptions.rationales.length > 0) {
      const list = parsedOptions.rationales
        .map((r, i) => (typeof r === 'string' && r.trim()) ? `• Option ${String.fromCharCode(65 + i)}: ${r.trim()}` : null)
        .filter(Boolean);
      if (list.length > 0) return list.join('\n');
    } else if (parsedOptions.rationales && typeof parsedOptions.rationales === 'object') {
      const list = Object.entries(parsedOptions.rationales)
        .map(([k, r]) => (typeof r === 'string' && r.trim()) ? `• ${k}: ${r.trim()}` : null)
        .filter(Boolean);
      if (list.length > 0) return list.join('\n');
    }
    return '';
  })();

  const visualSvg = question.options?.visual || question.visual || null;

  const renderPreview = () => {
    switch (qType) {
      case 'MCQ':
      case 'SINGLE_SELECT':
      case 'MULTIPLE_SELECT':
      case 'MULTI_SELECT': {
        const rawOpts = parsedOptions;
        const isDict = typeof rawOpts === 'object' && !Array.isArray(rawOpts) && rawOpts !== null;
        const processedOptions = isDict
          ? Object.entries(rawOpts)
              .filter(([k]) => k !== 'visual' && k !== 'rationales' && k !== 'explanation' && k.length <= 3)
              .map(([, v]) => v)
          : (Array.isArray(rawOpts) ? rawOpts : []);

        let processedAnswer = question.answer || '';
        if (isDict && typeof processedAnswer === 'string') {
          // Map letter-based answers (e.g. 'A|C') to actual option text values
          const letters = processedAnswer.split(/[,|]/).map(s => s.trim());
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
            type={qType === 'MULTI_SELECT' ? 'MULTIPLE_SELECT' : (qType || 'SINGLE_SELECT')}
            rationales={parsedOptions.rationales}
            explanation={explanationText}
            visual={visualSvg}
          />
        );
      }
      case 'TRUE_FALSE':
        return (
          <TrueFalseQuestion
            question={question.text}
            correctAnswer={question.answer}
            mode="preview"
            rationales={parsedOptions.rationales}
            explanation={explanationText}
            visual={visualSvg}
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
            correctAnswers={parsedOptions.answers || question.answer?.split('|') || []}
            mode="preview"
          />
        );
      case 'DROPDOWN': {
        const blanks = parsedOptions.blanks || [];
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
        const left  = parsedOptions.left  || {};
        const right = parsedOptions.right || {};
        const leftItems = Object.entries(left);
        const rightItems = Object.entries(right);

        const parsePairs = (raw) => {
          if (!raw) return [];
          if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
            return Object.entries(raw).map(([l, r]) => ({ left: l, right: String(r) }));
          }
          if (typeof raw === 'string') {
            const trimmed = raw.trim();
            try {
              const obj = JSON.parse(trimmed);
              if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                return Object.entries(obj).map(([l, r]) => ({ left: l, right: String(r) }));
              }
            } catch (_) {}

            const items = trimmed.split(/[,|;]/);
            const list = [];
            items.forEach(item => {
              const part = item.trim();
              if (!part) return;
              if (part.includes('->')) {
                const [l, r] = part.split('->');
                if (l && r) list.push({ left: l.trim(), right: r.trim() });
              } else if (part.includes('→')) {
                const [l, r] = part.split('→');
                if (l && r) list.push({ left: l.trim(), right: r.trim() });
              } else if (part.includes('-')) {
                const [l, r] = part.split('-');
                if (l && r) list.push({ left: l.trim(), right: r.trim() });
              } else if (part.includes(':')) {
                const [l, r] = part.split(':');
                if (l && r) list.push({ left: l.trim(), right: r.trim() });
              }
            });
            if (list.length > 0) return list;
          }
          return [];
        };

        const formattedPairs = parsePairs(question.answer);

        return (
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge" style={{ background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' }}>
                🔗 Matching Lines
              </span>
            </div>
            <div className="qc-preview-question">
              <MarkdownText text={question.text || 'Match each item from Column A with its corresponding item from Column B.'} />
            </div>

            {/* Side-by-Side Modern Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              {/* Column A */}
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Column A</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leftItems.map(([key, label]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {key}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column B */}
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Column B</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rightItems.map(([key, label]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {key}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Answer Key Pills Bar */}
            {formattedPairs.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#ecfeff', borderRadius: 8, border: '1px solid #a5f3fc' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Correct Matching Key:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {formattedPairs.map((pair, pIdx) => (
                    <div key={pIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: '#ffffff', border: '1px solid #67e8f9', fontSize: 12, fontWeight: 700, color: '#0891b2', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span>{pair.left}</span>
                      <span style={{ color: '#06b6d4' }}>➔</span>
                      <span>{pair.right}</span>
                    </div>
                  ))}
                </div>
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
      case 'MULTIPLE_DROP_BUCKET': {
        const qOptions = question?.options || {};
        const optionBuckets = Array.isArray(qOptions?.option_buckets) ? qOptions.option_buckets : [];
        const dropBuckets = Array.isArray(qOptions?.drop_buckets) ? qOptions.drop_buckets : [];
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

        return (
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
                🗂️ Multiple Drop Bucket
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{question?.text}</p>

            {/* Option Buckets Section */}
            {optionBuckets.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                  📦 Option Buckets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {optionBuckets.map((oBucket, bIdx) => (
                    <div key={oBucket.id || bIdx} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1.5px solid #e2e8f0' }}>
                      {oBucket.title && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0d6efd', marginBottom: 8 }}>
                          {oBucket.title}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(oBucket.options || []).map((opt, oIdx) => (
                          <span
                            key={oIdx}
                            style={{
                              padding: '5px 12px',
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

            {/* Target Drop Buckets Grid */}
            {dropBuckets.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                  📥 Target Drop Buckets
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(dropBuckets.length, 3)}, 1fr)`, gap: 12 }}>
                  {dropBuckets.map((dBucket, dIdx) => {
                    const getAssigned = () => {
                      if (dBucket.id && Array.isArray(answersObj[dBucket.id])) return answersObj[dBucket.id];
                      if (dBucket.name && Array.isArray(answersObj[dBucket.name])) return answersObj[dBucket.name];
                      if (Array.isArray(answersObj[`drop_bucket_${dIdx + 1}`])) return answersObj[`drop_bucket_${dIdx + 1}`];
                      if (Array.isArray(answersObj[String(dIdx)])) return answersObj[String(dIdx)];
                      if (dBucket.name) {
                        const tName = dBucket.name.trim().toLowerCase();
                        const fKey = Object.keys(answersObj).find(k => k.trim().toLowerCase() === tName);
                        if (fKey && Array.isArray(answersObj[fKey])) return answersObj[fKey];
                      }
                      const fallback = answersObj[dBucket.id] || answersObj[dBucket.name] || [];
                      return Array.isArray(fallback) ? fallback : [fallback].filter(Boolean);
                    };
                    const assignedList = getAssigned();

                    return (
                      <div
                        key={dBucket.id || dIdx}
                        style={{
                          padding: '14px 16px',
                          background: '#f0f9ff',
                          borderRadius: 10,
                          border: '2px dashed #0284c7',
                          minHeight: 110,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📥</span>
                          <span>{dBucket.name || `Category ${dIdx + 1}`}</span>
                        </div>

                        {assignedList.length === 0 ? (
                          <div style={{ fontSize: 11, color: '#0284c7', fontStyle: 'italic', opacity: 0.7, marginTop: 10 }}>
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

            {/* Correct Answer Key & Per-Bucket Rationales */}
            {dropBuckets.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Correct Classification Key:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dropBuckets.map((dBucket) => {
                    const assigned = answersObj[dBucket.id] || answersObj[dBucket.name] || [];
                    const assignedList = Array.isArray(assigned) ? assigned : [assigned].filter(Boolean);

                    return (
                      <div key={dBucket.id} style={{ fontSize: 12 }}>
                        <strong style={{ color: '#0369a1' }}>{dBucket.name || 'Category'}:</strong>{' '}
                        <span>{assignedList.join(', ') || '(None)'}</span>
                        {dBucket.rationale && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                            Rationale: {dBucket.rationale}
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
      }
      case 'MATRIX_INTERACTION': {
        const qOptions = question?.options || {};
        const headerText = qOptions?.header || 'Header';
        const rawCols = Array.isArray(qOptions?.columns) ? qOptions.columns : [];
        const columns = rawCols.map((c, i) => (typeof c === 'object' ? c : { id: `col_${i + 1}`, value: String(c) }));
        const rawRows = Array.isArray(qOptions?.rows) ? qOptions.rows : [];
        const rows = rawRows.map((r, i) => (typeof r === 'object' ? r : { id: `row_${i + 1}`, value: String(r) }));

        let answersObj = {};
        const rawAns = question?.answer;
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
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 12 }}>
              <span className="qc-badge" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                📊 Matrix Interaction
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{question?.text}</p>

            {/* Matrix Table */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                overflowX: 'auto',
                marginBottom: 18,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 450 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', width: '40%' }}>
                      {headerText}
                    </th>
                    {columns.map((col, cIdx) => (
                      <th
                        key={col.id || cIdx}
                        style={{
                          padding: '12px 16px',
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
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', fontWeight: 500 }}>
                        {row.value || `Row ${rIdx + 1}`}
                      </td>
                      {columns.map((col, cIdx) => {
                        const selected = isMatch(row, col, rIdx, cIdx);

                        return (
                          <td
                            key={col.id || cIdx}
                            style={{
                              padding: '12px 16px',
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

            {/* Answer Key Summary */}
            {rows.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Correct Matrix Key:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {rows.map((row) => {
                    const rowKey = row.value || row.id;
                    const ansVal = answersObj[row.value] || answersObj[row.id] || 'Not assigned';
                    const colResolved = columns.find(c => c.id === ansVal)?.value || ansVal;

                    return (
                      <span key={row.id} style={{ padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                        {rowKey}: <strong>{colResolved}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'SELECT_TEXT': {
        const qOptions = question?.options || {};
        const selectionType = qOptions?.selection_type || 'Sentence';
        const maxSelections = qOptions?.max_selections || 1;
        const passageText = qOptions?.passage || '';

        let targetAnswers = [];
        const rawAns = question?.answer;
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

        // Parse passage into tokens
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
          <div className="qc-preview" style={{ fontFamily: 'inherit' }}>
            <div className="qc-preview-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="qc-badge qc-badge-st">
                📝 Select Text
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                <span>Selection Type:</span>
                <strong style={{ color: '#6d28d9' }}>{selectionType}</strong>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                <span>Max Selections:</span>
                <strong style={{ color: '#1e40af' }}>{maxSelections}</strong>
              </div>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{question?.text}</p>

            {/* Passage Box with Highlighted Target Text */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                lineHeight: 2.0,
                fontSize: 14,
                display: 'flex',
                flexWrap: 'wrap',
                gap: selectionType === 'Paragraph' ? 14 : selectionType === 'Words' ? 6 : 8,
                marginBottom: 16,
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

            {/* Answer Key */}
            {targetAnswers.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Correct Selected Text ({targetAnswers.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {targetAnswers.map((ans, aIdx) => (
                    <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                      <span>✓</span>
                      <span>"{ans}"</span>
                    </div>
                  ))}
                </div>
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
      {/* Pedagogical Rationale */}
      {Boolean(explanationText) && (
        <div style={{
          marginTop: 16,
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: 'var(--radius-sm)',
          border: '1.5px solid #e2e8f0',
          borderLeft: '4px solid #6366f1',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pedagogical Rationale & Solution Breakdown
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
            <MarkdownText text={explanationText} />
          </div>
        </div>
      )}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
        <span>Difficulty: <strong style={{ color: 'var(--color-text)' }}>{question.difficulty || 'medium'}</strong></span>
        <span>Points: <strong style={{ color: 'var(--color-text)' }}>{question.points || 1}</strong></span>
      </div>
    </div>
  );
}

export default QuestionPreview;
