/**
 * aiGenerateConstants.js
 * -----------------------
 * Constants and utility functions for AI Question Generation and Refinement.
 */

export const CONTENT_AREAS = [
  'English Language Arts',
  'Mathematics',
  'Science'
];

export const GRADES = [
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9'
];

export const QUESTION_TYPES = [
  { value: 'SINGLE_SELECT', label: 'Multiple Choice (Single Select)', icon: '🔘', desc: '4 options, one correct answer' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Choice (Multiple Select)', icon: '✅', desc: '4-6 options, one or more correct answers' },
  { value: 'TRUE_FALSE', label: 'True / False', icon: '⚖️', desc: 'Statement judged true or false' },
  { value: 'CONSTRUCTED_RESPONSE', label: 'Constructed Response', icon: '✏️', desc: 'Type the answer for each blank' },
  { value: 'DROPDOWN', label: 'Dropdown', icon: '📋', desc: 'Select answer for each blank from a list' },
  { value: 'MATCHING_LINES', label: 'Matching Lines', icon: '🔗', desc: 'Match Column A items to Column B' },
  { value: 'ORDERING', label: 'Ordering', icon: '↕️', desc: 'Drag options to place them in correct order' },
  { value: 'BACKGROUND_GRAPHIC', label: 'Background Graphic', icon: '🖼️', desc: 'Drag labels onto marked diagram drop zones' },
];

export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', color: '#15803d', bg: '#f0fdf4' },
  { value: 'medium', label: 'Medium', color: '#92400e', bg: '#fffbeb' },
  { value: 'hard', label: 'Hard', color: '#991b1b', bg: '#fef2f2' },
];

export const TYPE_META = {
  SINGLE_SELECT: { color: '#4f6ef7', bg: '#eef1fe' },
  MULTIPLE_SELECT: { color: '#3b82f6', bg: '#dbeafe' },
  MCQ: { color: '#4f6ef7', bg: '#eef1fe' },
  TRUE_FALSE: { color: '#22c55e', bg: '#f0fdf4' },
  SHORT_ANSWER: { color: '#f59e0b', bg: '#fffbeb' },
  FILL_IN_BLANK: { color: '#a855f7', bg: '#faf5ff' },   // legacy display
  CONSTRUCTED_RESPONSE: { color: '#7c3aed', bg: '#f5f3ff' },
  DROPDOWN: { color: '#0e7490', bg: '#ecfeff' },
  MATCHING_LINES: { color: '#0891b2', bg: '#ecfeff' },
  ORDERING: { color: '#db2777', bg: '#fdf2f8' },
  BACKGROUND_GRAPHIC: { color: '#059669', bg: '#ecfdf5' },
};

/**
 * Returns available targeted refinement checkboxes tailored to each specific question type.
 */
export const getRefinementTargetsForType = (qType) => {
  const type = (qType || '').toUpperCase();
  if (type === 'TRUE_FALSE') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'answer', label: 'Correct Answer (True / False)' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  if (type === 'CONSTRUCTED_RESPONSE') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'answer', label: 'Correct Answer' },
      { id: 'alternatives', label: 'Alternative Answers' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  if (type === 'MATCHING_LINES') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'pairs', label: 'Matching Pairs' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  if (type === 'ORDERING') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'sequence', label: 'Sequence Items' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  if (type === 'DROPDOWN') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'choices', label: 'Dropdown Choices' },
      { id: 'answer', label: 'Correct Answer' },
      { id: 'distractors', label: 'Distractors Only' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  if (type === 'BACKGROUND_GRAPHIC') {
    return [
      { id: 'stem', label: 'Question Stem' },
      { id: 'graphic', label: 'Diagram / Graphic' },
      { id: 'drop_zones', label: 'Drop Zone Pins' },
      { id: 'label_bank', label: 'Label Bank' },
      { id: 'answer', label: 'Correct Labels' },
      { id: 'rationale', label: 'Rationale' },
      { id: 'entire_item', label: 'Entire Item' },
    ];
  }
  // Default for SINGLE_SELECT, MULTIPLE_SELECT, MCQ
  return [
    { id: 'stem', label: 'Question Stem' },
    { id: 'choices', label: 'Answer Choices' },
    { id: 'answer', label: 'Correct Answer' },
    { id: 'distractors', label: 'Distractors Only' },
    { id: 'rationale', label: 'Rationale' },
    { id: 'entire_item', label: 'Entire Item' },
  ];
};

/** Parse "A-2, B-4, C-1, D-3" → { A: '2', B: '4', C: '1', D: '3' } */
export function parseMatchingAnswer(answerStr) {
  if (!answerStr) return {};
  const result = {};
  answerStr.split(',').forEach(pair => {
    const [left, right] = pair.trim().split('-');
    if (left && right) result[left.trim()] = right.trim();
  });
  return result;
}
