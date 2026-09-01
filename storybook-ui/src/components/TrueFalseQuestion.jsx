import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';

export function TrueFalseQuestion({
  question,
  correctAnswer,
  mode = 'preview',
  onAnswerSelect,
  rationales = {},
  explanation = '',
}) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(mode === 'preview');

  const handleSelect = (val) => {
    setSelected(val);
    onAnswerSelect && onAnswerSelect(val);
  };

  const getBtnClass = (val) => {
    let cls = 'qc-tf-btn';
    if (selected === val) cls += val === 'true' ? ' selected-true' : ' selected-false';
    return cls;
  };

  const isTrue = correctAnswer === true || String(correctAnswer).toLowerCase() === 'true' || String(correctAnswer).toUpperCase() === 'A';

  const getTfRationale = (isTrueChoice) => {
    const key = isTrueChoice ? 'true' : 'false';
    const label = isTrueChoice ? 'True' : 'False';
    if (rationales && typeof rationales === 'object' && rationales[key]?.trim()) return rationales[key].trim();
    if (explanation) {
      const regex = new RegExp(`•\\s*${label}(?:\\s*\\([^)]*\\))?[:\\-–—]\\s*(.*?)(?=(?:\\n•|$))`, 'is');
      const m = explanation.match(regex);
      if (m) return m[1].trim();

      const bullets = explanation.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
      const idx = isTrueChoice ? 0 : 1;
      if (bullets[idx]) {
        const b = bullets[idx];
        const colonIdx = b.indexOf(':');
        return colonIdx !== -1 ? b.slice(colonIdx + 1).trim() : b;
      }
    }
    return '';
  };

  const trueRationale = getTfRationale(true);
  const falseRationale = getTfRationale(false);

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
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '8px 14px', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
            Correct Answer: {isTrue ? '✓ True' : '✗ False'}
          </div>
          {(trueRationale || falseRationale) && (
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {trueRationale && <div><strong style={{ color: isTrue ? '#16a34a' : '#4338ca' }}>💡 True:</strong> {trueRationale}</div>}
              {falseRationale && <div><strong style={{ color: !isTrue ? '#16a34a' : '#4338ca' }}>💡 False:</strong> {falseRationale}</div>}
            </div>
          )}
        </div>
      )}
      {mode === 'preview' && (
        <button className="qc-btn qc-btn-ghost" style={{ marginTop: 14, fontSize: 12 }} onClick={() => setRevealed(!revealed)}>
          {revealed ? 'Hide Answer & Rationales' : 'Show Answer & Rationales'}
        </button>
      )}
    </div>
  );
}

export default TrueFalseQuestion;
