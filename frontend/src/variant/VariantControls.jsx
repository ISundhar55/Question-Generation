import React from 'react';
import { QUESTION_TYPES } from '../pages/aiGenerateConstants';

const VARIANT_STYLES = [
  {
    id: 'parallel',
    label: '🔄 Similar (Same Level)',
    desc: 'Same concept and difficulty with a new scenario.',
    color: '#4f6ef7',
    bg: '#eef1fe',
  },
  {
    id: 'easier',
    label: '📉 Easier',
    desc: 'A simpler version with direct clues.',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    id: 'harder',
    label: '📈 Harder',
    desc: 'A deeper, more challenging version.',
    color: '#d97706',
    bg: '#fef3c7',
  },
  {
    id: 'format_shift',
    label: '🔀 Different Question Type',
    desc: 'Change question type (e.g. to Dropdown, Matching, or Multi-Select).',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
];

export default function VariantControls({
  variantStyle = 'parallel',
  setVariantStyle,
  onChangeVariantStyle,
  targetType = 'SINGLE_SELECT',
  setTargetType,
  onChangeTargetType,
  count = 1,
  setCount,
  variantCount,
  onChangeVariantCount,
}) {
  const handleStyleChange = onChangeVariantStyle || setVariantStyle;
  const handleTypeChange = onChangeTargetType || setTargetType;
  const currentCount = variantCount !== undefined ? variantCount : count;
  const handleCountChange = onChangeVariantCount || setCount;

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '16px 18px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Transformation Goal */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🎯 Choose Variant Transformation Goal
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {VARIANT_STYLES.map((st) => {
            const isSelected = variantStyle === st.id;
            return (
              <button
                key={st.id}
                type="button"
                title={st.desc}
                onClick={() => {
                  if (handleStyleChange) {
                    handleStyleChange(st.id);
                  }
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: isSelected ? `2px solid ${st.color}` : '1.5px solid #cbd5e1',
                  background: isSelected ? st.bg : '#ffffff',
                  color: isSelected ? st.color : '#1e293b',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 6px rgba(79, 110, 247, 0.12)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  textAlign: 'left',
                }}
              >
                <span>{st.label}</span>
                {isSelected && <span style={{ fontSize: 12, color: st.color }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Question Type (shown if format shift) */}
      {variantStyle === 'format_shift' && (
        <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            🔀 Target Question Type
          </label>
          <select
            value={targetType}
            onChange={(e) => handleTypeChange && handleTypeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Variant Count */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Number of Variants to Generate
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="ai-variant-count"
            type="number"
            min={1}
            max={5}
            value={currentCount === '' ? '' : currentCount}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                handleCountChange && handleCountChange('');
              } else {
                const val = parseInt(raw, 10);
                if (!isNaN(val)) {
                  handleCountChange && handleCountChange(Math.max(1, Math.min(5, val)));
                }
              }
            }}
            onBlur={() => {
              if (currentCount === '' || Number(currentCount) < 1) {
                handleCountChange && handleCountChange(1);
              } else if (Number(currentCount) > 5) {
                handleCountChange && handleCountChange(5);
              }
            }}
            style={{
              width: 80,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1.5px solid #cbd5e1',
              fontSize: 14,
              fontWeight: 700,
              color: '#0f172a',
              background: '#ffffff',
              outline: 'none',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
            (Max 5 variants)
          </span>
        </div>
      </div>
    </div>
  );
}
