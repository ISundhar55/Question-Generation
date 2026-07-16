import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';

/**
 * MCQQuestion - Multiple Choice Question component
 * Used in both creation (editable) and preview modes
 */
export function MCQQuestion({ question, options = [], correctAnswer, mode = 'preview', onAnswerSelect, type = 'SINGLE_SELECT' }) {
  const [selected, setSelected] = useState(() => {
    return type === 'MULTIPLE_SELECT' ? [] : null;
  });
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (opt) => {
    if (type === 'MULTIPLE_SELECT') {
      const current = Array.isArray(selected) ? selected : [];
      const nextSelected = current.includes(opt)
        ? current.filter(x => x !== opt)
        : [...current, opt];
      setSelected(nextSelected);
      onAnswerSelect && onAnswerSelect(nextSelected);
    } else {
      setSelected(opt);
      onAnswerSelect && onAnswerSelect(opt);
    }
  };

  const getOptionClass = (opt) => {
    let cls = 'qc-option';
    if (mode === 'preview') {
      const isCorrect = (correctAnswer || '').split('|').map(s => s.trim()).includes(opt.trim());
      const isSelected = type === 'MULTIPLE_SELECT'
        ? (Array.isArray(selected) ? selected : []).includes(opt)
        : selected === opt;
      if (revealed && isCorrect) cls += ' correct';
      else if (isSelected) cls += ' selected';
    }
    return cls;
  };

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const isSelected = (opt) => {
    if (type === 'MULTIPLE_SELECT') {
      return (Array.isArray(selected) ? selected : []).includes(opt);
    }
    return selected === opt;
  };

  return (
    <div className="qc-preview">
      <div className="qc-preview-title">
        <span className="qc-badge qc-badge-mcq">
          {type === 'MULTIPLE_SELECT' ? 'Multiple Choice (Multiple Select)' : 'Multiple Choice (Single Select)'}
        </span>
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
              width: 24, height: 24, borderRadius: type === 'MULTIPLE_SELECT' ? 4 : '50%',
              background: isSelected(opt) ? 'var(--color-primary)' : 'var(--color-bg)',
              border: '1.5px solid var(--color-border)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: isSelected(opt) ? '#fff' : 'var(--color-text-muted)',
              flexShrink: 0
            }}>
              {letters[i] || i + 1}
            </span>
            <span style={{ marginLeft: 8 }}>{opt}</span>
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
