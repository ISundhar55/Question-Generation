import './styles.css';

export function MatrixInteractionEditor({
  header,
  setHeader,
  columns,
  setColumns,
  rows,
  setRows,
  answers,
  setAnswers,
  rationales = {},
  setRationales,
  err,
}) {
  // -------------------------------------------------------------
  // Column Handlers
  // -------------------------------------------------------------
  const addColumn = () => {
    const nextIdx = columns.length + 1;
    const newCol = {
      id: `col_${Date.now()}_${nextIdx}`,
      value: '',
    };
    setColumns([...columns, newCol]);
  };

  const removeColumn = (colIdx) => {
    if (columns.length <= 1) return;
    const removedCol = columns[colIdx];
    const nextCols = columns.filter((_, i) => i !== colIdx);
    setColumns(nextCols);

    // Clean up answers if any row had this column value selected
    if (removedCol) {
      const nextAns = { ...answers };
      Object.keys(nextAns).forEach((rowKey) => {
        if (nextAns[rowKey] === removedCol.value || nextAns[rowKey] === removedCol.id) {
          delete nextAns[rowKey];
        }
      });
      setAnswers(nextAns);
    }
  };

  const updateColumnValue = (colIdx, val) => {
    const oldVal = columns[colIdx]?.value;
    const nextCols = [...columns];
    nextCols[colIdx] = { ...nextCols[colIdx], value: val };
    setColumns(nextCols);

    // If answers mapped by column value, update it
    if (oldVal && oldVal !== val) {
      const nextAns = { ...answers };
      Object.keys(nextAns).forEach((rowKey) => {
        if (nextAns[rowKey] === oldVal) {
          nextAns[rowKey] = val;
        }
      });
      setAnswers(nextAns);
    }
  };

  // -------------------------------------------------------------
  // Row Handlers
  // -------------------------------------------------------------
  const addRow = () => {
    const nextIdx = rows.length + 1;
    const newRow = {
      id: `row_${Date.now()}_${nextIdx}`,
      value: '',
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (rowIdx) => {
    if (rows.length <= 1) return;
    const removedRow = rows[rowIdx];
    const nextRows = rows.filter((_, i) => i !== rowIdx);
    setRows(nextRows);

    // Clean up answers for this row
    if (removedRow) {
      const nextAns = { ...answers };
      delete nextAns[removedRow.value];
      delete nextAns[removedRow.id];
      setAnswers(nextAns);
    }
  };

  const updateRowValue = (rowIdx, val) => {
    const oldVal = rows[rowIdx]?.value;
    const nextRows = [...rows];
    nextRows[rowIdx] = { ...nextRows[rowIdx], value: val };
    setRows(nextRows);

    // Update key in answers
    if (oldVal && oldVal !== val && answers[oldVal]) {
      const nextAns = { ...answers };
      const selectedColVal = nextAns[oldVal];
      delete nextAns[oldVal];
      nextAns[val] = selectedColVal;
      setAnswers(nextAns);
    }
  };

  // -------------------------------------------------------------
  // Answer Selection (Row -> Column Value)
  // -------------------------------------------------------------
  const selectAnswer = (row, col) => {
    const rowKey = row.value || row.id;
    const colVal = col.value || col.id;
    const nextAns = { ...answers };

    nextAns[rowKey] = colVal;
    if (row.value && row.value !== row.id) {
      delete nextAns[row.id];
    }
    setAnswers(nextAns);
  };

  const isSelected = (row, col) => {
    const valByValue = answers[row.value];
    const valById = answers[row.id];
    const expected = col.value || col.id;
    return (
      (Boolean(row.value) && valByValue === expected) ||
      (Boolean(row.id) && valById === expected) ||
      (Boolean(row.value) && Boolean(col.id) && valByValue === col.id) ||
      (Boolean(row.id) && Boolean(col.id) && valById === col.id)
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* =========================================================
          TOP SECTION: Response Option Setup (Row & Column Panels)
         ========================================================= */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
          Response Option
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          
          {/* ----------------- LEFT PANEL: ROW ----------------- */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1.5px solid #cbd5e1',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Row Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="qc-label" style={{ marginBottom: 0, fontSize: 14 }}>
                Row
              </label>
              <button
                type="button"
                className="qc-btn qc-btn-primary"
                onClick={addRow}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                + Add
              </button>
            </div>

            {/* Table Header Input (Top Row) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', width: 85, lineHeight: 1.2 }}>
                Enter table header
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  className="qc-input"
                  placeholder="Enter table header"
                  value={header || ''}
                  onChange={(e) => setHeader(e.target.value)}
                  style={{ marginBottom: 0, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Rows List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
              {rows.map((row, rIdx) => (
                <div key={row.id || rIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Row Text Input */}
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="qc-input"
                      placeholder="Enter row text"
                      value={row.value || ''}
                      onChange={(e) => updateRowValue(rIdx, e.target.value)}
                      style={{ marginBottom: 0, fontSize: 13 }}
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(rIdx)}
                    style={{
                      padding: '8px 10px',
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: 8,
                      color: 'var(--color-danger)',
                      cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: rows.length <= 1 ? 0.3 : 1,
                    }}
                    title="Remove Row"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {err('rows')}
          </div>

          {/* ----------------- RIGHT PANEL: COLUMN ----------------- */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1.5px solid #cbd5e1',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Column Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="qc-label" style={{ marginBottom: 0, fontSize: 14 }}>
                Column
              </label>
              <button
                type="button"
                className="qc-btn qc-btn-primary"
                onClick={addColumn}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                + Add
              </button>
            </div>

            {/* Columns List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {columns.map((col, cIdx) => (
                <div key={col.id || cIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Column Text Input */}
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="qc-input"
                      placeholder="Enter column text"
                      value={col.value || ''}
                      onChange={(e) => updateColumnValue(cIdx, e.target.value)}
                      style={{ marginBottom: 0, fontSize: 13 }}
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    disabled={columns.length <= 1}
                    onClick={() => removeColumn(cIdx)}
                    style={{
                      padding: '8px 10px',
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: 8,
                      color: 'var(--color-danger)',
                      cursor: columns.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: columns.length <= 1 ? 0.3 : 1,
                    }}
                    title="Remove Column"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {err('columns')}
          </div>
        </div>
      </div>

      {/* =========================================================
          BOTTOM SECTION: Interactive Response Selection Matrix Grid
         ========================================================= */}
      <div style={{ marginBottom: 16 }}>
        <label className="qc-label" style={{ marginBottom: 8, fontSize: 13 }}>
          Selection Area / Correct Response Area
        </label>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1.5px solid #cbd5e1',
            overflowX: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 450 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                {/* Top-Left Header Cell */}
                <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', width: '40%' }}>
                  {header?.trim() || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Header</span>}
                </th>

                {/* Column Category Cells */}
                {columns.map((col, cIdx) => (
                  <th
                    key={col.id || cIdx}
                    style={{
                      padding: '12px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      color: 'var(--color-text)',
                      textAlign: 'center',
                      borderRight: cIdx < columns.length - 1 ? '1.5px solid #cbd5e1' : 'none',
                      minWidth: 120,
                    }}
                  >
                    {col.value?.trim() || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Column {cIdx + 1}</span>}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  style={{
                    borderBottom: rIdx < rows.length - 1 ? '1.5px solid #e2e8f0' : 'none',
                    background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                  }}
                >
                  {/* Row Statement Label */}
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text)', borderRight: '1.5px solid #cbd5e1', fontWeight: 500 }}>
                    {row.value?.trim() || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Row {rIdx + 1}</span>}
                  </td>

                  {/* Radio Button Selector Cells */}
                  {columns.map((col, cIdx) => {
                    const selected = isSelected(row, col);

                    return (
                      <td
                        key={col.id || cIdx}
                        onClick={() => selectAnswer(row, col)}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          borderRight: cIdx < columns.length - 1 ? '1.5px solid #cbd5e1' : 'none',
                          cursor: 'pointer',
                          background: selected ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selected ? (
                            /* Green Check Circle */
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: '#22c55e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </div>
                          ) : (
                            /* Open Blue Circle */
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                border: '2px solid #3b82f6',
                                background: '#ffffff',
                                transition: 'all 0.15s',
                              }}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && err('answer')}

        {/* Per-Statement Rationales */}
        {rows.some(r => r.value?.trim()) && (
          <div className="qc-field" style={{ marginTop: 14 }}>
            <label className="qc-label">💡 Per-Statement Rationales</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row, rIdx) => {
                const rowKey = row.value || row.id || `row_${rIdx + 1}`;
                if (!row.value?.trim()) return null;
                return (
                  <div key={row.id || rIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', width: 140, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={row.value}>
                      {row.value}:
                    </span>
                    <input
                      className="qc-input"
                      placeholder={`Explain why this statement is mapped to its column...`}
                      style={{ marginBottom: 0, fontSize: 12, border: '1px dashed #cbd5e1', background: '#fafbfc' }}
                      value={rationales[rowKey] || rationales[row.id] || ''}
                      onChange={e => {
                        if (setRationales) {
                          setRationales(prev => ({
                            ...(typeof prev === 'object' ? prev : {}),
                            [rowKey]: e.target.value,
                          }));
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MatrixInteractionEditor;
