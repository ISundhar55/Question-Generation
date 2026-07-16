import React, { useState } from 'react';

export function OrderingEditor({ options, setOptions, correctOrder, setCorrectOrder, updateOption, err }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const validOptions = options.filter(o => o.trim());
  const sortedItems = correctOrder.filter(item => validOptions.includes(item));
  validOptions.forEach(opt => {
    if (!sortedItems.includes(opt)) {
      sortedItems.push(opt);
    }
  });

  return (
    <div className="qc-field">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}>
        
        {/* Left Panel: Student's Initial View */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label className="qc-label" style={{ marginBottom: 0 }}>Student's Initial View</label>
            {options.length < 10 && (
              <button
                type="button"
                className="qc-btn qc-btn-primary"
                style={{ padding: '6px 12px', fontSize: 11 }}
                onClick={() => setOptions(prev => [...prev, ''])}
              >
                + Add Option
              </button>
            )}
          </div>
          
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                className="qc-input"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button
                type="button"
                disabled={options.length === 1}
                onClick={() => {
                  setOptions(prev => {
                    const deletedVal = prev[i];
                    const next = prev.filter((_, idx) => idx !== i);
                    setCorrectOrder(c => c.filter(item => item !== deletedVal));
                    return next;
                  });
                }}
                style={{
                  padding: '8px 10px',
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: 8,
                  color: 'var(--color-danger)',
                  cursor: options.length === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  opacity: options.length === 1 ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (options.length > 1) {
                    e.currentTarget.style.background = 'var(--color-danger)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = 'var(--color-danger)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (options.length > 1) {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.color = 'var(--color-danger)';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }
                }}
                title={options.length === 1 ? "Cannot delete the last option" : "Remove this option"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))}
          {err('options')}
        </div>

        {/* Right Panel: Drag to Set Correct Response */}
        <div>
          <label className="qc-label" style={{ marginBottom: 12 }}>Drag to Set Correct Response</label>
          <div style={{
            border: '1.5px solid var(--color-border)',
            borderRadius: 10,
            padding: 16,
            background: '#f8f9fb',
            minHeight: 180,
          }}>
            {sortedItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, paddingTop: 60 }}>
                Enter option texts on the left to start ordering.
              </div>
            ) : (
              sortedItems.map((item, idx) => {
                const isDragging = draggedIndex === idx;
                const isOver = dragOverIndex === idx;
                return (
                  <div
                    key={item}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDragOverIndex(idx)}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null || draggedIndex === idx) return;
                      const next = [...sortedItems];
                      const [moved] = next.splice(draggedIndex, 1);
                      next.splice(idx, 0, moved);
                      setCorrectOrder(next);
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`qc-order-item ${isDragging ? 'dragging' : ''}`}
                    style={{
                      borderTop: isOver && draggedIndex > idx ? '2px solid var(--color-primary)' : undefined,
                      borderBottom: isOver && draggedIndex < idx ? '2px solid var(--color-primary)' : undefined,
                    }}
                  >
                    <div className="qc-order-item-num">{idx + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{item}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>☰</div>
                  </div>
                );
              })
            )}
          </div>
          {err('answer')}
        </div>
        
      </div>
    </div>
  );
}

export default OrderingEditor;
