import React from 'react';

export function TrueFalseEditor({
  answer,
  setAnswer,
  rationales = { true: '', false: '' },
  setRationales,
  err,
}) {
  const norm = (answer === true || String(answer).toLowerCase() === 'true' || String(answer).toLowerCase() === 't')
    ? 'true'
    : (answer === false || String(answer).toLowerCase() === 'false' || String(answer).toLowerCase() === 'f')
      ? 'false'
      : (String(answer).trim().toUpperCase() === 'A' ? 'true' : String(answer).trim().toUpperCase() === 'B' ? 'false' : '');

  const updateRationale = (key, val) => {
    if (setRationales) {
      setRationales(prev => ({ ...(typeof prev === 'object' ? prev : {}), [key]: val }));
    }
  };

  return (
    <div className="qc-field">
      <label className="qc-label">Correct Answer</label>
      <div className="qc-tf-buttons" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`qc-tf-btn${norm === 'true' ? ' selected-true' : ''}`}
          onClick={() => setAnswer('true')}
        >✓ True</button>
        <button
          type="button"
          className={`qc-tf-btn${norm === 'false' ? ' selected-false' : ''}`}
          onClick={() => setAnswer('false')}
        >✗ False</button>
      </div>
      {err && err('answer')}

      {/* Per-Option Rationales */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: norm === 'true' ? '#f0fdf4' : '#fafbfc', border: `1.5px solid ${norm === 'true' ? '#86efac' : 'var(--color-border)'}` }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: norm === 'true' ? '#16a34a' : 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            💡 Rationale for True ({norm === 'true' ? 'Correct' : 'Incorrect'})
          </label>
          <input
            className="qc-input"
            style={{ fontSize: 12, padding: '6px 10px', background: '#ffffff', marginBottom: 0 }}
            placeholder="Explain why True is correct or incorrect..."
            value={rationales?.true || ''}
            onChange={(e) => updateRationale('true', e.target.value)}
          />
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 8, background: norm === 'false' ? '#f0fdf4' : '#fafbfc', border: `1.5px solid ${norm === 'false' ? '#86efac' : 'var(--color-border)'}` }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: norm === 'false' ? '#16a34a' : 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            💡 Rationale for False ({norm === 'false' ? 'Correct' : 'Incorrect'})
          </label>
          <input
            className="qc-input"
            style={{ fontSize: 12, padding: '6px 10px', background: '#ffffff', marginBottom: 0 }}
            placeholder="Explain why False is correct or incorrect..."
            value={rationales?.false || ''}
            onChange={(e) => updateRationale('false', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default TrueFalseEditor;
