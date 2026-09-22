import React, { useState, useEffect, useRef } from 'react';
import { passagesAPI } from '../services/api';
import { DiagramViewer } from 'question-storybook-ui';

export default function PassageDropdown({
  contentArea,
  grade,
  selectedPassage,
  onSelectPassage,
}) {
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchApprovedPassages = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { status: 'approved' };
        if (contentArea && contentArea !== 'ALL') params.content_area = contentArea;
        if (grade && grade !== 'ALL') params.grade = grade;

        const res = await passagesAPI.getAll(params);
        if (isMounted) {
          setPassages(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load approved passages:', err);
        if (isMounted) setError('Could not load passages.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchApprovedPassages();
    return () => { isMounted = false; };
  }, [contentArea, grade]);

  // Close custom dropdown popover on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{
      background: '#f0fdfa',
      borderRadius: 10,
      border: '1.5px solid #5eead4',
      padding: '14px 16px',
      marginBottom: 20,
    }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: '#0f766e',
          textTransform: 'none',
          letterSpacing: '0.01em',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>📖 Grounded Reading Stimulus (Approved Passages)</span>
        </label>
      </div>

      {/* Custom styled dropdown matching other AI Generate dropdowns */}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <div
          id="ai-passage-select"
          onClick={() => { if (!loading) setDropdownOpen(prev => !prev); }}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: dropdownOpen ? '1.5px solid var(--color-primary, #4f6ef7)' : '1.5px solid #99f6e4',
            boxShadow: dropdownOpen ? '0 0 0 3px rgba(79, 110, 247, 0.15)' : 'none',
            fontSize: 13.5,
            fontWeight: 500,
            background: '#ffffff',
            color: selectedPassage ? '#0f172a' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontWeight: selectedPassage ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loading
              ? 'Loading approved passages…'
              : selectedPassage
                ? selectedPassage.title
                : passages.length === 0
                  ? `No approved passages found for ${contentArea || 'current subject'} (${grade || 'current grade'})`
                  : '— Select an Approved Reading Passage —'}
          </span>
          <span style={{
            fontSize: 10,
            color: '#64748b',
            transition: 'transform 0.15s',
            transform: dropdownOpen ? 'rotate(180deg)' : 'none',
            marginLeft: 8,
            flexShrink: 0,
          }}>
            ▼
          </span>
        </div>

        {/* Hidden native select for accessibility/testing compatibility */}
        <select
          id="passage-select-dropdown"
          value={selectedPassage?.id || ''}
          onChange={(e) => {
            const id = e.target.value ? parseInt(e.target.value, 10) : null;
            onSelectPassage(id ? (passages.find(p => p.id === id) || null) : null);
          }}
          style={{ display: 'none' }}
        >
          <option value="">— Select an Approved Reading Passage —</option>
          {passages.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Custom Dropdown Popover matching other dropdowns */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 220,
            overflowY: 'auto',
            zIndex: 70,
          }}>
            {selectedPassage && (
              <div
                onClick={() => {
                  onSelectPassage(null);
                  setDropdownOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  color: '#64748b',
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span>— None (Clear Selection) —</span>
              </div>
            )}

            {passages.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                No approved passages found for {contentArea} ({grade}).
              </div>
            ) : (
              passages.map(p => {
                const isSelected = selectedPassage?.id === p.id;
                return (
                  <div
                    key={p.id}
                    id={`ai-passage-option-${p.id}`}
                    onClick={() => {
                      onSelectPassage(p);
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: '9px 12px',
                      fontSize: 13.5,
                      fontWeight: isSelected ? 600 : 400,
                      background: isSelected ? 'rgba(79, 110, 247, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--color-primary, #4f6ef7)' : 'var(--color-text, #0f172a)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                    {isSelected && <span style={{ fontSize: 12, color: 'var(--color-primary, #4f6ef7)', marginLeft: 8 }}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>
          ⚠️ {error}
        </div>
      )}

      {passages.length === 0 && !loading && (
        <div style={{ fontSize: 11.5, color: '#0f766e', marginTop: 6, fontStyle: 'italic' }}>
          💡 Tip: You can generate a new stimulus using the <strong>Passage Generation</strong> mode above, and approve it in the Dashboard so it appears here.
        </div>
      )}

      {/* Selected Passage Preview Card */}
      {selectedPassage && (
        <div style={{
          marginTop: 12,
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #ccfbf1',
          padding: '12px 14px',
          boxShadow: '0 1px 3px rgba(13, 148, 136, 0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: '#115e59' }}>
                {selectedPassage.title}
              </span>
              <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 12,
                background: '#ccfbf1',
                color: '#0f766e',
                textTransform: 'capitalize',
              }}>
                {selectedPassage.genre || 'Informational'}
              </span>
              {selectedPassage.visual && (
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 12,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}>
                  🎨 Visual Diagram
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpandedPreview(prev => !prev)}
              style={{
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                color: '#0d9488',
                borderRadius: 6,
                padding: '3px 9px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expandedPreview ? '▲ Collapse Passage' : '▼ View Passage'}
            </button>
          </div>

          {expandedPreview && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid #f0fdfa',
              maxHeight: 340,
              overflowY: 'auto',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: '#334155',
              whiteSpace: 'pre-line',
            }}>
              {selectedPassage.visual && (
                <div style={{ marginBottom: 12 }}>
                  <DiagramViewer
                    svgCode={selectedPassage.visual}
                    filename={`stimulus_${(selectedPassage.title || 'diagram').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                  />
                </div>
              )}
              {selectedPassage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
