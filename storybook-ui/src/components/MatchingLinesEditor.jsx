import React from 'react';

export function MatchingLinesEditor({ matchLeft, setMatchLeft, matchRight, setMatchRight, matchAnswer, setMatchAnswer, err }) {
  return (
    <>
      {/* Stem label override */}
      <div className="qc-field">
        <label className="qc-label">Stem / Instruction</label>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
          The instruction shown above the two columns, e.g. &ldquo;Match each item in Column A with Column B&rdquo;
        </p>
      </div>

      {/* Two-column inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
        {/* Left column */}
        <div className="qc-field" style={{ marginBottom: 0 }}>
          <label className="qc-label" style={{ color: '#0891b2' }}>Column A (Left Items)</label>
          {['A', 'B', 'C', 'D'].map(key => (
            <input
              key={key}
              className="qc-input"
              placeholder={`A${key === 'A' ? ' — e.g. Numerator' : key === 'B' ? ' — e.g. Denominator' : ''}`}
              style={{ marginBottom: 6 }}
              value={matchLeft[key]}
              onChange={e => setMatchLeft(prev => ({ ...prev, [key]: e.target.value }))}
            />
          ))}
          {err('matchLeft')}
        </div>

        {/* Right column */}
        <div className="qc-field" style={{ marginBottom: 0 }}>
          <label className="qc-label" style={{ color: '#6b7280' }}>Column B (Right Items)</label>
          {['1', '2', '3', '4'].map(key => (
            <input
              key={key}
              className="qc-input"
              placeholder={`${key} — e.g. Top number`}
              style={{ marginBottom: 6 }}
              value={matchRight[key]}
              onChange={e => setMatchRight(prev => ({ ...prev, [key]: e.target.value }))}
            />
          ))}
          {err('matchRight')}
        </div>
      </div>

      {/* Answer key */}
      <div className="qc-field">
        <label className="qc-label">Correct Matches</label>
        <input
          className="qc-input"
          placeholder="e.g. A-1, B-3, C-2, D-4"
          value={matchAnswer}
          onChange={e => setMatchAnswer(e.target.value)}
        />
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Format: Left letter – Right number, comma-separated (e.g. A-2, B-1, C-4, D-3)
        </p>
        {err('answer')}
      </div>
    </>
  );
}

export default MatchingLinesEditor;
