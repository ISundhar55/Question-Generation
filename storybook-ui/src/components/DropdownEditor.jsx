import React from 'react';

export function DropdownEditor({ text, ddBlanks, setDdBlanks, err }) {
  const blankCount = (text.match(/___/g) || []).length;
  const effectiveDdBlanks = Array.from(
    { length: Math.max(blankCount, 1) },
    (_, i) => ddBlanks[i] || { choices: '', correct: '' }
  );

  const updateDdBlank = (i, field, val) => {
    setDdBlanks(prev => {
      const next = [...prev];
      while (next.length <= i) next.push({ choices: '', correct: '' });
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  return (
    <div className="qc-field">
      <label className="qc-label">Blank Options</label>
      {blankCount === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>
          Add at least one ___ blank to your question text above.
        </p>
      )}
      {effectiveDdBlanks.map((blank, i) => (
        <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: '#fafbfc' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>Blank {i + 1}</div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Choices (comma-separated)</label>
            <input
              className="qc-input"
              placeholder="e.g. mitochondria, nucleus, ribosome, vacuole"
              style={{ marginBottom: 0 }}
              value={blank.choices}
              onChange={e => updateDdBlank(i, 'choices', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Correct Answer (must match one choice exactly)</label>
            <input
              className="qc-input"
              placeholder="e.g. mitochondria"
              style={{ marginBottom: 0 }}
              value={blank.correct}
              onChange={e => updateDdBlank(i, 'correct', e.target.value)}
            />
          </div>
        </div>
      ))}
      {err('answer')}
    </div>
  );
}

export default DropdownEditor;
