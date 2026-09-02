import { useState } from 'react';
import './styles.css';
import { McqEditor } from './McqEditor';
import { TrueFalseEditor } from './TrueFalseEditor';
import { ConstructedResponseEditor } from './ConstructedResponseEditor';
import { DropdownEditor } from './DropdownEditor';
import { MatchingLinesEditor } from './MatchingLinesEditor';
import { OrderingEditor } from './OrderingEditor';
import { BackgroundGraphicEditor } from './BackgroundGraphicEditor';
import { GapMatchEditor } from './GapMatchEditor';
import { MultipleDropBucketEditor } from './MultipleDropBucketEditor';
import { MatrixInteractionEditor } from './MatrixInteractionEditor';
import { SelectTextEditor } from './SelectTextEditor';
import { DiagramViewer } from './DiagramViewer';

const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Multiple Choice (Single Select)', badge: 'qc-badge-mcq' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Choice (Multiple Select)', badge: 'qc-badge-mcq' },
  { value: 'TRUE_FALSE', label: 'True / False', badge: 'qc-badge-tf' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', badge: 'qc-badge-cr' },
  { value: 'DROPDOWN', label: 'Dropdown', badge: 'qc-badge-dd' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', badge: 'qc-badge-match' },
  { value: 'ORDERING', label: 'Ordering', badge: 'qc-badge-ord' },
  { value: 'GAP_MATCH', label: 'Gap Match', badge: 'qc-badge-gm' },
  { value: 'MULTIPLE_DROP_BUCKET', label: 'Multiple Drop Bucket', badge: 'qc-badge-mdb' },
  { value: 'MATRIX_INTERACTION', label: 'Matrix Interaction', badge: 'qc-badge-matrix' },
  { value: 'SELECT_TEXT', label: 'Select Text', badge: 'qc-badge-st' },
  // { value: 'BACKGROUND_GRAPHIC', label: 'Background Graphic', badge: 'qc-badge-bg' },
];

const DEFAULT_MCQ_OPTIONS = ['', '', '', ''];

export function QuestionCreator({
  initialData = {},
  onSave,
  onCancel,
  onClose,
  onPreview,
  hideHeader = false,
  hideTypeSelect = false,
}) {
  // Safe parsing of options if passed as serialized JSON strings or Python dict strings
  const parsedOptions = (() => {
    if (!initialData?.options) return {};
    if (typeof initialData.options === 'string') {
      const trimmed = initialData.options.trim();
      try {
        const p = JSON.parse(trimmed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) { }
      try {
        const fixed = trimmed.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
        const p = JSON.parse(fixed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) { }
      return {};
    }
    return typeof initialData.options === 'object' && initialData.options !== null ? initialData.options : {};
  })();

  const [visualSvg, setVisualSvg] = useState(() => {
    return initialData?.visual || parsedOptions?.visual || null;
  });

  const [type, setType] = useState(() => {
    const rawType = initialData?.type || '';
    if (rawType === 'MCQ') return 'SINGLE_SELECT'; // Map MCQ to SINGLE_SELECT in editor
    return rawType;
  });
  const [text, setText] = useState(initialData?.text || '');
  const [options, setOptions] = useState(() => {
    if (Array.isArray(parsedOptions?.items)) return parsedOptions.items;
    if (Array.isArray(parsedOptions)) return parsedOptions;
    if (Array.isArray(initialData?.options?.items)) return initialData.options.items;
    if (Array.isArray(initialData?.options)) return initialData.options;
    if (typeof parsedOptions === 'object' && parsedOptions !== null && Object.keys(parsedOptions).length > 0) {
      // Filter out non-option keys like rationales, left, right, blanks, visual
      const letterKeys = Object.keys(parsedOptions).filter(k => k.length <= 2 && k !== 'id');
      if (letterKeys.length > 0) {
        return letterKeys.map(k => parsedOptions[k]);
      }
    }
    return DEFAULT_MCQ_OPTIONS;
  });
  const [answer, setAnswer] = useState(() => {
    const rawAns = initialData?.answer || '';
    if (!parsedOptions || Array.isArray(parsedOptions)) {
      return rawAns;
    }
    if (typeof parsedOptions === 'object') {
      // Map letter-based answers (e.g. 'A|C') to actual option text values
      const opts = parsedOptions;
      const letters = typeof rawAns === 'string' ? rawAns.split('|').map(s => s.trim()) : [];
      const mapped = letters.map(l => opts[l]).filter(Boolean);
      return mapped.length > 0 ? mapped.join('|') : rawAns;
    }
    return rawAns;
  });
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'medium');
  const [points, setPoints] = useState(initialData?.points || 1);
  const [explanation, setExplanation] = useState(
    initialData?.explanation || initialData?.rationale || parsedOptions?.explanation || ''
  );
  // Per-option rationales for Multiple Choice / Single Select / Multi-Select
  const [optionRationales, setOptionRationales] = useState(() => {
    const optCount = Array.isArray(parsedOptions)
      ? parsedOptions.length
      : typeof parsedOptions === 'object' && parsedOptions !== null
        ? Object.keys(parsedOptions).filter(k => k.length <= 3 && k !== 'visual' && k !== 'rationales').length || 4
        : 4;

    if (Array.isArray(parsedOptions?.rationales) && parsedOptions.rationales.length > 0) {
      const res = parsedOptions.rationales.slice(0, optCount);
      while (res.length < optCount) res.push('');
      return res;
    }
    if (typeof parsedOptions?.rationales === 'object' && parsedOptions?.rationales !== null) {
      const res = [];
      for (let i = 0; i < optCount; i++) {
        const letter = String.fromCharCode(65 + i);
        res.push(parsedOptions.rationales[letter] || parsedOptions.rationales[String(i)] || parsedOptions.rationales[String(i + 1)] || '');
      }
      if (res.some(Boolean)) return res;
    }

    const exp = initialData?.explanation || initialData?.rationale || parsedOptions?.explanation || '';
    if (exp) {
      const result = [];
      for (let i = 0; i < optCount; i++) {
        const letter = String.fromCharCode(65 + i);
        const num = String(i + 1);

        // 1. Match letter formats: • Option A: ..., • Option A (Incorrect): ..., • Choice A: ..., • A: ..., • (A): ...
        const regexLetter = new RegExp(`•\\s*(?:Option\\s*|Choice\\s*)?\\(?${letter}\\)?(?:\\s*\\([^)]*\\))?[:\\-–—]\\s*(.*?)(?=(?:\\n•|$))`, 'is');
        const mLetter = exp.match(regexLetter);
        if (mLetter) {
          result.push(mLetter[1].trim());
          continue;
        }

        // 2. Match numeric formats: • Option 1: ..., • 1: ...
        const regexNum = new RegExp(`•\\s*(?:Option\\s*|Choice\\s*)?\\(?${num}\\)?(?:\\s*\\([^)]*\\))?[:\\-–—]\\s*(.*?)(?=(?:\\n•|$))`, 'is');
        const mNum = exp.match(regexNum);
        if (mNum) {
          result.push(mNum[1].trim());
          continue;
        }

        result.push('');
      }

      // 3. Sequential bullet fallback if specific keys were not found
      if (!result.some(Boolean)) {
        const bullets = exp.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
        for (let i = 0; i < optCount; i++) {
          if (bullets[i]) {
            const colonIdx = bullets[i].indexOf(':');
            result[i] = colonIdx !== -1 ? bullets[i].slice(colonIdx + 1).trim() : bullets[i];
          }
        }
      }

      if (result.some(Boolean)) {
        while (result.length < optCount) result.push('');
        return result;
      }
    }

    return Array.from({ length: optCount }, () => '');
  });

  const updateOptionRationale = (i, val) => {
    setOptionRationales(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };
  const [tfAnswers, setTfAnswers] = useState(() => {
    const raw = initialData?.answer;
    if (raw === true || raw === 'true') return 'true';
    if (raw === false || raw === 'false') return 'false';
    if (typeof raw === 'string') {
      const lower = raw.trim().toLowerCase();
      if (lower === 'true' || lower === 't') return 'true';
      if (lower === 'false' || lower === 'f') return 'false';
      if (lower === 'a') {
        const optA = parsedOptions?.A || (Array.isArray(parsedOptions) ? parsedOptions[0] : null);
        if (typeof optA === 'string' && optA.toLowerCase().includes('false')) return 'false';
        return 'true';
      }
      if (lower === 'b') {
        const optB = parsedOptions?.B || (Array.isArray(parsedOptions) ? parsedOptions[1] : null);
        if (typeof optB === 'string' && optB.toLowerCase().includes('true')) return 'true';
        return 'false';
      }
    }
    return '';
  });
  // True/False rationales
  const [tfRationales, setTfRationales] = useState(() => {
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      return {
        true: parsedOptions.rationales.true || parsedOptions.rationales['True'] || '',
        false: parsedOptions.rationales.false || parsedOptions.rationales['False'] || '',
      };
    }
    const exp = initialData?.explanation || initialData?.rationale || parsedOptions?.explanation || '';
    const res = { true: '', false: '' };
    if (exp) {
      const mTrue = exp.match(/•\s*(?:Option\\s*)?True(?:\s*\([^)]*\))?[:\-–—]\s*(.*?)(?=(?:\n•|$))/is);
      if (mTrue) res.true = mTrue[1].trim();
      const mFalse = exp.match(/•\s*(?:Option\\s*)?False(?:\s*\([^)]*\))?[:\-–—]\s*(.*?)(?=(?:\n•|$))/is);
      if (mFalse) res.false = mFalse[1].trim();

      // Sequential fallback if not matched by label
      if (!res.true && !res.false) {
        const bullets = exp.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
        if (bullets[0]) {
          const colonIdx = bullets[0].indexOf(':');
          res.true = colonIdx !== -1 ? bullets[0].slice(colonIdx + 1).trim() : bullets[0];
        }
        if (bullets[1]) {
          const colonIdx = bullets[1].indexOf(':');
          res.false = colonIdx !== -1 ? bullets[1].slice(colonIdx + 1).trim() : bullets[1];
        }
      }
    }
    return res;
  });

  // CONSTRUCTED_RESPONSE — one entry per blank: { correct: '', acceptable: '', rationale: '' }
  const [crBlanks, setCrBlanks] = useState(() => {
    const answersList = parsedOptions?.answers || (Array.isArray(initialData?.options?.answers) ? initialData.options.answers : null);
    if (!answersList) return [{ correct: '', acceptable: '', rationale: '' }, { correct: '', acceptable: '', rationale: '' }];
    return answersList.map((ans, idx) => {
      let r = '';
      const exp = initialData?.explanation || initialData?.rationale || '';
      if (exp) {
        const m = exp.match(new RegExp(`•\\s*Blank\\s*${idx + 1}[^:]*:\\s*(.*?)(?=(?:\\n•|$))`, 'is'));
        if (m) r = m[1].trim();
      }
      if (Array.isArray(ans)) {
        return { correct: ans[0] || '', acceptable: ans.slice(1).join(', '), rationale: r };
      }
      return { correct: ans || '', acceptable: '', rationale: r };
    });
  });

  // DROPDOWN — one entry per blank: { choices: '', correct: '', rationale: '' }
  const [ddBlanks, setDdBlanks] = useState(() => {
    const blanksList = parsedOptions?.blanks || (Array.isArray(initialData?.options?.blanks) ? initialData.options.blanks : null);
    if (!blanksList) return [{ choices: '', correct: '', rationale: '' }, { choices: '', correct: '', rationale: '' }];
    return blanksList.map((b, idx) => {
      let r = b.rationale || '';
      if (!r) {
        const exp = initialData?.explanation || initialData?.rationale || '';
        if (exp) {
          const m = exp.match(new RegExp(`•\\s*Blank\\s*${idx + 1}[^:]*:\\s*(.*?)(?=(?:\\n•|$))`, 'is'));
          if (m) r = m[1].trim();
        }
      }
      return {
        choices: Array.isArray(b.choices) ? b.choices.join(', ') : (b.choices || ''),
        correct: b.correct || '',
        rationale: r,
      };
    });
  });

  // MATCHING_LINES state — left keys A-D, right keys 1-4, rationales
  const [matchLeft, setMatchLeft] = useState(() => {
    return parsedOptions?.left || { A: '', B: '', C: '', D: '' };
  });
  const [matchRight, setMatchRight] = useState(() => {
    return parsedOptions?.right || { '1': '', '2': '', '3': '', '4': '' };
  });
  const [matchRationales, setMatchRationales] = useState(() => {
    const res = {};
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      Object.entries(parsedOptions.rationales).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) res[k] = v.trim();
      });
    }
    const exp = initialData?.explanation || initialData?.rationale || '';
    if (exp) {
      const rightKeys = parsedOptions?.right ? Object.keys(parsedOptions.right) : ['1', '2', '3', '4'];
      rightKeys.forEach(numKey => {
        if (!res[numKey]) {
          const regex = new RegExp(`•\\s*Match\\s*(?:[A-Z]\\s*[-–—>→:]\\s*)?${numKey}[^:]*:\\s*(.*?)(?=(?:\\n•|$))`, 'is');
          const m = exp.match(regex);
          if (m) res[numKey] = m[1].trim();
        }
      });
    }
    return res;
  });
  const [matchAnswer, setMatchAnswer] = useState(initialData?.answer || '');

  // ORDERING rationales
  const [orderRationales, setOrderRationales] = useState(() => {
    const res = {};
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      Object.assign(res, parsedOptions.rationales);
    }
    const exp = initialData?.explanation || initialData?.rationale || '';
    if (exp) {
      const bullets = exp.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
      bullets.forEach((bullet, idx) => {
        const colonIdx = bullet.indexOf(':');
        const content = colonIdx !== -1 ? bullet.slice(colonIdx + 1).trim() : bullet;
        res[String(idx + 1)] = content;
      });
    }
    return res;
  });
  const [correctOrder, setCorrectOrder] = useState(() => {
    if (initialData?.type === 'ORDERING' && initialData?.answer) {
      return initialData.answer.split('|').map(s => s.trim());
    }
    return [];
  });

  // GAP_MATCH rationales
  const [gmRationales, setGmRationales] = useState(() => {
    const res = {};
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      Object.assign(res, parsedOptions.rationales);
    }
    const exp = initialData?.explanation || initialData?.rationale || '';
    if (exp) {
      const bullets = exp.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
      bullets.forEach((bullet, idx) => {
        const colonIdx = bullet.indexOf(':');
        const content = colonIdx !== -1 ? bullet.slice(colonIdx + 1).trim() : bullet;
        res[`gap_${idx + 1}`] = content;
      });
    }
    return res;
  });

  // MATRIX rationales
  const [matrixRationales, setMatrixRationales] = useState(() => {
    const res = {};
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      Object.assign(res, parsedOptions.rationales);
    }
    const exp = initialData?.explanation || initialData?.rationale || '';
    if (exp) {
      const bullets = exp.split(/\n\s*•\s*/).map(b => b.replace(/^•\s*/, '').trim()).filter(Boolean);
      bullets.forEach((bullet, idx) => {
        const colonIdx = bullet.indexOf(':');
        const content = colonIdx !== -1 ? bullet.slice(colonIdx + 1).trim() : bullet;
        res[`row_${idx + 1}`] = content;
      });
    }
    return res;
  });

  // MULTIPLE_DROP_BUCKET rationales
  const [mdbRationales, setMdbRationales] = useState(() => {
    const res = {};
    if (parsedOptions?.rationales && typeof parsedOptions.rationales === 'object') {
      Object.assign(res, parsedOptions.rationales);
    }
    const exp = initialData?.explanation || initialData?.rationale || '';
    if (exp) {
      const dropBucketsList = parsedOptions?.drop_buckets || (Array.isArray(initialData?.options?.drop_buckets) ? initialData.options.drop_buckets : []);
      dropBucketsList.forEach(b => {
        const bName = b.name || b.id;
        if (!bName) return;
        const regex = new RegExp(`•\\s*(?:Category\\s*)?${bName}[^:]*:\\s*(.*?)(?=(?:\\n•|$))`, 'is');
        const m = exp.match(regex);
        if (m) {
          res[bName] = m[1].trim();
          if (b.id) res[b.id] = m[1].trim();
        }
      });
    }
    return res;
  });

  const parsedAnswerObj = (() => {
    if (!initialData?.answer) return {};
    if (typeof initialData.answer === 'object' && initialData.answer !== null && !Array.isArray(initialData.answer)) {
      return initialData.answer;
    }
    if (typeof initialData.answer === 'string') {
      const trimmed = initialData.answer.trim();
      if (!trimmed) return {};

      // 1. Direct JSON parse
      try {
        const p = JSON.parse(trimmed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) { }

      // 2. Python-style dict string without corrupting contractions
      try {
        const fixed = trimmed
          .replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null')
          .replace(/(^|[{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
          .replace(/:\s*'([^']+?)'/g, ': "$1"')
          .replace(/\[\s*'([^']+?)'/g, '["$1"')
          .replace(/,\s*'([^']+?)'/g, ', "$1"');
        const p = JSON.parse(fixed);
        if (typeof p === 'object' && p !== null) return p;
      } catch (_) { }

      // 3. Fallback regex match for bucket arrays
      try {
        const res = {};
        const regex = /['"]?([a-zA-Z0-9_\s-]+)['"]?\s*:\s*\[([\s\S]*?)\]/g;
        let match;
        while ((match = regex.exec(trimmed)) !== null) {
          const key = match[1].trim();
          const itemsRaw = match[2];
          const items = [];
          const itemRegex = /['"](.*?)['"](?=\s*,|\s*\]|\s*$)/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(itemsRaw)) !== null) {
            items.push(itemMatch[1].trim());
          }
          if (items.length > 0) res[key] = items;
        }
        if (Object.keys(res).length > 0) return res;
      } catch (_) { }
    }
    return {};
  })();

  // BACKGROUND_GRAPHIC state
  const [svgGraphic, setSvgGraphic] = useState(parsedOptions.svg_graphic || '');
  const [dropZoneWidth, setDropZoneWidth] = useState(parsedOptions.drop_zone_width || 120);
  const [dropZoneHeight, setDropZoneHeight] = useState(parsedOptions.drop_zone_height || 36);
  const [dropZones, setDropZones] = useState(() => {
    if (parsedOptions.drop_zones && Array.isArray(parsedOptions.drop_zones) && parsedOptions.drop_zones.length > 0) {
      return parsedOptions.drop_zones;
    }
    return [
      { id: 'zone_1', pin_label: 'A', x_percent: 30, y_percent: 35, description: 'Structure A' },
      { id: 'zone_2', pin_label: 'B', x_percent: 60, y_percent: 50, description: 'Structure B' },
    ];
  });
  const [labelBank, setLabelBank] = useState(() => {
    const rawBank = parsedOptions.label_bank;
    if (Array.isArray(rawBank) && rawBank.length > 0) {
      return rawBank;
    }
    // Fallback: extract any existing answer labels
    const extracted = Object.values(parsedAnswerObj).filter(Boolean);
    return extracted.length > 0 ? extracted : [];
  });
  const [bgAnswers, setBgAnswers] = useState(parsedAnswerObj);

  // GAP_MATCH state
  const [passage, setPassage] = useState(parsedOptions.passage || '');
  const [gaps, setGaps] = useState(() => {
    if (parsedOptions.gaps && Array.isArray(parsedOptions.gaps) && parsedOptions.gaps.length > 0) {
      return parsedOptions.gaps;
    }
    return [];
  });
  const [responseOptions, setResponseOptions] = useState(() => {
    const rawOpts = parsedOptions.response_options || parsedOptions.label_bank;
    if (Array.isArray(rawOpts) && rawOpts.length > 0) {
      return rawOpts;
    }
    const extracted = Object.values(parsedAnswerObj).filter(Boolean);
    return extracted.length > 0 ? extracted : [];
  });
  const [gmAnswers, setGmAnswers] = useState(parsedAnswerObj);

  // MULTIPLE_DROP_BUCKET state
  const [optionBuckets, setOptionBuckets] = useState(() => {
    if (parsedOptions.option_buckets && Array.isArray(parsedOptions.option_buckets) && parsedOptions.option_buckets.length > 0) {
      return parsedOptions.option_buckets;
    }
    return [
      { id: 'opt_bucket_1', title: '', options: [''] },
    ];
  });
  const [dropBuckets, setDropBuckets] = useState(() => {
    if (parsedOptions.drop_buckets && Array.isArray(parsedOptions.drop_buckets) && parsedOptions.drop_buckets.length > 0) {
      return parsedOptions.drop_buckets;
    }
    return [
      { id: 'drop_bucket_1', name: '' },
    ];
  });
  const [mdbAnswers, setMdbAnswers] = useState(parsedAnswerObj);

  // MATRIX_INTERACTION state
  const [matrixHeader, setMatrixHeader] = useState(parsedOptions.header || '');
  const [matrixColumns, setMatrixColumns] = useState(() => {
    if (parsedOptions.columns && Array.isArray(parsedOptions.columns) && parsedOptions.columns.length > 0) {
      return parsedOptions.columns.map((c, i) => (typeof c === 'object' ? c : { id: `col_${i + 1}`, value: String(c) }));
    }
    return [
      { id: 'col_1', value: '' },
    ];
  });
  const [matrixRows, setMatrixRows] = useState(() => {
    if (parsedOptions.rows && Array.isArray(parsedOptions.rows) && parsedOptions.rows.length > 0) {
      return parsedOptions.rows.map((r, i) => (typeof r === 'object' ? r : { id: `row_${i + 1}`, value: String(r) }));
    }
    return [
      { id: 'row_1', value: '' },
    ];
  });
  const [matrixAnswers, setMatrixAnswers] = useState(parsedAnswerObj);

  // SELECT_TEXT state
  const [stSelectionType, setStSelectionType] = useState(parsedOptions.selection_type || 'Sentence');
  const [stMaxSelections, setStMaxSelections] = useState(parsedOptions.max_selections || 1);
  const [stPassage, setStPassage] = useState(parsedOptions.passage || '');
  const [stAnswers, setStAnswers] = useState(() => {
    const raw = initialData?.answer;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) return p;
      } catch (_) { }
      return raw ? [raw] : [];
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
    if (type === 'BACKGROUND_GRAPHIC') {
      if (!svgGraphic.trim()) e.svgGraphic = 'SVG graphic code is required';
      if (dropZones.length < 1) e.dropZones = 'At least one drop zone is required';
      if (labelBank.length < dropZones.length) e.labelBank = 'Label bank must contain at least as many labels as drop zones';
      const missingAns = dropZones.some(z => !bgAnswers[z.id] && !bgAnswers[z.pin_label]);
      if (missingAns) e.answer = 'Please assign a correct label for each drop zone';
    }
    if (type === 'GAP_MATCH') {
      if (!passage.trim()) e.passage = 'Passage text is required';
      if (gaps.length < 1) e.gaps = 'At least one gap is required';
      if (responseOptions.length < gaps.length) e.responseOptions = 'Response options bank must contain at least as many options as gaps';
      const missingAns = gaps.some(g => !gmAnswers[g.id] && !gmAnswers[g.label]);
      if (missingAns) e.answer = 'Please assign a correct option for each gap';
    }
    if (type === 'MULTIPLE_DROP_BUCKET') {
      const validOptBuckets = optionBuckets.filter(b => b.title?.trim() || b.options?.some(o => o.trim()));
      if (validOptBuckets.length < 1) e.optionBuckets = 'At least one Option Bucket is required';
      const validDropBuckets = dropBuckets.filter(b => b.name?.trim());
      if (validDropBuckets.length < 1) e.dropBuckets = 'At least one Drop Bucket is required';
      const assignedCount = Object.values(mdbAnswers).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      if (assignedCount === 0) e.answer = 'Please assign options to the drop buckets';
    }
    if (type === 'MATRIX_INTERACTION') {
      const validCols = matrixColumns.filter(c => c.value?.trim());
      if (validCols.length < 2) e.columns = 'At least two columns are required';
      const validRows = matrixRows.filter(r => r.value?.trim());
      if (validRows.length < 1) e.rows = 'At least one row is required';
      const missingAns = matrixRows.some(r => !matrixAnswers[r.value] && !matrixAnswers[r.id]);
      if (missingAns) e.answer = 'Please select a correct response for each row';
    }
    if (type === 'SELECT_TEXT') {
      if (!stPassage.trim()) e.passage = 'Passage content is required';
      if (!Array.isArray(stAnswers) || stAnswers.length === 0) e.answer = 'Please select at least one correct answer from the passage';
    }
    return e;
  };

  const buildPayload = () => {
    let payload = null;
    if (type === 'MCQ' || type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT') {
      const validOpts = options.filter(o => o.trim());
      const compiledMcqExplanation = validOpts
        .map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const r = optionRationales[i]?.trim();
          if (!r) return null;
          const isCorr = type === 'MULTIPLE_SELECT'
            ? answer.split('|').map(s => s.trim()).includes(opt.trim())
            : answer.trim() === opt.trim();
          return `• Option ${letter} (${isCorr ? 'Correct' : 'Incorrect'}): ${r}`;
        })
        .filter(Boolean)
        .join('\n') || explanation;

      const optionsObj = {};
      validOpts.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        optionsObj[letter] = opt;
      });
      optionsObj.rationales = optionRationales.slice(0, validOpts.length);
      if (visualSvg) {
        optionsObj.visual = visualSvg;
      }

      payload = {
        type,
        text,
        options: optionsObj,
        answer,
        difficulty,
        points,
        explanation: compiledMcqExplanation,
      };
    } else if (type === 'TRUE_FALSE') {
      const isTrue = tfAnswers === 'true';
      const compiledTfExp = [
        tfRationales.true ? `• True (${isTrue ? 'Correct' : 'Incorrect'}): ${tfRationales.true}` : null,
        tfRationales.false ? `• False (${!isTrue ? 'Correct' : 'Incorrect'}): ${tfRationales.false}` : null,
      ].filter(Boolean).join('\n') || explanation;

      payload = {
        type,
        text,
        options: { rationales: tfRationales },
        answer: tfAnswers,
        difficulty,
        points,
        explanation: compiledTfExp,
      };
    } else if (type === 'SHORT_ANSWER') {
      payload = { type, text, options: null, answer, difficulty, points, explanation };
    } else if (type === 'CONSTRUCTED_RESPONSE') {
      const answers = effectiveCrBlanks.map(b => {
        const correct = b.correct.trim();
        const alts = b.acceptable.split(',').map(a => a.trim()).filter(Boolean);
        return [correct, ...alts].filter(Boolean);
      });
      const primaryAnswers = answers.map(b => b[0] || '');
      const compiledCrExp = effectiveCrBlanks
        .map((b, i) => b.rationale?.trim() ? `• Blank ${i + 1}: ${b.rationale.trim()}` : null)
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: { answers },
        answer: primaryAnswers.join('|'),
        difficulty,
        points,
        explanation: compiledCrExp,
      };
    } else if (type === 'DROPDOWN') {
      const blanks = effectiveDdBlanks.map(b => ({
        choices: b.choices.split(',').map(c => c.trim()).filter(Boolean),
        correct: b.correct.trim(),
        rationale: b.rationale?.trim() || undefined,
      }));
      const answer = blanks.map(b => b.correct).join('|');
      const compiledDdExp = effectiveDdBlanks
        .map((b, i) => b.rationale?.trim() ? `• Blank ${i + 1}: ${b.rationale.trim()}` : null)
        .filter(Boolean)
        .join('\n') || explanation;

      payload = { type, text, options: { blanks }, answer, difficulty, points, explanation: compiledDdExp };
    } else if (type === 'MATCHING_LINES') {
      const left = Object.fromEntries(Object.entries(matchLeft).filter(([, v]) => v.trim()));
      const right = Object.fromEntries(Object.entries(matchRight).filter(([, v]) => v.trim()));

      const cleanRationales = {};
      Object.keys(right).forEach(k => {
        if (matchRationales[k]?.trim()) {
          cleanRationales[k] = matchRationales[k].trim();
        }
      });

      const compiledMatchExp = Object.keys(right)
        .map(k => {
          const r = cleanRationales[k];
          return r ? `• Match ${k}: ${r}` : null;
        })
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: { left, right, rationales: cleanRationales },
        answer: matchAnswer.trim(),
        difficulty,
        points,
        explanation: compiledMatchExp,
      };
    } else if (type === 'ORDERING') {
      const validOptions = options.filter(o => o.trim());
      let finalOrder = correctOrder.filter(item => validOptions.includes(item));
      validOptions.forEach(opt => {
        if (!finalOrder.includes(opt)) {
          finalOrder.push(opt);
        }
      });
      const compiledOrderExp = finalOrder
        .map((item, i) => {
          const r = orderRationales[item] || orderRationales[String(i + 1)];
          return r && r.trim() ? `• Step ${i + 1} (${item}): ${r.trim()}` : null;
        })
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: validOptions,
        answer: finalOrder.join('|'),
        difficulty,
        points,
        explanation: compiledOrderExp,
      };
    } else if (type === 'BACKGROUND_GRAPHIC') {
      payload = {
        type,
        text,
        options: {
          svg_graphic: svgGraphic,
          drop_zone_width: dropZoneWidth,
          drop_zone_height: dropZoneHeight,
          drop_zones: dropZones,
          label_bank: labelBank,
        },
        answer: bgAnswers,
        difficulty,
        points,
        explanation,
      };
    } else if (type === 'GAP_MATCH') {
      const compiledGmExp = Object.entries(gmRationales)
        .map(([gapKey, r]) => (r && r.trim() ? `• ${gapKey.replace(/^gap/i, 'Gap')}: ${r.trim()}` : null))
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: {
          passage,
          gaps,
          response_options: responseOptions,
          rationales: gmRationales,
        },
        answer: gmAnswers,
        difficulty,
        points,
        explanation: compiledGmExp,
      };
    } else if (type === 'MULTIPLE_DROP_BUCKET') {
      const validDropBuckets = dropBuckets.filter(b => b.name?.trim());
      const cleanRationales = {};
      validDropBuckets.forEach(b => {
        const r = mdbRationales[b.name] || mdbRationales[b.id];
        if (r && r.trim()) {
          cleanRationales[b.name] = r.trim();
          if (b.id) cleanRationales[b.id] = r.trim();
        }
      });

      const compiledMdbExp = validDropBuckets
        .map(b => {
          const r = cleanRationales[b.name];
          return r ? `• ${b.name}: ${r}` : null;
        })
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: {
          option_buckets: optionBuckets.filter(b => b.title?.trim() || b.options?.some(o => o.trim())),
          drop_buckets: validDropBuckets,
          rationales: cleanRationales,
        },
        answer: mdbAnswers,
        difficulty,
        points,
        explanation: compiledMdbExp,
      };
    } else if (type === 'MATRIX_INTERACTION') {
      const compiledMatrixExp = Object.entries(matrixRationales)
        .map(([rowKey, r]) => (r && r.trim() ? `• ${rowKey}: ${r.trim()}` : null))
        .filter(Boolean)
        .join('\n') || explanation;

      payload = {
        type,
        text,
        options: {
          header: matrixHeader,
          columns: matrixColumns.filter(c => c.value?.trim()),
          rows: matrixRows.filter(r => r.value?.trim()),
          rationales: matrixRationales,
        },
        answer: matrixAnswers,
        difficulty,
        points,
        explanation: compiledMatrixExp,
      };
    } else if (type === 'SELECT_TEXT') {
      payload = {
        type,
        text,
        options: {
          selection_type: stSelectionType,
          max_selections: stMaxSelections,
          passage: stPassage,
        },
        answer: stAnswers,
        difficulty,
        points,
        explanation,
      };
    } else {
      payload = { type, text, options, answer, difficulty, points, explanation };
    }

    if (visualSvg && payload) {
      payload.visual = visualSvg;
      if (payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options)) {
        payload.options.visual = visualSvg;
      } else if (Array.isArray(payload.options)) {
        payload.options = { items: payload.options, visual: visualSvg };
      } else if (!payload.options) {
        payload.options = { visual: visualSvg };
      }
    }
    return payload;
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
      {!hideHeader && (
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
            <button className="qc-btn qc-btn-ghost" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      )}

      {/* Question Type Dropdown */}
      {!hideTypeSelect && (
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
      )}

      {/* Question Text & Diagram Container */}
      {type && (
        <div className="qc-field">
          <label className="qc-label">
            {type === 'FILL_IN_BLANK'
              ? 'Question Text (use ___ for each blank)'
              : 'Question Text'}
          </label>
          <div style={{
            borderRadius: 10,
            border: '1.5px solid var(--color-border)',
            background: '#ffffff',
            overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
          }}>
            <textarea
              className="qc-input qc-textarea"
              style={{
                border: 'none',
                borderRadius: 0,
                borderBottom: visualSvg ? '1px solid #e2e8f0' : 'none',
                background: '#f8fafc',
                boxShadow: 'none',
                resize: 'vertical',
              }}
              placeholder={
                type === 'FILL_IN_BLANK'
                  ? 'e.g. The capital of France is ___ and it is known for the ___ Tower.'
                  : 'Enter your question here...'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {visualSvg && (
              <div style={{ background: '#ffffff', padding: '10px 0 0' }}>
                <DiagramViewer svgCode={visualSvg} filename="diagram_edit" hideBorder={true} />
              </div>
            )}
          </div>
          {err('text')}
        </div>
      )}

      {/* MCQ / Choice Options with Per-Choice Rationales */}
      {(type === 'SINGLE_SELECT' || type === 'MULTIPLE_SELECT' || type === 'MCQ') && (
        <McqEditor
          type={type}
          options={options}
          setOptions={setOptions}
          rationales={optionRationales}
          setRationales={setOptionRationales}
          updateRationale={updateOptionRationale}
          answer={answer}
          setAnswer={setAnswer}
          updateOption={updateOption}
          err={err}
        />
      )}

      {/* True / False with Per-Option Rationales */}
      {type === 'TRUE_FALSE' && (
        <TrueFalseEditor
          answer={tfAnswers}
          setAnswer={setTfAnswers}
          rationales={tfRationales}
          setRationales={setTfRationales}
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
          rationales={matchRationales}
          setRationales={setMatchRationales}
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
          rationales={orderRationales}
          setRationales={setOrderRationales}
          err={err}
        />
      )}

      {/* Background Graphic */}
      {type === 'BACKGROUND_GRAPHIC' && (
        <BackgroundGraphicEditor
          svgGraphic={svgGraphic}
          setSvgGraphic={setSvgGraphic}
          dropZoneWidth={dropZoneWidth}
          setDropZoneWidth={setDropZoneWidth}
          dropZoneHeight={dropZoneHeight}
          setDropZoneHeight={setDropZoneHeight}
          dropZones={dropZones}
          setDropZones={setDropZones}
          labelBank={labelBank}
          setLabelBank={setLabelBank}
          answers={bgAnswers}
          setAnswers={setBgAnswers}
          err={err}
        />
      )}

      {/* Gap Match */}
      {type === 'GAP_MATCH' && (
        <GapMatchEditor
          passage={passage}
          setPassage={setPassage}
          gaps={gaps}
          setGaps={setGaps}
          responseOptions={responseOptions}
          setResponseOptions={setResponseOptions}
          answers={gmAnswers}
          setAnswers={setGmAnswers}
          rationales={gmRationales}
          setRationales={setGmRationales}
          err={err}
        />
      )}

      {/* Multiple Drop Bucket */}
      {type === 'MULTIPLE_DROP_BUCKET' && (
        <MultipleDropBucketEditor
          optionBuckets={optionBuckets}
          setOptionBuckets={setOptionBuckets}
          dropBuckets={dropBuckets}
          setDropBuckets={setDropBuckets}
          answers={mdbAnswers}
          setAnswers={setMdbAnswers}
          rationales={mdbRationales}
          setRationales={setMdbRationales}
          err={err}
        />
      )}

      {/* Matrix Interaction */}
      {type === 'MATRIX_INTERACTION' && (
        <MatrixInteractionEditor
          header={matrixHeader}
          setHeader={setMatrixHeader}
          columns={matrixColumns}
          setColumns={setMatrixColumns}
          rows={matrixRows}
          setRows={setMatrixRows}
          answers={matrixAnswers}
          setAnswers={setMatrixAnswers}
          rationales={matrixRationales}
          setRationales={setMatrixRationales}
          err={err}
        />
      )}

      {/* Select Text */}
      {type === 'SELECT_TEXT' && (
        <SelectTextEditor
          selectionType={stSelectionType}
          setSelectionType={setStSelectionType}
          maxSelections={stMaxSelections}
          setMaxSelections={setStMaxSelections}
          passage={stPassage}
          setPassage={setStPassage}
          answers={stAnswers}
          setAnswers={setStAnswers}
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

      {/* Dedicated Pedagogical Rationale Field for question types without per-item fields */}
      {(type === 'SHORT_ANSWER' || type === 'SELECT_TEXT' || type === 'BACKGROUND_GRAPHIC') && (
        <div className="qc-field" style={{ marginTop: 16 }}>
          <label className="qc-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💡 Pedagogical Rationale & Solution Explanation</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', textTransform: 'none' }}>
              (Optional)
            </span>
          </label>
          <textarea
            className="qc-input qc-textarea"
            rows={4}
            placeholder="Provide step-by-step reasoning explaining why the answer is correct and why distractors are incorrect..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            style={{ minHeight: 90, lineHeight: 1.5 }}
          />
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
