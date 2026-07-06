import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';

export function ShortAnswerQuestion({ question, correctAnswer, mode = 'preview', onAnswerChange }) {
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="qc-preview">
      <div className="qc-preview-title">
        <span className="qc-badge qc-badge-sa">Short Answer</span>
      </div>
      <div className="qc-preview-question"><MarkdownText text={question || 'Question text will appear here...'} /></div>
      <textarea
        className="qc-input qc-textarea"
        placeholder="Write your answer here..."
        value={value}
        onChange={(e) => { setValue(e.target.value); onAnswerChange && onAnswerChange(e.target.value); }}
        disabled={mode !== 'preview'}
      />
      {mode === 'preview' && revealed && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#fffbeb', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#92400e', fontWeight: 500 }}>
          <strong>Model Answer:</strong> {correctAnswer}
        </div>
      )}
      {mode === 'preview' && (
        <button className="qc-btn qc-btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setRevealed(!revealed)}>
          {revealed ? 'Hide Answer' : 'Show Answer'}
        </button>
      )}
    </div>
  );
}

export default ShortAnswerQuestion;
