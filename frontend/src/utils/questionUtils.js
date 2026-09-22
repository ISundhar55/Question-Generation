/**
 * Utilities for cleaning and formatting question choices and options.
 */

export const cleanOptionText = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\s*[\(\[]\s*(?:Correct|Incorrect)\s*[\)\]]\s*$/i, '')
    .replace(/^\s*[\(\[]\s*(?:Correct|Incorrect)\s*[\)\]]\s*[:-]?\s*/i, '')
    .replace(/\s*[:\-–]\s*(?:Correct|Incorrect)\s*$/i, '')
    .replace(/^\s*(?:Correct|Incorrect)\s*[:\-–]\s*/i, '')
    .trim();
};

export const sanitizeOptions = (opts) => {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return opts;
  const cleaned = {};
  for (const [k, v] of Object.entries(opts)) {
    if (k !== 'visual' && typeof v === 'string') {
      cleaned[k] = cleanOptionText(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
};
