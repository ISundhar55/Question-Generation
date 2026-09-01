import React, { useState } from 'react';

export function GapMatchEditor({
  passage,
  setPassage,
  gaps,
  setGaps,
  responseOptions,
  setResponseOptions,
  answers,
  setAnswers,
  rationales = {},
  setRationales,
  err,
}) {
  const [newOption, setNewOption] = useState('');

  const updateRationale = (gapKey, val) => {
    if (setRationales) {
      setRationales(prev => ({ ...(typeof prev === 'object' ? prev : {}), [gapKey]: val }));
    }
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (responseOptions.includes(trimmed)) return;
    setResponseOptions([...responseOptions, trimmed]);
    setNewOption('');
  };

  const removeOption = (optionToRemove) => {
    setResponseOptions(responseOptions.filter((opt) => opt !== optionToRemove));
    const nextAnswers = { ...answers };
    Object.keys(nextAnswers).forEach((key) => {
      if (nextAnswers[key] === optionToRemove) {
        delete nextAnswers[key];
      }
    });
    setAnswers(nextAnswers);
  };

  const insertGap = () => {
    const nextIndex = gaps.length + 1;
    const gapId = `gap_${nextIndex}`;
    const gapTag = `[${gapId}]`;
    const nextPassage = passage ? `${passage} ${gapTag}` : gapTag;
    setPassage(nextPassage);
    setGaps([...gaps, { id: gapId, label: `Gap ${nextIndex}` }]);
  };

  const removeGap = (idx) => {
    if (gaps.length <= 1) return;
    const removedGap = gaps[idx];
    const nextGaps = gaps.filter((_, i) => i !== idx);
    setGaps(nextGaps);

    const nextAnswers = { ...answers };
    if (removedGap?.id) delete nextAnswers[removedGap.id];
    setAnswers(nextAnswers);

    if (setRationales && removedGap?.id) {
      setRationales(prev => {
        const next = { ...(typeof prev === 'object' ? prev : {}) };
        delete next[removedGap.id];
        return next;
      });
    }
  };

  const updateAnswer = (gapId, selectedOption) => {
    const next = { ...answers };
    if (gapId) next[gapId] = selectedOption;
    setAnswers(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="qc-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label className="qc-label" style={{ marginBottom: 0 }}>Passage with Gaps</label>
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={insertGap}
            style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
            title="Append a new gap into the passage"
          >
            + Insert Gap
          </button>
        </div>
        <textarea
          className="qc-input"
          rows={4}
          placeholder="e.g. Water moves into root cells through [gap_1]. It is transported through the stem via [gap_2] vessels..."
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          style={{ fontFamily: 'inherit', resize: 'vertical' }}
        />
        {err && err('passage')}
      </div>

      <div className="qc-field">
        <label className="qc-label">
          Response Options Bank <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 11 }}>(All target answers + extra distractors)</span>
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            className="qc-input"
            placeholder="Enter response option (e.g. Osmosis, Chloroplast)..."
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption();
              }
            }}
            style={{ marginBottom: 0 }}
          />
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={addOption}
            style={{ padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            + Add Option
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {responseOptions.map((opt, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>{opt}</span>
              <button
                type="button"
                onClick={() => removeOption(opt)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: 0,
                  lineHeight: 1,
                }}
                title="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="qc-field">
        <label className="qc-label">Assign Correct Option & Rationale for Each Gap</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gaps.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No gaps defined yet. Click "+ Insert Gap" above to insert gaps into the passage.
            </div>
          ) : (
            gaps.map((gap, idx) => {
              const gapKey = gap.id || `gap_${idx + 1}`;
              const currentAnswer = (gap.id && answers[gap.id]) || (gap.label && answers[gap.label]) || answers[String(idx + 1)] || '';
              const displayOptions = [...responseOptions];
              if (currentAnswer && !displayOptions.includes(currentAnswer)) {
                displayOptions.unshift(currentAnswer);
              }

              return (
                <div
                  key={gap.id || idx}
                  style={{
                    padding: '12px 14px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 40px', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#2563eb' }}>
                      {gapKey.replace(/^gap/i, 'Gap')}
                    </span>

                    <select
                      className="qc-input qc-select"
                      value={currentAnswer}
                      onChange={(e) => updateAnswer(gapKey, e.target.value)}
                      style={{ fontSize: 12, padding: '6px 10px', marginBottom: 0 }}
                    >
                      <option value="">— Select Correct Option —</option>
                      {displayOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeGap(idx)}
                      style={{
                        padding: '8px 10px',
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        borderRadius: 8,
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Remove this gap and its rationale"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4338ca', display: 'block', marginBottom: 4 }}>
                      💡 Rationale for {gapKey.replace(/^gap/i, 'Gap')}
                    </label>
                    <input
                      className="qc-input"
                      placeholder={`Explain why this assigned word belongs in ${gapKey.replace(/^gap/i, 'Gap')}...`}
                      style={{ fontSize: 12, padding: '6px 10px', marginBottom: 0, border: '1px dashed #cbd5e1', background: '#fafbfc' }}
                      value={rationales[gapKey] || ''}
                      onChange={(e) => updateRationale(gapKey, e.target.value)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        {err && err('gaps')}
        {err && err('answer')}
      </div>
    </div>
  );
}
