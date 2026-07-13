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
          <button className="qc-btn qc-btn-ghost" onClick={onBack} style={{ fontSize: 12 }}>
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
