import './styles.css';

export function MultipleDropBucketEditor({
  optionBuckets,
  setOptionBuckets,
  dropBuckets,
  setDropBuckets,
  answers,
  setAnswers,
  err,
}) {
  // -------------------------------------------------------------
  // Option Buckets Handlers
  // -------------------------------------------------------------
  const addOptionBucket = () => {
    const nextIdx = optionBuckets.length + 1;
    const newBucket = {
      id: `opt_bucket_${Date.now()}_${nextIdx}`,
      title: '',
      options: [''],
    };
    setOptionBuckets([...optionBuckets, newBucket]);
  };

  const removeOptionBucket = (bIdx) => {
    if (optionBuckets.length <= 1) return;
    const removed = optionBuckets[bIdx];
    const next = optionBuckets.filter((_, i) => i !== bIdx);
    setOptionBuckets(next);

    // Clean up answers for options removed
    if (removed?.options) {
      const removedSet = new Set(removed.options);
      const nextAnswers = { ...answers };
      Object.keys(nextAnswers).forEach((bId) => {
        if (Array.isArray(nextAnswers[bId])) {
          nextAnswers[bId] = nextAnswers[bId].filter((opt) => !removedSet.has(opt));
        }
      });
      setAnswers(nextAnswers);
    }
  };

  const updateOptionBucketTitle = (bIdx, title) => {
    const next = [...optionBuckets];
    next[bIdx] = { ...next[bIdx], title };
    setOptionBuckets(next);
  };

  const addOptionToBucket = (bIdx) => {
    const next = [...optionBuckets];
    const currentOpts = next[bIdx].options || [];
    next[bIdx] = { ...next[bIdx], options: [...currentOpts, ''] };
    setOptionBuckets(next);
  };

  const updateOptionValue = (bIdx, optIdx, val) => {
    const next = [...optionBuckets];
    const oldVal = next[bIdx].options[optIdx];
    const nextOpts = [...next[bIdx].options];
    nextOpts[optIdx] = val;
    next[bIdx] = { ...next[bIdx], options: nextOpts };
    setOptionBuckets(next);

    // Update in answers if value changed
    if (oldVal && oldVal !== val) {
      const nextAnswers = { ...answers };
      Object.keys(nextAnswers).forEach((bId) => {
        if (Array.isArray(nextAnswers[bId])) {
          nextAnswers[bId] = nextAnswers[bId].map((o) => (o === oldVal ? val : o));
        }
      });
      setAnswers(nextAnswers);
    }
  };

  const removeOptionFromBucket = (bIdx, optIdx) => {
    const next = [...optionBuckets];
    const removedVal = next[bIdx].options[optIdx];
    const nextOpts = next[bIdx].options.filter((_, i) => i !== optIdx);
    next[bIdx] = { ...next[bIdx], options: nextOpts.length > 0 ? nextOpts : [''] };
    setOptionBuckets(next);

    // Clean up in answers
    if (removedVal) {
      const nextAnswers = { ...answers };
      Object.keys(nextAnswers).forEach((bId) => {
        if (Array.isArray(nextAnswers[bId])) {
          nextAnswers[bId] = nextAnswers[bId].filter((o) => o !== removedVal);
        }
      });
      setAnswers(nextAnswers);
    }
  };

  // -------------------------------------------------------------
  // Drop Buckets Handlers
  // -------------------------------------------------------------
  const addDropBucket = () => {
    const nextIdx = dropBuckets.length + 1;
    const newId = `drop_bucket_${Date.now()}_${nextIdx}`;
    const newBucket = {
      id: newId,
      name: '',
    };
    setDropBuckets([...dropBuckets, newBucket]);
  };

  const removeDropBucket = (dIdx) => {
    if (dropBuckets.length <= 1) return;
    const removed = dropBuckets[dIdx];
    const next = dropBuckets.filter((_, i) => i !== dIdx);
    setDropBuckets(next);

    // Remove from answers
    if (removed?.id) {
      const nextAnswers = { ...answers };
      delete nextAnswers[removed.id];
      setAnswers(nextAnswers);
    }
  };

  const updateDropBucketField = (dIdx, field, val) => {
    const next = [...dropBuckets];
    next[dIdx] = { ...next[dIdx], [field]: val };
    setDropBuckets(next);
  };

  // -------------------------------------------------------------
  // Answer Mapping (Option -> Drop Bucket)
  // -------------------------------------------------------------
  const toggleOptionInDropBucket = (dropBucketId, optionText) => {
    if (!optionText || !optionText.trim()) return;
    const currentList = Array.isArray(answers[dropBucketId]) ? answers[dropBucketId] : [];
    const nextAnswers = { ...answers };

    if (currentList.includes(optionText)) {
      nextAnswers[dropBucketId] = currentList.filter((o) => o !== optionText);
    } else {
      // Remove option from any other bucket to maintain single-category classification
      Object.keys(nextAnswers).forEach((bId) => {
        if (Array.isArray(nextAnswers[bId])) {
          nextAnswers[bId] = nextAnswers[bId].filter((o) => o !== optionText);
        }
      });
      nextAnswers[dropBucketId] = [...(nextAnswers[dropBucketId] || []), optionText];
    }
    setAnswers(nextAnswers);
  };

  // Collect all non-empty options across all option buckets
  const allAvailableOptions = optionBuckets
    .flatMap((b) => b.options || [])
    .map((o) => String(o).trim())
    .filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 2-Column Split: Option Buckets & Drop Buckets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* =========================================================
            LEFT COLUMN: Option Buckets
           ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="qc-label" style={{ marginBottom: 0 }}>
              Option Buckets
            </label>
            <button
              type="button"
              className="qc-btn qc-btn-primary"
              onClick={addOptionBucket}
              style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              + Add Option Bucket
            </button>
          </div>

          {optionBuckets.map((bucket, bIdx) => (
            <div
              key={bucket.id || bIdx}
              style={{
                background: '#ffffff',
                borderRadius: 10,
                padding: '16px 16px 14px',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Bucket Title & Trash Delete Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  className="qc-input"
                  placeholder="Enter bucket title (e.g. Energy Pool)"
                  value={bucket.title || ''}
                  onChange={(e) => updateOptionBucketTitle(bIdx, e.target.value)}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 0,
                  }}
                />

                {/* SVG Trash Delete Button */}
                <button
                  type="button"
                  disabled={optionBuckets.length <= 1}
                  onClick={() => removeOptionBucket(bIdx)}
                  style={{
                    padding: '8px 10px',
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 8,
                    color: 'var(--color-danger)',
                    cursor: optionBuckets.length <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: optionBuckets.length <= 1 ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (optionBuckets.length > 1) {
                      e.currentTarget.style.background = 'var(--color-danger)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = 'var(--color-danger)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (optionBuckets.length > 1) {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = 'var(--color-danger)';
                      e.currentTarget.style.borderColor = '#fecaca';
                    }
                  }}
                  title="Remove Option Bucket"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>

              {/* Options Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Response Options
                </span>
                <button
                  type="button"
                  className="qc-btn qc-btn-primary"
                  onClick={() => addOptionToBucket(bIdx)}
                  style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap' }}
                >
                  + Add Response Option
                </button>
              </div>

              {/* Options Inputs List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(bucket.options || []).map((opt, optIdx) => (
                  <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      className="qc-input"
                      placeholder="Enter response option"
                      value={opt}
                      onChange={(e) => updateOptionValue(bIdx, optIdx, e.target.value)}
                      style={{
                        fontSize: 13,
                        marginBottom: 0,
                      }}
                    />

                    {/* SVG Trash Delete Button */}
                    <button
                      type="button"
                      disabled={bucket.options.length <= 1}
                      onClick={() => removeOptionFromBucket(bIdx, optIdx)}
                      style={{
                        padding: '8px 10px',
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        borderRadius: 8,
                        color: 'var(--color-danger)',
                        cursor: bucket.options.length <= 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        opacity: bucket.options.length <= 1 ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (bucket.options.length > 1) {
                          e.currentTarget.style.background = 'var(--color-danger)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = 'var(--color-danger)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (bucket.options.length > 1) {
                          e.currentTarget.style.background = '#fef2f2';
                          e.currentTarget.style.color = 'var(--color-danger)';
                          e.currentTarget.style.borderColor = '#fecaca';
                        }
                      }}
                      title="Remove response option"
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
            </div>
          ))}
          {err('optionBuckets')}
        </div>

        {/* =========================================================
            RIGHT COLUMN: Drop Buckets
           ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="qc-label" style={{ marginBottom: 0 }}>
              Drop Buckets
            </label>
            <button
              type="button"
              className="qc-btn qc-btn-primary"
              onClick={addDropBucket}
              style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              + Add Drop Bucket
            </button>
          </div>

          {dropBuckets.map((bucket, dIdx) => (
            <div
              key={bucket.id || dIdx}
              style={{
                background: '#ffffff',
                borderRadius: 10,
                padding: '16px 16px 14px',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Category Header & Trash Delete Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Category Name
                </span>

                {/* SVG Trash Delete Button */}
                <button
                  type="button"
                  disabled={dropBuckets.length <= 1}
                  onClick={() => removeDropBucket(dIdx)}
                  style={{
                    padding: '8px 10px',
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 8,
                    color: 'var(--color-danger)',
                    cursor: dropBuckets.length <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: dropBuckets.length <= 1 ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (dropBuckets.length > 1) {
                      e.currentTarget.style.background = 'var(--color-danger)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = 'var(--color-danger)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (dropBuckets.length > 1) {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = 'var(--color-danger)';
                      e.currentTarget.style.borderColor = '#fecaca';
                    }
                  }}
                  title="Remove Drop Bucket"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>

              {/* Category Name Input */}
              <input
                type="text"
                className="qc-input"
                placeholder="Enter category name (e.g. Renewable Energy)"
                value={bucket.name || ''}
                onChange={(e) => updateDropBucketField(dIdx, 'name', e.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 0,
                }}
              />
            </div>
          ))}
          {err('dropBuckets')}
        </div>
      </div>

      {/* =========================================================
          BOTTOM SECTION: Correct Answer Classification Matrix
         ========================================================= */}
      <div
        className="qc-field"
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1.5px solid #cbd5e1',
          padding: 16,
          marginTop: 6,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label className="qc-label" style={{ marginBottom: 2 }}>
            Assign Correct Options to Drop Buckets
          </label>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
            Check the options that belong to each drop category.
          </p>
        </div>

        {allAvailableOptions.length === 0 ? (
          <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Add response options in the Option Buckets above to map answers.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(dropBuckets.length, 3)}, 1fr)`, gap: 14 }}>
            {dropBuckets.map((dBucket) => {
              const assigned = Array.isArray(answers[dBucket.id]) ? answers[dBucket.id] : [];

              return (
                <div
                  key={dBucket.id}
                  style={{
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1.5px solid #e2e8f0',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📥</span>
                    <span>{dBucket.name || 'Untitled Category'}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      ({assigned.length} assigned)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allAvailableOptions.map((opt, oIdx) => {
                      const isAssigned = assigned.includes(opt);

                      return (
                        <label
                          key={oIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: isAssigned ? '#e0f2fe' : '#ffffff',
                            border: `1px solid ${isAssigned ? '#7dd3fc' : '#e2e8f0'}`,
                            fontSize: 12,
                            color: isAssigned ? '#0369a1' : 'var(--color-text)',
                            fontWeight: isAssigned ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleOptionInDropBucket(dBucket.id, opt)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {err('answer')}
      </div>
    </div>
  );
}

export default MultipleDropBucketEditor;
