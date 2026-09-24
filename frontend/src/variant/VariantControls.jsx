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
    label: '🔀 Different Format',
    desc: 'Change question type (e.g. to Multi-Select or True/False).',
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
  count = 2,
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {VARIANT_STYLES.map((st) => {
            const isSelected = variantStyle === st.id;
            return (
              <div
                key={st.id}
                onClick={() => {
                  if (handleStyleChange) {
                    handleStyleChange(st.id);
                  }
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSelected ? `2px solid ${st.color}` : '1.5px solid #e2e8f0',
                  background: isSelected ? st.bg : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(79, 110, 247, 0.1)' : 'none',
                  userSelect: 'none',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? st.color : '#1e293b', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{st.label}</span>
                  {isSelected && <span style={{ fontSize: 12, color: st.color }}>✓</span>}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.35 }}>
                  {st.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Question Type (shown if format shift) */}
      {variantStyle === 'format_shift' && (
        <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            🔀 Target Question Format
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
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const isSelected = currentCount === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleCountChange && handleCountChange(n)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: isSelected ? '2px solid var(--color-primary, #4f6ef7)' : '1.5px solid #cbd5e1',
                  background: isSelected ? 'var(--color-primary-light, #eff6ff)' : '#ffffff',
                  color: isSelected ? 'var(--color-primary, #4f6ef7)' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {n} {n === 1 ? 'item' : 'items'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
