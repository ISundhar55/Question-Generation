import React from 'react';

export function ConstructedResponseEditor({ text, crBlanks, setCrBlanks, err }) {
  const blankCount = (text.match(/___/g) || []).length;
  const effectiveCrBlanks = Array.from(
    { length: Math.max(blankCount, 1) },
    (_, i) => crBlanks[i] || { correct: '', acceptable: '' }
  );

  const updateCrBlank = (i, field, val) => {
    setCrBlanks(prev => {
      const next = [...prev];
      while (next.length <= i) next.push({ correct: '', acceptable: '' });
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  return (
    <div className="qc-field">
      <label className="qc-label">Blank Responses</label>
      {blankCount === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>
          Add at least one ___ blank to your question text above.
        </p>
      )}
      {effectiveCrBlanks.map((blank, i) => (
        <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: '#fafbfc' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>Blank {i + 1}</div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Correct Answer</label>
            <input
              className="qc-input"
              placeholder="e.g. Paris"
              style={{ marginBottom: 0 }}
              value={blank.correct}
              onChange={(e) => updateCrBlank(i, 'correct', e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Acceptable Alternatives (comma-separated)</label>
            <input
              className="qc-input"
              placeholder="e.g. capital of France, city of light"
              style={{ marginBottom: 0 }}
              value={blank.acceptable}
              onChange={(e) => updateCrBlank(i, 'acceptable', e.target.value)}
            />
          </div>
        </div>
      ))}
      {err('answer')}
    </div>
  );
}

export default ConstructedResponseEditor;
