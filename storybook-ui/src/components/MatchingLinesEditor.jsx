import React from 'react';

export function MatchingLinesEditor({
  matchLeft,
  setMatchLeft,
  matchRight,
  setMatchRight,
  matchAnswer,
  setMatchAnswer,
  rationales = {},
  setRationales,
  err,
}) {
  const updateRationale = (key, val) => {
    if (setRationales) {
      setRationales(prev => ({ ...(typeof prev === 'object' ? prev : {}), [key]: val }));
    }
  };

  const leftKeys = Object.keys(matchLeft).length > 0
    ? Object.keys(matchLeft)
    : ['A', 'B', 'C', 'D'];

  const rightKeys = Object.keys(matchRight).length > 0
    ? Object.keys(matchRight)
    : ['1', '2', '3', '4'];

  // Add Left Item (A -> B -> C -> ...)
  const addLeftItem = () => {
    let nextChar = 'A';
    for (let code = 65; code <= 90; code++) {
      const ch = String.fromCharCode(code);
      if (!(ch in matchLeft)) {
        nextChar = ch;
        break;
      }
    }
    setMatchLeft(prev => ({ ...prev, [nextChar]: '' }));
  };

  // Delete Left Item
  const deleteLeftItem = (key) => {
    if (leftKeys.length <= 1) return;
    setMatchLeft(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    // Clean up matches containing this left key
    if (matchAnswer) {
      const pairs = matchAnswer.split(/[,|;]/).map(s => s.trim()).filter(Boolean);
      const remaining = pairs.filter(p => !p.toUpperCase().startsWith(key.toUpperCase()));
      setMatchAnswer(remaining.join(', '));
    }
  };

  // Add Right Item (1 -> 2 -> 3 -> ...)
  const addRightItem = () => {
    let nextNum = 1;
    while (String(nextNum) in matchRight) {
      nextNum++;
    }
    const key = String(nextNum);
    setMatchRight(prev => ({ ...prev, [key]: '' }));
    if (setRationales) {
      setRationales(prev => ({ ...(typeof prev === 'object' ? prev : {}), [key]: '' }));
    }
  };

  // Delete Right Item
  const deleteRightItem = (key) => {
    if (rightKeys.length <= 1) return;
    setMatchRight(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    // Clean up rationales
    if (setRationales) {
      setRationales(prev => {
        const next = { ...(typeof prev === 'object' ? prev : {}) };
        delete next[key];
        return next;
      });
    }

    // Clean up matches containing this right key
    if (matchAnswer) {
      const pairs = matchAnswer.split(/[,|;]/).map(s => s.trim()).filter(Boolean);
      const remaining = pairs.filter(p => !p.endsWith(`-${key}`) && !p.endsWith(`–${key}`) && !p.endsWith(`>${key}`) && !p.endsWith(`→${key}`));
      setMatchAnswer(remaining.join(', '));
    }
  };

  return (
    <>
      {/* Two-column inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        {/* Left column */}
        <div className="qc-field" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label className="qc-label" style={{ color: '#0891b2', marginBottom: 0 }}>Column A (Left Items)</label>
            {leftKeys.length < 26 && (
              <button
                type="button"
                className="qc-btn qc-btn-primary"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={addLeftItem}
              >
                + Add Left Item
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leftKeys.map(key => (
              <div
                key={key}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--color-border)',
                  background: '#fafbfc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 0 }}>
                    Item {key}
                  </label>
                  <button
                    type="button"
                    disabled={leftKeys.length <= 1}
                    onClick={() => deleteLeftItem(key)}
                    style={{
                      padding: '4px 8px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      color: 'var(--color-danger)',
                      cursor: leftKeys.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: leftKeys.length <= 1 ? 0.5 : 1,
                    }}
                    title={leftKeys.length <= 1 ? "Cannot delete the last item" : `Remove Item ${key}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
                <input
                  className="qc-input"
                  placeholder={`e.g. ${key === 'A' ? 'Numerator' : key === 'B' ? 'Denominator' : key === 'C' ? 'Fraction' : 'Mixed Number'}`}
                  style={{ marginBottom: 0, background: '#ffffff' }}
                  value={matchLeft[key] || ''}
                  onChange={e => setMatchLeft(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {err && err('matchLeft')}
        </div>

        {/* Right column with directly mapped Rationales */}
        <div className="qc-field" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label className="qc-label" style={{ color: '#6b7280', marginBottom: 0 }}>Column B (Right Items &amp; Rationales)</label>
            {rightKeys.length < 26 && (
              <button
                type="button"
                className="qc-btn qc-btn-primary"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={addRightItem}
              >
                + Add Right Item
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rightKeys.map(key => (
              <div
                key={key}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--color-border)',
                  background: '#fafbfc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 0 }}>
                    Right Item {key}
                  </label>
                  <button
                    type="button"
                    disabled={rightKeys.length <= 1}
                    onClick={() => deleteRightItem(key)}
                    style={{
                      padding: '4px 8px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      color: 'var(--color-danger)',
                      cursor: rightKeys.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: rightKeys.length <= 1 ? 0.5 : 1,
                    }}
                    title={rightKeys.length <= 1 ? "Cannot delete the last item" : `Remove Right Item ${key} and its rationale`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
                <input
                  className="qc-input"
                  placeholder={`e.g. ${key === '1' ? 'Top number' : key === '2' ? 'Bottom number' : key === '3' ? 'Part of whole' : 'Whole and part'}`}
                  style={{ marginBottom: 8, background: '#ffffff' }}
                  value={matchRight[key] || ''}
                  onChange={e => setMatchRight(prev => ({ ...prev, [key]: e.target.value }))}
                />
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4338ca', display: 'block', marginBottom: 4 }}>
                  💡 Rationale for Item {key}
                </label>
                <input
                  className="qc-input"
                  placeholder={`Explain rationale for Item ${key} pairing...`}
                  style={{ marginBottom: 0, fontSize: 12, border: '1px dashed #cbd5e1', background: '#ffffff' }}
                  value={rationales[key] || ''}
                  onChange={e => updateRationale(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          {err && err('matchRight')}
        </div>
      </div>

      {/* Answer key */}
      <div className="qc-field" style={{ marginTop: 8 }}>
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
        {err && err('answer')}
      </div>
    </>
  );
}

export default MatchingLinesEditor;
