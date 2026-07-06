import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';

export function TrueFalseQuestion({ question, correctAnswer, mode = 'preview', onAnswerSelect }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (val) => {
    setSelected(val);
    onAnswerSelect && onAnswerSelect(val);
  };

  const getBtnClass = (val) => {
    let cls = 'qc-tf-btn';
    if (selected === val) cls += val === 'true' ? ' selected-true' : ' selected-false';
    return cls;
  };

  return (
    <div className="qc-preview">
      <div className="qc-preview-title">
        <span className="qc-badge qc-badge-tf">True / False</span>
      </div>
      <div className="qc-preview-question"><MarkdownText text={question || 'Question text will appear here...'} /></div>
      <div className="qc-tf-buttons">
        <button className={getBtnClass('true')} onClick={() => mode === 'preview' && handleSelect('true')}>
          ✓ True
        </button>
        <button className={getBtnClass('false')} onClick={() => mode === 'preview' && handleSelect('false')}>
          ✗ False
        </button>
      </div>
      {mode === 'preview' && revealed && (
        <div style={{ marginTop: 14, padding: '8px 14px', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
          Correct Answer: {correctAnswer === 'true' ? '✓ True' : '✗ False'}
        </div>
      )}
      {mode === 'preview' && (
        <button className="qc-btn qc-btn-ghost" style={{ marginTop: 14, fontSize: 12 }} onClick={() => setRevealed(!revealed)}>
          {revealed ? 'Hide Answer' : 'Show Answer'}
        </button>
      )}
    </div>
  );
}

export default TrueFalseQuestion;
