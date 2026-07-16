import React from 'react';

export function McqEditor({ type, options, setOptions, answer, setAnswer, updateOption, err }) {
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

  return (
    <div className="qc-field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label className="qc-label" style={{ marginBottom: 0 }}>Answer Options</label>
        {options.length < 26 && (
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={() => setOptions(prev => [...prev, ''])}
          >
            + Add Option
          </button>
        )}
      </div>
      {options.map((opt, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <div style={{
            width: 28, height: 28, borderRadius: type === 'MULTIPLE_SELECT' ? '4px' : '50%',
            background: isCorrect(opt) ? 'var(--color-primary)' : 'var(--color-bg)',
            border: '1.5px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: isCorrect(opt) ? '#fff' : 'var(--color-text-muted)',
            flexShrink: 0,
            cursor: opt.trim() ? 'pointer' : 'default',
          }}
            onClick={() => toggleCorrect(opt)}
            title={type === 'MULTIPLE_SELECT' ? 'Click to toggle correct answer' : 'Click to set as correct answer'}
          >
            {letters[i] || i + 1}
          </div>
          <input
            className="qc-input"
            placeholder={`Option ${letters[i] || i + 1}`}
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button
            type="button"
            disabled={options.length === 1}
            onClick={() => {
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
            }}
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
            }}
            onMouseEnter={(e) => {
              if (options.length > 1) {
                e.currentTarget.style.background = 'var(--color-danger)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = 'var(--color-danger)';
              }
            }}
            onMouseLeave={(e) => {
              if (options.length > 1) {
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.color = 'var(--color-danger)';
                e.currentTarget.style.borderColor = '#fecaca';
              }
            }}
            title={options.length === 1 ? "Cannot delete the last option" : "Remove this option"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
        {type === 'MULTIPLE_SELECT'
          ? 'Click option letters to toggle all correct answers (multiple select)'
          : 'Click option letter to mark the single correct answer'}
      </p>
      {answer && <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4 }}>✓ Correct answer(s): {answer.split('|').join(', ')}</p>}
      {err('options')}
      {err('answer')}
    </div>
  );
}

export default McqEditor;
