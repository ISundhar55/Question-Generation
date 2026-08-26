import React, { useState } from 'react';

export function BackgroundGraphicEditor({
  svgGraphic,
  setSvgGraphic,
  dropZoneWidth,
  setDropZoneWidth,
  dropZoneHeight,
  setDropZoneHeight,
  dropZones,
  setDropZones,
  labelBank,
  setLabelBank,
  answers,
  setAnswers,
  err,
}) {
  const [newLabel, setNewLabel] = useState('');

  const addDropZone = () => {
    const nextNum = dropZones.length + 1;
    const pin = String.fromCharCode(64 + nextNum); // A, B, C...
    const newZone = {
      id: `zone_${nextNum}`,
      pin_label: pin,
      x_percent: 50,
      y_percent: 50,
      description: `Structure ${pin}`,
    };
    setDropZones([...dropZones, newZone]);
  };

  const removeDropZone = (idx) => {
    const updated = dropZones.filter((_, i) => i !== idx);
    setDropZones(updated);
  };

  const updateZone = (idx, field, val) => {
    const updated = [...dropZones];
    updated[idx] = { ...updated[idx], [field]: val };
    setDropZones(updated);
  };

  const addLabel = () => {
    if (!newLabel.trim()) return;
    if (!labelBank.includes(newLabel.trim())) {
      setLabelBank([...labelBank, newLabel.trim()]);
    }
    setNewLabel('');
  };

  const removeLabel = (lbl) => {
    setLabelBank(labelBank.filter((l) => l !== lbl));
    // Clear from answers if mapped
    const nextAnswers = { ...answers };
    Object.keys(nextAnswers).forEach((k) => {
      if (nextAnswers[k] === lbl) delete nextAnswers[k];
    });
    setAnswers(nextAnswers);
  };

  const updateAnswer = (zoneId, pinLabel, selectedLabel) => {
    const next = { ...answers };
    if (zoneId) next[zoneId] = selectedLabel;
    if (pinLabel) next[pinLabel] = selectedLabel;
    setAnswers(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* SVG Diagram Code */}
      <div className="qc-field">
        <label className="qc-label">
          SVG Graphic Code <span style={{ color: 'var(--color-primary)' }}>(Paste &lt;svg&gt;...&lt;/svg&gt;)</span>
        </label>
        <textarea
          className="qc-input qc-textarea"
          rows={5}
          placeholder="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'>...</svg>"
          value={svgGraphic}
          onChange={(e) => setSvgGraphic(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        {err('svgGraphic')}
      </div>

      {/* Drop Zone Dimensions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="qc-field">
          <label className="qc-label">Drop Zone Width (px)</label>
          <input
            type="number"
            className="qc-input"
            value={dropZoneWidth}
            onChange={(e) => setDropZoneWidth(Number(e.target.value) || 120)}
            min={80}
            max={240}
          />
        </div>
        <div className="qc-field">
          <label className="qc-label">Drop Zone Height (px)</label>
          <input
            type="number"
            className="qc-input"
            value={dropZoneHeight}
            onChange={(e) => setDropZoneHeight(Number(e.target.value) || 36)}
            min={24}
            max={80}
          />
        </div>
      </div>

      {/* Label Bank Manager */}
      <div className="qc-field">
        <label className="qc-label">Label Bank (Options &amp; Distractors)</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            className="qc-input"
            placeholder="Enter option name (e.g. Chloroplast)..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
          />
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={addLabel}
            style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            + Add Option
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          {labelBank.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No options added yet. Add options above.</span>
          ) : (
            labelBank.map((lbl, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#065f46',
                }}
              >
                {lbl}
                <button
                  type="button"
                  onClick={() => removeLabel(lbl)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#047857', fontWeight: 700, padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        {err('labelBank')}
      </div>

      {/* Drop Zones & Coordinate Pins */}
      <div className="qc-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label className="qc-label" style={{ marginBottom: 0 }}>Drop Zones &amp; Correct Answers</label>
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={addDropZone}
            style={{ fontSize: 12, padding: '10px 14px', whiteSpace: 'nowrap' }}
          >
            + Add Drop Zone
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dropZones.map((zone, idx) => (
            <div
              key={zone.id || idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px 80px 1fr 36px',
                gap: 8,
                alignItems: 'center',
                padding: '8px 12px',
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 8,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: '#059669', textAlign: 'center' }}>
                {zone.pin_label}
              </span>
              <input
                type="text"
                className="qc-input"
                placeholder="Description / Pin Title"
                value={zone.description || ''}
                onChange={(e) => updateZone(idx, 'description', e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>X:</span>
                <input
                  type="number"
                  className="qc-input"
                  value={zone.x_percent || 0}
                  onChange={(e) => updateZone(idx, 'x_percent', Number(e.target.value))}
                  style={{ fontSize: 12, padding: '4px 6px' }}
                  min={0}
                  max={100}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Y:</span>
                <input
                  type="number"
                  className="qc-input"
                  value={zone.y_percent || 0}
                  onChange={(e) => updateZone(idx, 'y_percent', Number(e.target.value))}
                  style={{ fontSize: 12, padding: '4px 6px' }}
                  min={0}
                  max={100}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>%</span>
              </div>
              {(() => {
                const currentAnswer = (zone.id && answers[zone.id]) || (zone.pin_label && answers[zone.pin_label]) || answers[String(idx + 1)] || '';
                // Ensure currentAnswer is in the options list even if not yet in labelBank
                const displayOptions = [...labelBank];
                if (currentAnswer && !displayOptions.includes(currentAnswer)) {
                  displayOptions.unshift(currentAnswer);
                }
                return (
                  <select
                    className="qc-input qc-select"
                    value={currentAnswer}
                    onChange={(e) => updateAnswer(zone.id, zone.pin_label, e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  >
                    <option value="">— Correct Label —</option>
                    {displayOptions.map((lbl, i) => (
                      <option key={i} value={lbl}>{lbl}</option>
                    ))}
                  </select>
                );
              })()}
              <button
                type="button"
                disabled={dropZones.length <= 1}
                onClick={() => removeDropZone(idx)}
                style={{
                  padding: '8px 10px',
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: 8,
                  color: 'var(--color-danger)',
                  cursor: dropZones.length <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  opacity: dropZones.length <= 1 ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (dropZones.length > 1) {
                    e.currentTarget.style.background = 'var(--color-danger)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'var(--color-danger)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (dropZones.length > 1) {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.color = 'var(--color-danger)';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }
                }}
                title={dropZones.length <= 1 ? "Cannot delete the last drop zone" : "Remove this drop zone"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
        {err('dropZones')}
        {err('answer')}
      </div>
    </div>
  );
}
