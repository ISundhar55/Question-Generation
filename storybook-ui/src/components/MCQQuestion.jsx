import { useState } from 'react';
import './styles.css';
import { MarkdownText } from './MarkdownText';
import { downloadSvgAsPng } from './DiagramViewer';

/**
 * MCQQuestion - Multiple Choice Question component
 * Used in both creation (editable) and preview modes
 */
export function MCQQuestion({
  question,
  options = [],
  correctAnswer,
  mode = 'preview',
  onAnswerSelect,
  type = 'SINGLE_SELECT',
  rationales = [],
  explanation = '',
}) {
  const [selected, setSelected] = useState(() => {
    return type === 'MULTIPLE_SELECT' ? [] : null;
  });
  const [revealed, setRevealed] = useState(mode === 'preview');

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

  // Helper to find option rationale from props array, dict, or explanation bullets
  const getOptionRationale = (idx, letter) => {
    if (Array.isArray(rationales) && rationales[idx]?.trim()) return rationales[idx].trim();
    if (rationales && typeof rationales === 'object' && rationales[letter]?.trim()) return rationales[letter].trim();
    if (rationales && typeof rationales === 'object' && rationales[String(idx + 1)]?.trim()) return rationales[String(idx + 1)].trim();
    if (explanation) {
      // 1. Try letter matching (e.g. • Option A (Correct): ..., • Option A: ..., • Choice A: ..., • A: ..., • A. ...)
      const regexLetter = new RegExp(`•\\s*(?:Option\\s*|Choice\\s*)?\\(?${letter}\\)?(?:\\s*\\([^)]*\\))?[:\\-–—]\\s*(.*?)(?=(?:\\n•|$))`, 'is');
      const mLetter = explanation.match(regexLetter);
      if (mLetter) return mLetter[1].trim();

      // 2. Try index number matching (e.g. • Option 1: ..., • 1: ...)
      const num = String(idx + 1);
      const regexNum = new RegExp(`•\\s*(?:Option\\s*|Choice\\s*)?\\(?${num}\\)?(?:\\s*\\([^)]*\\))?[:\\-–—]\\s*(.*?)(?=(?:\\n•|$))`, 'is');
      const mNum = explanation.match(regexNum);
      if (mNum) return mNum[1].trim();

      // 3. Sequential bullet fallback
      const bullets = explanation.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
      if (bullets[idx]) {
        const b = bullets[idx];
        const colonIdx = b.indexOf(':');
        return colonIdx !== -1 ? b.slice(colonIdx + 1).trim() : b;
      }
    }
    return '';
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
      <div style={{ display: options.some(o => typeof o === 'string' && o.includes('<svg')) ? 'grid' : 'block', gridTemplateColumns: options.some(o => typeof o === 'string' && o.includes('<svg')) ? '1fr 1fr' : '1fr', gap: 10 }}>
        {options.map((opt, i) => {
          const letter = letters[i] || String(i + 1);
          const optRationale = getOptionRationale(i, letter);
          const isCorrect = (correctAnswer || '').split('|').map(s => s.trim()).includes(opt.trim());

          return (
            <div
              key={i}
              className={getOptionClass(opt)}
              onClick={() => mode === 'preview' && handleSelect(opt)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'stretch',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: type === 'MULTIPLE_SELECT' ? 4 : '50%',
                    background: isSelected(opt) ? 'var(--color-primary)' : 'var(--color-bg)',
                    border: '1.5px solid var(--color-border)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: isSelected(opt) ? '#fff' : 'var(--color-text-muted)',
                    flexShrink: 0
                  }}>
                    {letter}
                  </span>
                  {revealed && isCorrect && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 5px' }}>
                      ✓ Correct
                    </span>
                  )}
                </div>
                {typeof opt === 'string' && opt.includes('<svg') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = opt;
                      const svgEl = tempDiv.querySelector('svg');
                      if (svgEl) {
                        document.body.appendChild(tempDiv);
                        downloadSvgAsPng(svgEl, `option_${letter}.png`, 2.5);
                        document.body.removeChild(tempDiv);
                      }
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#0284c7',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: 4,
                      padding: '2px 6px',
                      cursor: 'pointer',
                    }}
                    title={`Download Option ${letter} image as PNG`}
                  >
                    ⬇ PNG
                  </button>
                )}
              </div>
              {typeof opt === 'string' && opt.includes('<svg') ? (
                <div
                  style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', padding: '6px 0', overflowX: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: opt }}
                />
              ) : (
                <span style={{ marginLeft: 4 }}><MarkdownText text={String(opt)} /></span>
              )}

              {/* Display option-specific rationale when revealed */}
              {revealed && optRationale && (
                <div style={{
                  marginTop: 6,
                  padding: '6px 10px',
                  background: isCorrect ? '#f0fdf4' : '#f8fafc',
                  border: `1px dashed ${isCorrect ? '#86efac' : '#cbd5e1'}`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: isCorrect ? '#166534' : 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}>
                  <strong style={{ color: isCorrect ? '#15803d' : '#4338ca' }}>💡 Rationale:</strong> {optRationale}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {mode === 'preview' && options.length > 0 && (
        <button
          className="qc-btn qc-btn-ghost"
          style={{ marginTop: 16, fontSize: 12 }}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? 'Hide Answer & Rationales' : 'Show Answer & Rationales'}
        </button>
      )}
    </div>
  );
}

export default MCQQuestion;
