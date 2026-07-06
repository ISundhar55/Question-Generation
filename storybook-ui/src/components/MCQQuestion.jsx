import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';

/**
 * MCQQuestion - Multiple Choice Question component
 * Used in both creation (editable) and preview modes
 */
export function MCQQuestion({ question, options = [], correctAnswer, mode = 'preview', onAnswerSelect }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (opt) => {
    setSelected(opt);
    onAnswerSelect && onAnswerSelect(opt);
  };

  const getOptionClass = (opt) => {
    let cls = 'qc-option';
    if (mode === 'preview') {
      if (revealed && opt === correctAnswer) cls += ' correct';
      else if (selected === opt) cls += ' selected';
    }
    return cls;
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="qc-preview">
      <div className="qc-preview-title">
        <span className="qc-badge qc-badge-mcq">MCQ</span>
      </div>
      <div className="qc-preview-question">
        <MarkdownText text={question || 'Question text will appear here...'} />
      </div>
      <div>
        {options.map((opt, i) => (
          <div
            key={i}
            className={getOptionClass(opt)}
            onClick={() => mode === 'preview' && handleSelect(opt)}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: selected === opt ? 'var(--color-primary)' : 'var(--color-bg)',
              border: '1.5px solid var(--color-border)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: selected === opt ? '#fff' : 'var(--color-text-muted)',
              flexShrink: 0
            }}>
              {letters[i] || i + 1}
            </span>
            {opt}
          </div>
        ))}
      </div>
      {mode === 'preview' && options.length > 0 && (
        <button
          className="qc-btn qc-btn-ghost"
          style={{ marginTop: 16, fontSize: 12 }}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? 'Hide Answer' : 'Show Answer'}
        </button>
      )}
    </div>
  );
}

export default MCQQuestion;
