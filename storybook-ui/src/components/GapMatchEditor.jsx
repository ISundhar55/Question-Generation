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
  err,
}) {
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (responseOptions.includes(trimmed)) return;
    setResponseOptions([...responseOptions, trimmed]);
    setNewOption('');
  };

  const removeOption = (optionToRemove) => {
    setResponseOptions(responseOptions.filter((opt) => opt !== optionToRemove));
    // Clean up answers if using this option
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
  };

  const updateAnswer = (gapId, selectedOption) => {
    const next = { ...answers };
    if (gapId) next[gapId] = selectedOption;
    setAnswers(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Passage Editor */}
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
        {err('passage')}
      </div>

      {/* Response Options Bank (Options & Distractors) */}
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
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
          />
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={addOption}
            style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            + Add Option
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          {responseOptions.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No options added yet. Add options above.</span>
          ) : (
            responseOptions.map((opt, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1d4ed8',
                }}
              >
                {opt}
                <button
                  type="button"
                  onClick={() => removeOption(opt)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700, padding: 0 }}
                  title="Remove option"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        {err('responseOptions')}
      </div>

      {/* Gaps & Correct Answers Mapping */}
      <div className="qc-field">
        <div style={{ marginBottom: 10 }}>
          <label className="qc-label" style={{ marginBottom: 0 }}>Gaps &amp; Correct Answers</label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gaps.length === 0 ? (
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: 'var(--color-text-muted)', fontSize: 12 }}>
              No gaps in passage yet. Click <strong>+ Insert Gap</strong> above to add gaps.
            </div>
          ) : (
            gaps.map((gap, idx) => (
              <div
                key={gap.id || idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 36px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: '#2563eb' }}>
                  {(gap.id || `gap_${idx + 1}`).replace(/^gap/i, 'Gap')}
                </span>

                {(() => {
                  const currentAnswer = (gap.id && answers[gap.id]) || (gap.label && answers[gap.label]) || answers[String(idx + 1)] || '';
                  const displayOptions = [...responseOptions];
                  if (currentAnswer && !displayOptions.includes(currentAnswer)) {
                    displayOptions.unshift(currentAnswer);
                  }
                  return (
                    <select
                      className="qc-input qc-select"
                      value={currentAnswer}
                      onChange={(e) => updateAnswer(gap.id || `gap_${idx + 1}`, e.target.value)}
                      style={{ fontSize: 12, padding: '6px 10px', marginBottom: 0 }}
                    >
                      <option value="">— Select Correct Option —</option>
                      {displayOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  );
                })()}

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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-danger)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'var(--color-danger)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.color = 'var(--color-danger)';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                  title="Remove this gap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
        {err('gaps')}
        {err('answer')}
      </div>
    </div>
  );
}
