import { useMemo } from 'react';
import './styles.css';

const SELECTION_TYPES = [
  { value: 'Sentence', label: 'Sentence' },
  { value: 'Paragraph', label: 'Paragraph' },
  { value: 'Words', label: 'Words' },
  { value: 'Manual selection', label: 'Manual selection' },
];

export function SelectTextEditor({
  selectionType = 'Sentence',
  setSelectionType,
  maxSelections = 1,
  setMaxSelections,
  passage = '',
  setPassage,
  answers = [],
  setAnswers,
  err,
}) {
  // -------------------------------------------------------------
  // Parse passage into tokens based on selectionType
  // -------------------------------------------------------------
  const tokens = useMemo(() => {
    if (!passage || !passage.trim()) return [];

    if (selectionType === 'Paragraph') {
      return passage
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    }

    if (selectionType === 'Words') {
      return passage
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
    }

    if (selectionType === 'Manual selection') {
      const customMatches = [];
      const regex = /\[(?:text_?\d*:\s*)?([^\]]+)\]/g;
      let match;
      while ((match = regex.exec(passage)) !== null) {
        customMatches.push(match[1].trim());
      }
      if (customMatches.length > 0) {
        return customMatches;
      }
    }

    // Default: Sentence level parsing
    const sentences = [];
    const rawSentences = passage.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+$/g) || [passage];
    rawSentences.forEach((s) => {
      const trimmed = s.trim();
      if (trimmed) sentences.push(trimmed);
    });
    return sentences.length > 0 ? sentences : [passage.trim()];
  }, [passage, selectionType]);

  // -------------------------------------------------------------
  // Toggle answer selection
  // -------------------------------------------------------------
  const toggleSelection = (tokenText) => {
    if (!tokenText) return;
    const currentList = Array.isArray(answers) ? [...answers] : [];
    const isAlreadySelected = currentList.includes(tokenText);

    if (isAlreadySelected) {
      setAnswers(currentList.filter((item) => item !== tokenText));
    } else {
      const maxCount = Math.max(1, parseInt(maxSelections, 10) || 1);
      if (currentList.length >= maxCount) {
        if (maxCount === 1) {
          setAnswers([tokenText]);
        } else {
          const next = [...currentList.slice(1), tokenText];
          setAnswers(next);
        }
      } else {
        setAnswers([...currentList, tokenText]);
      }
    }
  };

  const selectedCount = Array.isArray(answers) ? answers.length : 0;
  const maxLimit = Math.max(1, parseInt(maxSelections, 10) || 1);

  const wordCount = passage.trim() ? passage.trim().split(/\s+/).length : 0;
  const charCount = passage.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Configuration Card: Selection Type & Max Selections */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1.5px solid #cbd5e1',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
          Selection Settings
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
          {/* Selection Type Dropdown */}
          <div>
            <label className="qc-label" style={{ marginBottom: 6, fontSize: 12 }}>
              Selection Type
            </label>
            <select
              className="qc-select"
              value={selectionType}
              onChange={(e) => setSelectionType(e.target.value)}
              style={{
                height: 44,
                fontSize: 14,
                borderRadius: 8,
                borderColor: '#cbd5e1',
                padding: '0 14px',
              }}
            >
              {SELECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Max Selections Number Input */}
          <div>
            <label className="qc-label" style={{ marginBottom: 6, fontSize: 12 }}>
              Max Selections
            </label>
            <input
              type="number"
              className="qc-input"
              min={1}
              max={10}
              value={maxSelections}
              onChange={(e) => setMaxSelections(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                height: 44,
                fontSize: 14,
                borderRadius: 8,
                borderColor: '#cbd5e1',
                padding: '0 14px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Passage Textarea Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1.5px solid #cbd5e1',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label className="qc-label" style={{ marginBottom: 0, fontSize: 12 }}>
            Passage Content
          </label>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
            Words: <strong>{wordCount}</strong> &bull; Characters: <strong>{charCount}</strong>
          </div>
        </div>

        <textarea
          className="qc-input"
          rows={6}
          placeholder="Enter the reading passage, poem, or text here..."
          value={passage || ''}
          onChange={(e) => setPassage(e.target.value)}
          style={{
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.65,
            borderRadius: 8,
            borderColor: '#cbd5e1',
            padding: 12,
            resize: 'vertical',
          }}
        />
        {err('passage')}
      </div>

      {/* Interactive Selection Area (Clickable Tokens) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1.5px solid #cbd5e1',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          marginBottom: 16,
        }}
      >
        {/* Header bar with Selection Status Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Selection Area / Correct Response Area
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
              Click on the {selectionType.toLowerCase()}s below to mark correct answers.
            </p>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: selectedCount === maxLimit ? '#dcfce7' : '#eff6ff',
              color: selectedCount === maxLimit ? '#15803d' : '#1d4ed8',
              border: `1.5px solid ${selectedCount === maxLimit ? '#86efac' : '#bfdbfe'}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Selected: {selectedCount} / {maxLimit} {selectedCount === maxLimit && '✔ Max Limit'}
          </div>
        </div>

        {/* Live Interactive Passage Box */}
        {!passage.trim() ? (
          <div
            style={{
              padding: '30px 20px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1.5px dashed #cbd5e1',
              fontSize: 13,
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            Type or paste a passage in the box above to see and select clickable {selectionType.toLowerCase()}s.
          </div>
        ) : (
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              lineHeight: 2.1,
              fontSize: 14,
              display: 'flex',
              flexWrap: 'wrap',
              gap: selectionType === 'Paragraph' ? 14 : selectionType === 'Words' ? 6 : 8,
            }}
          >
            {tokens.map((tokenText, idx) => {
              const isSelected = Array.isArray(answers) && answers.includes(tokenText);

              return (
                <span
                  key={idx}
                  onClick={() => toggleSelection(tokenText)}
                  style={{
                    display: selectionType === 'Paragraph' ? 'block' : 'inline-flex',
                    width: selectionType === 'Paragraph' ? '100%' : 'auto',
                    alignItems: 'center',
                    gap: 6,
                    padding: selectionType === 'Paragraph' ? '10px 14px' : '5px 12px',
                    borderRadius: 6,
                    background: isSelected ? '#dbeafe' : '#ffffff',
                    border: `1.5px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                    color: isSelected ? '#1e40af' : 'var(--color-text)',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? '0 2px 5px rgba(37, 99, 235, 0.18)' : '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.borderColor = '#60a5fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }
                  }}
                  title={isSelected ? 'Click to deselect' : 'Click to select as correct answer'}
                >
                  {isSelected && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 900,
                        marginRight: 2,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                  )}
                  <span>{tokenText}</span>
                </span>
              );
            })}
          </div>
        )}
        {err('answer')}
      </div>
    </div>
  );
}

export default SelectTextEditor;
