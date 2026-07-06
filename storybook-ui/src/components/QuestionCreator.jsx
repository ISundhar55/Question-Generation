import { useState } from 'react';
import './styles.css';

const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Multiple Choice (Single Select)', badge: 'qc-badge-mcq' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Choice (Multiple Select)', badge: 'qc-badge-mcq' },
  { value: 'TRUE_FALSE', label: 'True / False', badge: 'qc-badge-tf' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', badge: 'qc-badge-cr' },
  { value: 'DROPDOWN', label: 'Dropdown', badge: 'qc-badge-dd' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', badge: 'qc-badge-ml' },
];

const DEFAULT_MCQ_OPTIONS = ['', '', '', ''];

export function QuestionCreator({ onSave, onClose, onPreview, initialData = null }) {
  const [type, setType] = useState(() => {
    const rawType = initialData?.type || '';
    if (rawType === 'MCQ') return 'SINGLE_SELECT'; // Map MCQ to SINGLE_SELECT in editor
    return rawType;
  });
  const [text, setText] = useState(initialData?.text || '');
  const [options, setOptions] = useState(() => {
    if (!initialData?.options) return DEFAULT_MCQ_OPTIONS;
    if (Array.isArray(initialData.options)) return initialData.options;
    if (typeof initialData.options === 'object') {
      // It's a dictionary (e.g. {"A": "option A text", ...})
      return Object.values(initialData.options);
    }
    return DEFAULT_MCQ_OPTIONS;
  });
  const [answer, setAnswer] = useState(() => {
    const rawAns = initialData?.answer || '';
    if (!initialData?.options || Array.isArray(initialData.options)) {
      return rawAns;
    }
    if (typeof initialData.options === 'object') {
      // Map letter-based answers (e.g. 'A|C') to actual option text values
      const opts = initialData.options;
      const letters = rawAns.split('|').map(s => s.trim());
      const mapped = letters.map(l => opts[l]).filter(Boolean);
      return mapped.join('|');
    }
    return rawAns;
  });
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'medium');
  const [points, setPoints] = useState(initialData?.points || 1);
  const [tfAnswers, setTfAnswers] = useState(initialData?.answer || '');
  // CONSTRUCTED_RESPONSE — one entry per blank: { correct: '', acceptable: '' }
  const [crBlanks, setCrBlanks] = useState(() => {
    if (!initialData?.options?.answers) return [{ correct: '', acceptable: '' }, { correct: '', acceptable: '' }];
    return initialData.options.answers.map(ans => {
      if (Array.isArray(ans)) {
        return { correct: ans[0] || '', acceptable: ans.slice(1).join(', ') };
      }
      return { correct: ans || '', acceptable: '' };
    });
  });
  // DROPDOWN — one entry per blank: { choices: '', correct: '' }
  const [ddBlanks, setDdBlanks] = useState(
    initialData?.options?.blanks
      ? initialData.options.blanks.map(b => ({ choices: b.choices.join(', '), correct: b.correct }))
      : [{ choices: '', correct: '' }, { choices: '', correct: '' }]
  );
  // MATCHING_LINES state — left keys A-D, right keys 1-4
  const [matchLeft, setMatchLeft] = useState(
    initialData?.options?.left || { A: '', B: '', C: '', D: '' }
  );
  const [matchRight, setMatchRight] = useState(
    initialData?.options?.right || { '1': '', '2': '', '3': '', '4': '' }
  );
  const [matchAnswer, setMatchAnswer] = useState(initialData?.answer || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Derived: count blanks in text for DROPDOWN / CONSTRUCTED_RESPONSE
  const blankCount = (text.match(/___/g) || []).length;
  const effectiveDdBlanks = Array.from({ length: Math.max(blankCount, 1) }, (_, i) => ddBlanks[i] || { choices: '', correct: '' });
  const effectiveCrBlanks = Array.from({ length: Math.max(blankCount, 1) }, (_, i) => crBlanks[i] || { correct: '', acceptable: '' });

  const updateDdBlank = (i, field, val) => {
    setDdBlanks(prev => {
      const next = [...prev];
      while (next.length <= i) next.push({ choices: '', correct: '' });
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  const updateCrBlank = (i, field, val) => {
    setCrBlanks(prev => {
      const next = [...prev];
      while (next.length <= i) next.push({ correct: '', acceptable: '' });
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!type) e.type = 'Please select a question type';
    if (!text.trim()) e.text = 'Question text is required';
    if (type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT' || type === 'MCQ') {
      const filled = options.filter(o => o.trim());
      if (filled.length < 2) e.options = 'At least 2 options are required';
      if (!answer) e.answer = 'Please select the correct answer';
    }
    if (type === 'TRUE_FALSE' && !tfAnswers) e.answer = 'Please select True or False';
    if (type === 'SHORT_ANSWER' && !answer.trim()) e.answer = 'Correct answer is required';
    if (type === 'CONSTRUCTED_RESPONSE') {
      if (blankCount === 0) e.text = 'Question text must contain at least one ___ blank';
      const missing = effectiveCrBlanks.some(b => !b.correct.trim());
      if (missing) e.answer = 'Please fill in the correct answer for every blank';
    }
    if (type === 'DROPDOWN') {
      if (blankCount === 0) e.text = 'Question text must contain at least one ___ blank';
      const missing = effectiveDdBlanks.some(b => !b.choices.trim() || !b.correct.trim());
      if (missing) e.answer = 'Please fill in choices and the correct answer for every blank';
    }
    if (type === 'MATCHING_LINES') {
      const leftFilled = Object.values(matchLeft).filter(v => v.trim()).length;
      const rightFilled = Object.values(matchRight).filter(v => v.trim()).length;
      if (leftFilled < 2) e.matchLeft = 'Please fill in at least 2 left-column items';
      if (rightFilled < 2) e.matchRight = 'Please fill in at least 2 right-column items';
      if (!matchAnswer.trim()) e.answer = 'Please enter the correct matches (e.g. A-1, B-2, C-3, D-4)';
    }
    return e;
  };

  const buildPayload = () => {
    if (type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT' || type === 'MCQ') {
      return { type, text, options: options.filter(o => o.trim()), answer, difficulty, points };
    }
    if (type === 'TRUE_FALSE') {
      return { type, text, options: null, answer: tfAnswers, difficulty, points };
    }
    if (type === 'SHORT_ANSWER') {
      return { type, text, options: null, answer, difficulty, points };
    }
    if (type === 'CONSTRUCTED_RESPONSE') {
      const answers = effectiveCrBlanks.map(b => {
        const correct = b.correct.trim();
        const alts = b.acceptable.split(',').map(a => a.trim()).filter(Boolean);
        return [correct, ...alts].filter(Boolean);
      });
      const primaryAnswers = answers.map(b => b[0] || '');
      return {
        type,
        text,
        options: { answers },
        answer: primaryAnswers.join('|'),
        difficulty,
        points
      };
    }
    if (type === 'DROPDOWN') {
      const blanks = effectiveDdBlanks.map(b => ({
        choices: b.choices.split(',').map(c => c.trim()).filter(Boolean),
        correct: b.correct.trim(),
      }));
      const answer = blanks.map(b => b.correct).join('|');
      return { type, text, options: { blanks }, answer, difficulty, points };
    }
    if (type === 'MATCHING_LINES') {
      const left = Object.fromEntries(Object.entries(matchLeft).filter(([, v]) => v.trim()));
      const right = Object.fromEntries(Object.entries(matchRight).filter(([, v]) => v.trim()));
      return { type, text, options: { left, right }, answer: matchAnswer.trim(), difficulty, points };
    }
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave(buildPayload());
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onPreview && onPreview(buildPayload());
  };

  const updateOption = (i, val) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  };

  const err = (field) => errors[field] && (
    <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4, display: 'block' }}>
      {errors[field]}
    </span>
  );

  return (
    <div className="qc-card" style={{ width: '100%', maxWidth: '100%', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            {initialData ? 'Edit Question' : 'New Question'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Fill in the details below
          </p>
        </div>
        {onClose && (
          <button className="qc-btn qc-btn-ghost" onClick={onClose} style={{ padding: '6px 14px' }}>
            ✕ Close
          </button>
        )}
      </div>

      {/* Question Type Dropdown */}
      <div className="qc-field">
        <label className="qc-label">Question Type</label>
        <select
          className="qc-input qc-select"
          value={type}
          onChange={(e) => { setType(e.target.value); setErrors({}); setAnswer(''); }}
        >
          <option value="">— Select a type —</option>
          {QUESTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {err('type')}
      </div>

      {/* Question Text */}
      {type && (
        <div className="qc-field">
          <label className="qc-label">
            {type === 'FILL_IN_BLANK'
              ? 'Question Text (use ___ for each blank)'
              : 'Question Text'}
          </label>
          <textarea
            className="qc-input qc-textarea"
            placeholder={
              type === 'FILL_IN_BLANK'
                ? 'e.g. The capital of France is ___ and it is known for the ___ Tower.'
                : 'Enter your question here...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {err('text')}
        </div>
      )}

      {/* MCQ / Choice Options */}
      {(type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT' || type === 'MCQ') && (() => {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        const isCorrect = (opt) => {
          if (!opt || !opt.trim()) return false;
          if (type === 'MULTIPLE_SELECT') {
            return answer.split('|').map(s => s.trim()).includes(opt.trim());
          }
          return answer.trim() === opt.trim();
        };
        const toggleCorrect = (opt) => {
          if (!opt || !opt.trim()) return;
          if (type === 'MULTIPLE_SELECT') {
            const selected = answer ? answer.split('|').map(s => s.trim()) : [];
            if (selected.includes(opt.trim())) {
              setAnswer(selected.filter(x => x !== opt.trim()).join('|'));
            } else {
              setAnswer([...selected, opt.trim()].join('|'));
            }
          } else {
            setAnswer(opt.trim());
          }
        };
        return (
          <div className="qc-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label className="qc-label" style={{ marginBottom: 0 }}>Answer Options</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {options.length < 6 && (
                  <button
                    className="qc-btn qc-btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => setOptions(prev => [...prev, ''])}
                  >
                    + Add Option
                  </button>
                )}
                {options.length > 2 && (
                  <button
                    className="qc-btn qc-btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-danger)' }}
                    onClick={() => {
                      setOptions(prev => {
                        const next = prev.slice(0, -1);
                        // If deleted option was selected, clear it from answer
                        const deletedVal = prev[prev.length - 1];
                        if (deletedVal && deletedVal.trim()) {
                          if (type === 'MULTIPLE_SELECT') {
                            const selected = answer ? answer.split('|') : [];
                            setAnswer(selected.filter(x => x !== deletedVal.trim()).join('|'));
                          } else if (answer === deletedVal.trim()) {
                            setAnswer('');
                          }
                        }
                        return next;
                      });
                    }}
                  >
                    - Remove Option
                  </button>
                )}
              </div>
            </div>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: type === 'MULTIPLE_SELECT' ? '4px' : '50%',
                  background: isCorrect(opt) ? 'var(--color-primary)' : 'var(--color-bg)',
                  border: '1.5px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: isCorrect(opt) ? '#fff' : 'var(--color-text-muted)',
                  flexShrink: 0,
                  cursor: opt.trim() ? 'pointer' : 'default',
                }}
                  onClick={() => toggleCorrect(opt)}
                  title={type === 'MULTIPLE_SELECT' ? 'Click to toggle correct answer' : 'Click to set as correct answer'}
                >
                  {letters[i] || i + 1}
                </div>
                <input
                  className="qc-input"
                  placeholder={`Option ${letters[i] || i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {type === 'MULTIPLE_SELECT'
                ? 'Click option letters to toggle all correct answers (multiple select)'
                : 'Click option letter to mark the single correct answer'}
            </p>
            {answer && <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4 }}>✓ Correct answer(s): {answer.split('|').join(', ')}</p>}
            {err('options')}
            {err('answer')}
          </div>
        );
      })()}

      {/* True / False */}
      {type === 'TRUE_FALSE' && (
        <div className="qc-field">
          <label className="qc-label">Correct Answer</label>
          <div className="qc-tf-buttons">
            <button
              className={`qc-tf-btn${tfAnswers === 'true' ? ' selected-true' : ''}`}
              onClick={() => setTfAnswers('true')}
            >✓ True</button>
            <button
              className={`qc-tf-btn${tfAnswers === 'false' ? ' selected-false' : ''}`}
              onClick={() => setTfAnswers('false')}
            >✗ False</button>
          </div>
          {err('answer')}
        </div>
      )}

      {/* Short Answer */}
      {type === 'SHORT_ANSWER' && (
        <div className="qc-field">
          <label className="qc-label">Model Answer</label>
          <textarea
            className="qc-input qc-textarea"
            placeholder="Enter the expected correct answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          {err('answer')}
        </div>
      )}

      {/* Fill in the Blank answers — CONSTRUCTED_RESPONSE */}
      {type === 'CONSTRUCTED_RESPONSE' && (
        <div className="qc-field">
          <label className="qc-label">Blank Responses</label>
          {blankCount === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>
              Add at least one ___ blank to your question text above.
            </p>
          )}
          {effectiveCrBlanks.map((blank, i) => (
            <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: '#fafbfc' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>Blank {i + 1}</div>
              
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Correct Answer</label>
                <input
                  className="qc-input"
                  placeholder="e.g. Paris"
                  style={{ marginBottom: 0 }}
                  value={blank.correct}
                  onChange={(e) => updateCrBlank(i, 'correct', e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Acceptable Alternatives (comma-separated)</label>
                <input
                  className="qc-input"
                  placeholder="e.g. capital of France, city of light"
                  style={{ marginBottom: 0 }}
                  value={blank.acceptable}
                  onChange={(e) => updateCrBlank(i, 'acceptable', e.target.value)}
                />
              </div>
            </div>
          ))}
          {err('answer')}
        </div>
      )}

      {/* DROPDOWN — per-blank choices + correct answer */}
      {type === 'DROPDOWN' && (
        <div className="qc-field">
          <label className="qc-label">Blank Options</label>
          {blankCount === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>
              Add at least one ___ blank to your question text above.
            </p>
          )}
          {effectiveDdBlanks.map((blank, i) => (
            <div key={i} style={{ border: '1.5px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: '#fafbfc' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>Blank {i + 1}</div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Choices (comma-separated)</label>
                <input
                  className="qc-input"
                  placeholder="e.g. mitochondria, nucleus, ribosome, vacuole"
                  style={{ marginBottom: 0 }}
                  value={blank.choices}
                  onChange={e => updateDdBlank(i, 'choices', e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Correct Answer (must match one choice exactly)</label>
                <input
                  className="qc-input"
                  placeholder="e.g. mitochondria"
                  style={{ marginBottom: 0 }}
                  value={blank.correct}
                  onChange={e => updateDdBlank(i, 'correct', e.target.value)}
                />
              </div>
            </div>
          ))}
          {err('answer')}
        </div>
      )}

      {/* Matching Lines */}
      {type === 'MATCHING_LINES' && (
        <>
          {/* Stem label override */}
          <div className="qc-field">
            <label className="qc-label">Stem / Instruction</label>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              The instruction shown above the two columns, e.g. &ldquo;Match each item in Column A with Column B&rdquo;
            </p>
          </div>

          {/* Two-column inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
            {/* Left column */}
            <div className="qc-field" style={{ marginBottom: 0 }}>
              <label className="qc-label" style={{ color: '#0891b2' }}>Column A (Left Items)</label>
              {['A', 'B', 'C', 'D'].map(key => (
                <input
                  key={key}
                  className="qc-input"
                  placeholder={`A${key === 'A' ? ' — e.g. Numerator' : key === 'B' ? ' — e.g. Denominator' : ''}`}
                  style={{ marginBottom: 6 }}
                  value={matchLeft[key]}
                  onChange={e => setMatchLeft(prev => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
              {err('matchLeft')}
            </div>

            {/* Right column */}
            <div className="qc-field" style={{ marginBottom: 0 }}>
              <label className="qc-label" style={{ color: '#6b7280' }}>Column B (Right Items)</label>
              {['1', '2', '3', '4'].map(key => (
                <input
                  key={key}
                  className="qc-input"
                  placeholder={`${key} — e.g. Top number`}
                  style={{ marginBottom: 6 }}
                  value={matchRight[key]}
                  onChange={e => setMatchRight(prev => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
              {err('matchRight')}
            </div>
          </div>

          {/* Answer key */}
          <div className="qc-field">
            <label className="qc-label">Correct Matches</label>
            <input
              className="qc-input"
              placeholder="e.g. A-1, B-3, C-2, D-4"
              value={matchAnswer}
              onChange={e => setMatchAnswer(e.target.value)}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Format: Left letter – Right number, comma-separated (e.g. A-2, B-1, C-4, D-3)
            </p>
            {err('answer')}
          </div>
        </>
      )}

      {/* Meta: Difficulty + Points */}
      {type && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="qc-field" style={{ flex: 1, marginBottom: 0 }}>
            <label className="qc-label">Difficulty</label>
            <select className="qc-input qc-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="qc-field" style={{ flex: 1, marginBottom: 0 }}>
            <label className="qc-label">Points</label>
            <input
              className="qc-input"
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {type && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
          {onClose && (
            <button className="qc-btn qc-btn-ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          {onPreview && (
            <button className="qc-btn qc-btn-ghost" onClick={handlePreview}>
              👁 Preview
            </button>
          )}
          <button className="qc-btn qc-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Question'}
          </button>
        </div>
      )}
    </div>
  );
}

export default QuestionCreator;
