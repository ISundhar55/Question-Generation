import React, { useState, useEffect, useMemo } from 'react';
import { questionsAPI } from '../services/api';
import { QUESTION_TYPES } from '../pages/aiGenerateConstants';

export default function ReferenceItemPicker({
  isOpen,
  onClose,
  onSelect,
}) {
  const [activeTab, setActiveTab] = useState('bank'); // 'bank' | 'manual'
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for bank
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Manual input state
  const [manualType, setManualType] = useState('SINGLE_SELECT');
  const [manualText, setManualText] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState('medium');
  const [manualExplanation, setManualExplanation] = useState('');

  // 1 & 2. Single / Multi Select
  const [manualOptions, setManualOptions] = useState('A: Option 1\nB: Option 2\nC: Option 3\nD: Option 4');
  const [manualAnswer, setManualAnswer] = useState('A');

  // 3. True / False
  const [trueFalseAnswer, setTrueFalseAnswer] = useState('True');

  // 4. Constructed Response (Fill-in-the-blank with acceptable alternatives)
  const [constructedBlanks, setConstructedBlanks] = useState('Blank 1: water, moisture, H2O\nBlank 2: carbon dioxide, CO2');

  // 5. Dropdown
  const [dropdownBlanks, setDropdownBlanks] = useState('Blank 1: light, thermal, sound, electrical\nBlank 2: chemical, kinetic, nuclear, potential');
  const [dropdownAnswers, setDropdownAnswers] = useState('Blank 1: light\nBlank 2: chemical');

  // 6. Matching Lines
  const [matchingPairs, setMatchingPairs] = useState('Mitochondria -> Cellular respiration and ATP production\nRibosome -> Protein synthesis\nChloroplast -> Photosynthesis and sugar production');

  // 7. Ordering
  const [orderingItems, setOrderingItems] = useState('Evaporation of surface water\nCondensation into clouds\nPrecipitation as rain or snow\nCollection in rivers and oceans');

  // 8. Gap Match
  const [gapBank, setGapBank] = useState('Carbon dioxide\nOxygen\nGlucose\nNitrogen');
  const [gapAnswers, setGapAnswers] = useState('gap_1: Carbon dioxide\ngap_2: Oxygen');

  // 9. Multiple Drop Bucket
  const [bucketCategories, setBucketCategories] = useState('Renewable Energy\nNon-Renewable Energy');
  const [bucketItems, setBucketItems] = useState('Solar power -> Renewable Energy\nCoal -> Non-Renewable Energy\nWind energy -> Renewable Energy\nNatural gas -> Non-Renewable Energy');

  // 10. Matrix Interaction
  const [matrixColumns, setMatrixColumns] = useState('True, False');
  const [matrixRows, setMatrixRows] = useState('Plants consume carbon dioxide during photosynthesis.\nSound waves can travel through a complete vacuum.\nWater expands when it freezes into ice.');
  const [matrixAnswers, setMatrixAnswers] = useState('Plants consume carbon dioxide during photosynthesis.: True\nSound waves can travel through a complete vacuum.: False\nWater expands when it freezes into ice.: True');

  // 11. Select Text
  const [selectTextTargets, setSelectTextTargets] = useState('The researchers noticed an unexpected change in temperature.\nThe chemical reaction proceeded at double the expected speed.\nAll instruments remained calibrated throughout the trial.');
  const [selectTextAnswer, setSelectTextAnswer] = useState('The chemical reaction proceeded at double the expected speed.');

  useEffect(() => {
    if (isOpen) {
      loadApprovedQuestions();
    }
  }, [isOpen]);

  const loadApprovedQuestions = async () => {
    setLoading(true);
    try {
      // Only fetch approved questions from the API
      const res = await questionsAPI.getAll({ status: 'approved' });
      setQuestions(res.data || []);
    } catch (err) {
      console.error('Failed to load approved questions for picker:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeType = (t) => {
    if (!t) return '';
    const clean = String(t).toUpperCase().replace(/[-\s]/g, '_');
    if (clean === 'MCQ') return 'SINGLE_SELECT';
    if (clean === 'FILL_IN_BLANK' || clean === 'SHORT_ANSWER') return 'CONSTRUCTED_RESPONSE';
    return clean;
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Only approved items
      if (q.status !== 'approved') return false;

      // Exclude passage-grounded questions (no passage needed)
      if (q.passage_id) return false;

      // Search
      const textMatch = !search.trim() || (q.text || q.question || '').toLowerCase().includes(search.toLowerCase());

      // Type
      const qType = normalizeType(q.questionType || q.type);
      const typeMatch = typeFilter === 'ALL' || qType === typeFilter;

      return textMatch && typeMatch;
    });
  }, [questions, search, typeFilter]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;

    let finalOptions = null;
    let finalAnswer = manualAnswer.trim();

    if (manualType === 'SINGLE_SELECT' || manualType === 'MULTIPLE_SELECT') {
      const optsObj = {};
      const lines = manualOptions.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([A-Za-z0-9]+)\s*[:\.\-]\s*(.*)$/);
        if (match) {
          optsObj[match[1].toUpperCase()] = match[2].trim();
        } else if (line.trim()) {
          const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
          const nextKey = keys[Object.keys(optsObj).length] || String(Object.keys(optsObj).length + 1);
          optsObj[nextKey] = line.trim();
        }
      });
      finalOptions = Object.keys(optsObj).length > 0 ? optsObj : null;
      finalAnswer = manualType === 'MULTIPLE_SELECT'
        ? manualAnswer.trim().replace(/[,\s]+/g, '|')
        : manualAnswer.trim().toUpperCase();
    } else if (manualType === 'TRUE_FALSE') {
      finalOptions = { A: 'True', B: 'False' };
      finalAnswer = trueFalseAnswer;
    } else if (manualType === 'CONSTRUCTED_RESPONSE') {
      const answersArr = [];
      const primaryAns = [];
      constructedBlanks.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split(':');
        const vals = (parts.length >= 2 ? parts[1] : line).split(',').map(s => s.trim()).filter(Boolean);
        if (vals.length > 0) {
          answersArr.push(vals);
          primaryAns.push(vals[0]);
        }
      });
      finalOptions = answersArr.length > 0 ? { answers: answersArr } : null;
      finalAnswer = primaryAns.join('|');
    } else if (manualType === 'DROPDOWN') {
      const blanks = [];
      const ansLines = dropdownAnswers.split('\n');
      dropdownBlanks.split('\n').filter(Boolean).forEach((line, idx) => {
        const parts = line.split(':');
        const choices = (parts.length >= 2 ? parts[1] : line).split(',').map(s => s.trim()).filter(Boolean);
        const ansPart = ansLines[idx] ? ansLines[idx].split(':') : [];
        const correctVal = ansPart.length >= 2 ? ansPart[1].trim() : (ansLines[idx] || choices[0] || '').trim();
        if (choices.length > 0) {
          blanks.push({ choices, correct: correctVal });
        }
      });
      finalOptions = { blanks };
      finalAnswer = blanks.map(b => b.correct).join('|');
    } else if (manualType === 'MATCHING_LINES') {
      const left = {};
      const right = {};
      const ansPairs = [];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      matchingPairs.split('\n').filter(Boolean).forEach((line, idx) => {
        const parts = line.split(/->|\|/);
        if (parts.length >= 2) {
          const lKey = letters[idx] || String(idx + 1);
          const rKey = String(idx + 1);
          left[lKey] = parts[0].trim();
          right[rKey] = parts[1].trim();
          ansPairs.push(`${lKey}-${rKey}`);
        }
      });
      finalOptions = { left, right };
      finalAnswer = ansPairs.join(', ');
    } else if (manualType === 'ORDERING') {
      const items = orderingItems.split('\n').map(s => s.trim()).filter(Boolean);
      finalOptions = items;
      finalAnswer = items.join('|');
    } else if (manualType === 'GAP_MATCH') {
      const responseOptions = gapBank.split('\n').map(s => s.trim()).filter(Boolean);
      const gapAnsObj = {};
      const gapObjList = [];
      gapAnswers.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const id = parts[0].trim();
          const target = parts[1].trim();
          gapAnsObj[id] = target;
          gapObjList.push({ id, label: id.replace('_', ' ').toUpperCase() });
        }
      });
      finalOptions = {
        passage: manualText.trim(),
        gaps: gapObjList.length > 0 ? gapObjList : [{ id: 'gap_1', label: 'GAP 1' }, { id: 'gap_2', label: 'GAP 2' }],
        response_options: responseOptions,
      };
      finalAnswer = gapAnsObj;
    } else if (manualType === 'MULTIPLE_DROP_BUCKET') {
      const catList = bucketCategories.split('\n').map(s => s.trim()).filter(Boolean);
      const answerObj = {};
      const allItems = [];
      catList.forEach(c => { answerObj[c] = []; });

      bucketItems.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split(/->|:/);
        if (parts.length >= 2) {
          const item = parts[0].trim();
          const bucket = parts[1].trim();
          allItems.push(item);
          if (!answerObj[bucket]) answerObj[bucket] = [];
          answerObj[bucket].push(item);
        }
      });
      finalOptions = {
        option_buckets: [{ id: 'opt_bucket_1', title: 'Items', options: allItems }],
        drop_buckets: catList.map((c, i) => ({ id: `drop_bucket_${i + 1}`, name: c, rationale: '' })),
      };
      finalAnswer = answerObj;
    } else if (manualType === 'MATRIX_INTERACTION') {
      const cols = matrixColumns.split(',').map(s => s.trim()).filter(Boolean);
      const rows = matrixRows.split('\n').map(s => s.trim()).filter(Boolean);
      const ansObj = {};
      matrixAnswers.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          ansObj[parts[0].trim()] = parts[1].trim();
        }
      });
      finalOptions = {
        header: 'Statements',
        columns: cols.map((c, i) => ({ id: `col_${i + 1}`, value: c })),
        rows: rows.map((r, i) => ({ id: `row_${i + 1}`, value: r })),
      };
      finalAnswer = Object.keys(ansObj).length > 0 ? ansObj : rows.reduce((acc, r) => ({ ...acc, [r]: cols[0] || 'True' }), {});
    } else if (manualType === 'SELECT_TEXT') {
      const targets = selectTextTargets.split('\n').map(s => s.trim()).filter(Boolean);
      finalOptions = {
        selection_type: 'Sentence',
        max_selections: 1,
        passage: manualText.trim(),
        selectable_items: targets,
      };
      finalAnswer = [selectTextAnswer.trim()];
    } else {
      finalAnswer = manualAnswer.trim();
    }

    const parsedQuestion = {
      text: manualText.trim(),
      type: manualType,
      questionType: manualType,
      difficulty: manualDifficulty,
      options: finalOptions,
      answer: finalAnswer,
      explanation: manualExplanation.trim() || undefined,
    };

    onSelect(parsedQuestion);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 840,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🧬</span> Select Seed Reference Question
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '3px 0 0 0' }}>
              Select an approved standalone question from your bank or enter one manually to generate variants.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'bank' ? '2.5px solid var(--color-primary, #4f6ef7)' : '2.5px solid transparent',
              color: activeTab === 'bank' ? 'var(--color-primary, #4f6ef7)' : '#64748b',
              fontWeight: activeTab === 'bank' ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            📚 Approved Questions ({filteredQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'manual' ? '2.5px solid var(--color-primary, #4f6ef7)' : '2.5px solid transparent',
              color: activeTab === 'manual' ? 'var(--color-primary, #4f6ef7)' : '#64748b',
              fontWeight: activeTab === 'manual' ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✍️ Enter Custom / Paste Question
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'bank' ? (
            <div>
              {/* Search & Type Filter Bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Search approved questions by text or keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                  }}
                />

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    background: '#ffffff',
                    minWidth: 220,
                  }}
                >
                  <option value="ALL">All Question Types ({QUESTION_TYPES.length})</option>
                  {QUESTION_TYPES.map(qt => (
                    <option key={qt.value} value={qt.value}>
                      {qt.icon} {qt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Question Items List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  Loading approved questions...
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>No approved questions found</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Only questions with <strong>Approved</strong> status (and without passages) are eligible as reference seeds.<br />
                    Approve items in your Question Bank, or use the <strong>Enter Custom / Paste Question</strong> tab.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredQuestions.map((q) => {
                    const qType = normalizeType(q.questionType || q.type);
                    const qTypeObj = QUESTION_TYPES.find(t => t.value === qType);

                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          onSelect(q);
                          onClose();
                        }}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary, #4f6ef7)';
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                              #{q.id}
                            </span>
                            <span
                              style={{
                                padding: '1px 7px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#eef2ff',
                                color: '#4338ca',
                              }}
                            >
                              {qTypeObj?.label || q.questionType || q.type || 'Question'}
                            </span>
                            <span style={{ fontSize: 11, color: '#047857', background: '#d1fae5', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              ✓ Approved
                            </span>
                            {q.difficulty && (
                              <span style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary, #4f6ef7)' }}>
                            Select Seed →
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>
                          {q.text || q.question}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Manual Input Form with Dynamic Fields per Question Type */
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Question Type & Difficulty Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    Question Type *
                  </label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                  >
                    {QUESTION_TYPES.map(qt => (
                      <option key={qt.value} value={qt.value}>
                        {qt.icon} {qt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    Difficulty
                  </label>
                  <select
                    value={manualDifficulty}
                    onChange={(e) => setManualDifficulty(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Stem / Text */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                  {manualType === 'CONSTRUCTED_RESPONSE'
                    ? 'Question Text with Blanks (use ___ for each blank) *'
                    : manualType === 'DROPDOWN'
                    ? 'Question Text with Blanks (use ___ for each dropdown) *'
                    : manualType === 'GAP_MATCH'
                    ? 'Passage / Text with Gaps (use [gap_1], [gap_2], etc.) *'
                    : manualType === 'SELECT_TEXT'
                    ? 'Passage or Text Excerpt *'
                    : manualType === 'ORDERING'
                    ? 'Instruction / Context *'
                    : manualType === 'MATCHING_LINES'
                    ? 'Instruction / Matching Prompt *'
                    : manualType === 'MULTIPLE_DROP_BUCKET'
                    ? 'Instruction / Categorization Prompt *'
                    : manualType === 'MATRIX_INTERACTION'
                    ? 'Instruction / Matrix Evaluation Prompt *'
                    : manualType === 'TRUE_FALSE'
                    ? 'Statement to Evaluate as True or False *'
                    : 'Question Stem / Text *'}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={
                    manualType === 'CONSTRUCTED_RESPONSE'
                      ? 'e.g. During photosynthesis, green plants absorb ___ through roots and take in ___ from the atmosphere.'
                      : manualType === 'DROPDOWN'
                      ? 'e.g. Photosynthesis converts ___ energy into ___ energy stored in sugars.'
                      : manualType === 'GAP_MATCH'
                      ? 'e.g. Water moves into root cells through [gap_1]. It is then transported upwards through [gap_2] vessels.'
                      : manualType === 'ORDERING'
                      ? 'e.g. Arrange the following stages of the water cycle in sequence starting with evaporation.'
                      : manualType === 'SELECT_TEXT'
                      ? 'e.g. The laboratory was silent. Dr. Aris reviewed the data twice. The chemical reaction was proceeding at three times the expected rate.'
                      : manualType === 'MATCHING_LINES'
                      ? 'e.g. Match each cell organelle with its primary biological function.'
                      : manualType === 'MULTIPLE_DROP_BUCKET'
                      ? 'e.g. Sort each energy source into Renewable or Non-Renewable.'
                      : manualType === 'MATRIX_INTERACTION'
                      ? 'e.g. For each statement below, determine whether it is True or False.'
                      : manualType === 'TRUE_FALSE'
                      ? 'e.g. Sound waves travel faster in water than in air.'
                      : 'e.g. Which fraction is equivalent to 1/2?'
                  }
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
                {(manualType === 'CONSTRUCTED_RESPONSE' || manualType === 'DROPDOWN') && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    💡 Tip: Use three underscores <code>___</code> in the sentence for each blank.
                  </div>
                )}
              </div>

              {/* 1 & 2. Dynamic Inputs for SINGLE_SELECT & MULTIPLE_SELECT */}
              {(manualType === 'SINGLE_SELECT' || manualType === 'MULTIPLE_SELECT') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Options (one per line, e.g. "A: Option text") *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={manualOptions}
                      onChange={(e) => setManualOptions(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Correct Answer {manualType === 'MULTIPLE_SELECT' ? '(e.g. A, C or A|C)' : '(e.g. A)'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={manualType === 'MULTIPLE_SELECT' ? 'e.g. A, C' : 'e.g. A'}
                      value={manualAnswer}
                      onChange={(e) => setManualAnswer(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                </>
              )}

              {/* 3. Dynamic Inputs for TRUE_FALSE */}
              {manualType === 'TRUE_FALSE' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    Correct Answer *
                  </label>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {['True', 'False'].map((val) => (
                      <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input
                          type="radio"
                          name="trueFalseVal"
                          checked={trueFalseAnswer === val}
                          onChange={() => setTrueFalseAnswer(val)}
                        />
                        {val}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Dynamic Inputs for CONSTRUCTED_RESPONSE (Blanks & Acceptable Synonyms) */}
              {manualType === 'CONSTRUCTED_RESPONSE' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    Acceptable Answers for Each Blank (one blank per line) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Blank 1: water, moisture, H2O&#10;Blank 2: carbon dioxide, CO2"
                    value={constructedBlanks}
                    onChange={(e) => setConstructedBlanks(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    First word on each line is the <strong>primary answer</strong>; comma-separated words are <strong>acceptable synonyms/alternatives</strong>.
                  </div>
                </div>
              )}

              {/* 5. Dynamic Inputs for DROPDOWN */}
              {manualType === 'DROPDOWN' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Dropdown Blank Options (one blank per line) *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Blank 1: light, thermal, sound, electrical&#10;Blank 2: chemical, kinetic, nuclear, potential"
                      value={dropdownBlanks}
                      onChange={(e) => setDropdownBlanks(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Format: <code>Blank 1: choice 1, choice 2, choice 3, choice 4</code>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Correct Choice for Each Blank *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Blank 1: light&#10;Blank 2: chemical"
                      value={dropdownAnswers}
                      onChange={(e) => setDropdownAnswers(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* 6. Dynamic Inputs for MATCHING_LINES */}
              {manualType === 'MATCHING_LINES' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    {'Matching Pairs (one pair per line, e.g. "Left Item -> Right Match") *'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={matchingPairs}
                    onChange={(e) => setMatchingPairs(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Separate left and right matching items with <code>{'->'}</code>.
                  </div>
                </div>
              )}

              {/* 7. Dynamic Inputs for ORDERING */}
              {manualType === 'ORDERING' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                    Items in Correct Target Sequence (one per line) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={orderingItems}
                    onChange={(e) => setOrderingItems(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    List items in the correct order. During generation, variants will scramble them for students to order.
                  </div>
                </div>
              )}

              {/* 8. Dynamic Inputs for GAP_MATCH */}
              {manualType === 'GAP_MATCH' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Option Bank (one per line) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={gapBank}
                      onChange={(e) => setGapBank(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Gap Mappings (e.g. "gap_1: Carbon dioxide") *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={gapAnswers}
                      onChange={(e) => setGapAnswers(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* 9. Dynamic Inputs for MULTIPLE_DROP_BUCKET */}
              {manualType === 'MULTIPLE_DROP_BUCKET' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Bucket Categories (one per line) *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Renewable Energy&#10;Non-Renewable Energy"
                      value={bucketCategories}
                      onChange={(e) => setBucketCategories(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      {'Items with Assigned Bucket (Item -> Bucket) *'}
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Solar power -> Renewable Energy&#10;Coal -> Non-Renewable Energy"
                      value={bucketItems}
                      onChange={(e) => setBucketItems(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* 10. Dynamic Inputs for MATRIX_INTERACTION */}
              {manualType === 'MATRIX_INTERACTION' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Evaluation Columns / Headers (comma-separated) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. True, False or Physical Change, Chemical Change"
                      value={matrixColumns}
                      onChange={(e) => setMatrixColumns(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                        Rows / Statements (one per line) *
                      </label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Statement 1&#10;Statement 2&#10;Statement 3"
                        value={matrixRows}
                        onChange={(e) => setMatrixRows(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                        Row Answers (e.g. Statement: Column) *
                      </label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Statement 1: True&#10;Statement 2: False"
                        value={matrixAnswers}
                        onChange={(e) => setMatrixAnswers(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 11. Dynamic Inputs for SELECT_TEXT */}
              {manualType === 'SELECT_TEXT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Selectable Text Phrases / Sentences (one per line) *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={selectTextTargets}
                      onChange={(e) => setSelectTextTargets(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                      Correct Target Sentence / Phrase *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={selectTextAnswer}
                      onChange={(e) => setSelectTextAnswer(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}

              {/* Explanation (Common for all types) */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 5 }}>
                  Explanation / Rationale (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional rationale or solution explanation..."
                  value={manualExplanation}
                  onChange={(e) => setManualExplanation(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-primary, #4f6ef7)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(79, 110, 247, 0.3)',
                  }}
                >
                  Use Reference Item
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
