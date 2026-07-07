import { useState } from 'react';
import './styles.css';
import { McqEditor } from './McqEditor';
import { TrueFalseEditor } from './TrueFalseEditor';
import { ConstructedResponseEditor } from './ConstructedResponseEditor';
import { DropdownEditor } from './DropdownEditor';
import { MatchingLinesEditor } from './MatchingLinesEditor';
import { OrderingEditor } from './OrderingEditor';

const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Multiple Choice (Single Select)', badge: 'qc-badge-mcq' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Choice (Multiple Select)', badge: 'qc-badge-mcq' },
  { value: 'TRUE_FALSE', label: 'True / False', badge: 'qc-badge-tf' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', badge: 'qc-badge-cr' },
  { value: 'DROPDOWN', label: 'Dropdown', badge: 'qc-badge-dd' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', badge: 'qc-badge-ml' },
  { value: 'ORDERING', label: 'Ordering', badge: 'qc-badge-ord' },
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
  const [correctOrder, setCorrectOrder] = useState(() => {
    if (initialData?.type === 'ORDERING' && initialData?.answer) {
      return initialData.answer.split('|').map(s => s.trim());
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Derived: count blanks in text for DROPDOWN / CONSTRUCTED_RESPONSE
  const blankCount = (text.match(/___/g) || []).length;
  const effectiveDdBlanks = Array.from({ length: Math.max(blankCount, 1) }, (_, i) => ddBlanks[i] || { choices: '', correct: '' });
  const effectiveCrBlanks = Array.from({ length: Math.max(blankCount, 1) }, (_, i) => crBlanks[i] || { correct: '', acceptable: '' });

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
    if (type === 'ORDERING') {
      const filled = options.filter(o => o.trim());
      if (filled.length < 3) e.options = 'At least 3 options are required';
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
    if (type === 'ORDERING') {
      const validOptions = options.filter(o => o.trim());
      let finalOrder = correctOrder.filter(item => validOptions.includes(item));
      validOptions.forEach(opt => {
        if (!finalOrder.includes(opt)) {
          finalOrder.push(opt);
        }
      });
      return { type, text, options: validOptions, answer: finalOrder.join('|'), difficulty, points };
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
    const oldVal = options[i];
    const next = [...options];
    next[i] = val;
    setOptions(next);

    if (type === 'ORDERING') {
      setCorrectOrder(prev => {
        if (prev.length === 0) {
          return next.filter(o => o.trim());
        }
        return prev.map(item => item === oldVal ? val : item);
      });
    }
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
          <button className="qc-btn qc-btn-ghost" onClick={onClose} style={{ padding: '6px 10px' }}>
            X Close
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
      {(type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT' || type === 'MCQ') && (
        <McqEditor
          type={type}
          options={options}
          setOptions={setOptions}
          answer={answer}
          setAnswer={setAnswer}
          updateOption={updateOption}
          err={err}
        />
      )}

      {/* True / False */}
      {type === 'TRUE_FALSE' && (
        <TrueFalseEditor
          answer={tfAnswers}
          setAnswer={setTfAnswers}
          err={err}
        />
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
        <ConstructedResponseEditor
          text={text}
          crBlanks={crBlanks}
          setCrBlanks={setCrBlanks}
          err={err}
        />
      )}

      {/* DROPDOWN — per-blank choices + correct answer */}
      {type === 'DROPDOWN' && (
        <DropdownEditor
          text={text}
          ddBlanks={ddBlanks}
          setDdBlanks={setDdBlanks}
          err={err}
        />
      )}

      {/* Matching Lines */}
      {type === 'MATCHING_LINES' && (
        <MatchingLinesEditor
          matchLeft={matchLeft}
          setMatchLeft={setMatchLeft}
          matchRight={matchRight}
          setMatchRight={setMatchRight}
          matchAnswer={matchAnswer}
          setMatchAnswer={setMatchAnswer}
          err={err}
        />
      )}

      {/* Ordering */}
      {type === 'ORDERING' && (
        <OrderingEditor
          options={options}
          setOptions={setOptions}
          correctOrder={correctOrder}
          setCorrectOrder={setCorrectOrder}
          updateOption={updateOption}
          err={err}
        />
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
