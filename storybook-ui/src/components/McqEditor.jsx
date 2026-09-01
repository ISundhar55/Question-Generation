import React from 'react';

export function McqEditor({
  type,
  options,
  setOptions,
  rationales = [],
  setRationales,
  updateRationale,
  answer,
  setAnswer,
  updateOption,
  err,
}) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

  const isCorrect = (opt) => {
    if (!opt || !opt.trim()) return false;
    if (type === 'MULTIPLE_SELECT') {
      return answer.split('|').map(s => s.trim()).includes(opt.trim());
    }
    return answer.trim() === opt.trim();
  };

  const toggleCorrect = (opt) => {
    if (!opt || !opt.trim()) return;
    if (type === 'MULTIPLE_SELECT') {
      const selected = answer ? answer.split('|').map(s => s.trim()) : [];
      if (selected.includes(opt.trim())) {
        setAnswer(selected.filter(x => x !== opt.trim()).join('|'));
      } else {
        setAnswer([...selected, opt.trim()].join('|'));
      }
    } else {
      setAnswer(opt.trim());
    }
  };

  const handleAddOption = () => {
    setOptions(prev => [...prev, '']);
    if (setRationales) {
      setRationales(prev => [...prev, '']);
    }
  };

  const handleDeleteOption = (i, opt) => {
    setOptions(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      if (opt && opt.trim()) {
        if (type === 'MULTIPLE_SELECT') {
          const selected = answer ? answer.split('|').map(s => s.trim()) : [];
          setAnswer(selected.filter(x => x !== opt.trim()).join('|'));
        } else if (answer.trim() === opt.trim()) {
          setAnswer('');
        }
      }
      return next;
    });

    // Remove matching rationale for this option
    if (setRationales) {
      setRationales(prev => prev.filter((_, idx) => idx !== i));
    }
  };

  return (
    <div className="qc-field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label className="qc-label" style={{ marginBottom: 0 }}>Answer Options & Per-Choice Rationales</label>
        {options.length < 26 && (
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={handleAddOption}
          >
            + Add Option
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {options.map((opt, i) => {
          const letter = letters[i] || i + 1;
          const correct = isCorrect(opt);

          return (
            <div
              key={i}
              style={{
                padding: '12px',
                borderRadius: 8,
                border: `1.5px solid ${correct ? '#86efac' : 'var(--color-border)'}`,
                background: correct ? '#f0fdf4' : '#fafbfc',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Top Row: Option Letter, Choice Input, Delete Button */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: type === 'MULTIPLE_SELECT' ? '4px' : '50%',
                    background: correct ? '#16a34a' : 'var(--color-bg)',
                    border: `1.5px solid ${correct ? '#16a34a' : 'var(--color-border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    color: correct ? '#fff' : 'var(--color-text-muted)',
                    flexShrink: 0,
                    cursor: opt.trim() ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleCorrect(opt)}
                  title={type === 'MULTIPLE_SELECT' ? 'Click to toggle as correct' : 'Click to mark as single correct'}
                >
                  {letter}
                </div>
                <input
                  className="qc-input"
                  placeholder={`Option ${letter} text...`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  style={{ marginBottom: 0, flex: 1, background: '#ffffff' }}
                />
                <button
                  type="button"
                  disabled={options.length === 1}
                  onClick={() => handleDeleteOption(i, opt)}
                  style={{
                    padding: '8px 10px',
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 8,
                    color: 'var(--color-danger)',
                    cursor: options.length === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: options.length === 1 ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                  title={options.length === 1 ? "Cannot delete the last option" : `Remove Option ${letter} and its rationale`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>

              {/* Bottom Row: Per-Option Rationale Input */}
              <div style={{ marginTop: 8, paddingLeft: 36 }}>
                <input
                  className="qc-input"
                  style={{
                    fontSize: 12,
                    padding: '6px 10px',
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    color: 'var(--color-text)',
                    borderRadius: 6,
                    marginBottom: 0,
                    width: '100%',
                  }}
                  placeholder={`💡 Rationale for Option ${letter} (${correct ? 'Why correct' : 'Why incorrect'})...`}
                  value={rationales[i] || ''}
                  onChange={(e) => updateRationale && updateRationale(i, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
        {type === 'MULTIPLE_SELECT'
          ? 'Click option letters to toggle all correct answers (multiple select)'
          : 'Click option letter to mark the single correct answer'}
      </p>
      {answer && <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4 }}>✓ Correct answer(s): {answer.split('|').join(', ')}</p>}
      {err && err('options')}
      {err && err('answer')}
    </div>
  );
}

export default McqEditor;
