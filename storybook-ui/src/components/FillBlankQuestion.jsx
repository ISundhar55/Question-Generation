import { useState } from 'react';
import './styles.css';

/**
 * FillBlankQuestion
 * questionTemplate: string with "___" as blank placeholder
 * e.g. "The capital of France is ___ and it has ___ towers."
 */
export function FillBlankQuestion({ questionTemplate = '', correctAnswers = [], mode = 'preview' }) {
  const parts = questionTemplate.split('___');
  const [inputs, setInputs] = useState(Array(Math.max(parts.length - 1, 0)).fill(''));
  const [revealed, setRevealed] = useState(false);

  const updateInput = (i, val) => {
    const next = [...inputs];
    next[i] = val;
    setInputs(next);
  };

  const formatAnswers = () => {
    return correctAnswers.map((ans, idx) => {
      const label = `Blank ${idx + 1}: `;
      if (Array.isArray(ans)) {
        if (ans.length > 1) {
          return `${label}${ans[0]} (Alternatives: ${ans.slice(1).join(', ')})`;
        }
        return `${label}${ans[0] || ''}`;
      }
      return `${label}${ans}`;
    }).join('; ');
  };

  return (
    <div className="qc-preview">
      <div className="qc-preview-title">
        <span className="qc-badge qc-badge-fb">Fill in the Blank</span>
      </div>
      <div className="qc-preview-question" style={{ lineHeight: 2.2 }}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input
                style={{
                  display: 'inline-block', width: 120,
                  border: 'none', borderBottom: '2px solid var(--color-primary)',
                  background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 4,
                  fontFamily: 'var(--font)', fontSize: 14, color: 'var(--color-text)', outline: 'none',
                  marginInline: 4,
                }}
                value={inputs[i] || ''}
                onChange={(e) => updateInput(i, e.target.value)}
                placeholder={`blank ${i + 1}`}
                disabled={mode !== 'preview'}
              />
            )}
          </span>
        ))}
      </div>
      {mode === 'preview' && revealed && correctAnswers.length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#faf5ff', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#7e22ce', fontWeight: 500 }}>
          <strong>Answers:</strong> {formatAnswers()}
        </div>
      )}
      {mode === 'preview' && (
        <button className="qc-btn qc-btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setRevealed(!revealed)}>
          {revealed ? 'Hide Answers' : 'Show Answers'}
        </button>
      )}
    </div>
  );
}

export default FillBlankQuestion;
