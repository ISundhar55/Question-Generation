/**
 * MarkdownText.jsx
 * Lightweight Markdown renderer for question text.
 * Supports: tables, bold, italic, inline code, line breaks.
 * Zero external dependencies.
 */

/**
 * Normalize informal ASCII/Markdown tables into standard GFM tables.
 * Handles:
 *   x | y
 *   -------
 *   3 | 11
 */
function normalizeTableText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if current line has pipe '|' and next line is a dashed separator
    const isPipeRow = trimmed.includes('|');
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    const isSepRow = /^[\|\s\-:\+]{3,}$/.test(nextLine) && (nextLine.includes('-') || nextLine.includes('+'));

    if (isPipeRow && isSepRow) {
      const tableLines = [];
      const parseCells = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headerCells = parseCells(trimmed);
      const colCount = headerCells.length;

      // Header formatted
      tableLines.push('| ' + headerCells.join(' | ') + ' |');
      // Separator formatted
      tableLines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');
      i += 2; // skip header and original separator

      // Read subsequent body rows
      while (i < lines.length) {
        const bodyLine = lines[i].trim();
        if (!bodyLine || !bodyLine.includes('|')) break;
        const cells = parseCells(bodyLine);
        while (cells.length < colCount) cells.push('');
        tableLines.push('| ' + cells.slice(0, colCount).join(' | ') + ' |');
        i++;
      }

      result.push(tableLines.join('\n'));
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Parse a Markdown table block into an HTML table string.
 */
function parseTable(block) {
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const parseRow = (line) =>
    line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  const headerCells = parseRow(lines[0]);
  const sepLine = lines[1];
  if (!/^[\|\s\-:\+]+$/.test(sepLine)) return null;

  const bodyRows = lines.slice(2).map(parseRow);

  const thHtml = headerCells.map(c => `<th>${inlineMarkdown(c)}</th>`).join('');
  const tbodyHtml = bodyRows
    .map(row => `<tr>${row.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
    .join('');

  return `<div class="md-table-wrapper"><table class="md-table"><thead><tr>${thHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div>`;
}

/**
 * Convert LaTeX math syntax (\times, \frac{a}{b}, \sqrt{x}, 4^3, x_1) into clean HTML.
 */
function formatMathLatex(text) {
  if (!text) return '';
  let out = text;

  // 1. Stacked Fractions: \frac{num}{den}
  out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="md-frac"><span class="md-frac-num">$1</span><span class="md-frac-den">$2</span></span>');

  // 2. Square roots: \sqrt{arg} or \sqrt[n]{arg}
  out = out.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="md-sqrt"><sup>$1</sup>√<span class="md-sqrt-rad">$2</span></span>');
  out = out.replace(/\\sqrt\{([^}]+)\}/g, '<span class="md-sqrt">√<span class="md-sqrt-rad">$1</span></span>');

  // 3. LaTeX Math Symbols & Operators
  out = out
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\div\b/g, '÷')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\leq?\b/g, '≤')
    .replace(/\\geq?\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\Sigma\b/g, 'Σ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\circ\b/g, '°')
    .replace(/\\degree\b/g, '°')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\perp\b/g, '⊥')
    .replace(/\\triangle\b/g, '△');

  // 4. Superscripts / Exponents: 4^3 or x^{2}
  out = out.replace(/([0-9a-zA-Z\)\}\]])\^\{([^}]+)\}/g, '$1<sup>$2</sup>');
  out = out.replace(/([0-9a-zA-Z\)\}\]])\^([0-9a-zA-Z+-]+)/g, '$1<sup>$2</sup>');

  // 5. Subscripts: x_{1} or x_1
  out = out.replace(/([0-9a-zA-Z\)\}\]])_\{([^}]+)\}/g, '$1<sub>$2</sub>');
  out = out.replace(/([0-9a-zA-Z\)\}\]])_([0-9a-zA-Z+-]+)/g, '$1<sub>$2</sub>');

  // 6. Clean escaped brackets & leftover backslashes
  out = out
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');

  return out;
}

/**
 * Convert inline Markdown to HTML:
 *  **bold**, *italic*, `code`, and $math$
 */
function inlineMarkdown(raw) {
  let text = formatMathLatex(raw);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;span class="md-frac"&gt;/g, '<span class="md-frac">')
    .replace(/&lt;span class="md-frac-num"&gt;/g, '<span class="md-frac-num">')
    .replace(/&lt;span class="md-frac-den"&gt;/g, '<span class="md-frac-den">')
    .replace(/&lt;span class="md-sqrt"&gt;/g, '<span class="md-sqrt">')
    .replace(/&lt;span class="md-sqrt-rad"&gt;/g, '<span class="md-sqrt-rad">')
    .replace(/&lt;\/span&gt;/g, '</span>')
    .replace(/&lt;sup&gt;/g, '<sup>')
    .replace(/&lt;\/sup&gt;/g, '</sup>')
    .replace(/&lt;sub&gt;/g, '<sub>')
    .replace(/&lt;\/sub&gt;/g, '</sub>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>')
    .replace(/\$\$([^$]+?)\$\$/g, '<span class="md-math-block">$1</span>')
    .replace(/\$([^$\n]+?)\$/g, '<i class="md-math">$1</i>');
}

/**
 * Convert full Markdown text to an HTML string.
 * Splits content into table blocks and text paragraphs.
 */
export function markdownToHtml(rawText) {
  if (!rawText) return '';
  const text = normalizeTableText(rawText);

  const parts = [];
  // Split on table blocks: lines starting with |
  const tableBlockRegex = /(?:^|\n)((?:\|[^\n]+\n?){2,})/g;
  let lastIndex = 0;
  let match;

  while ((match = tableBlockRegex.exec(text)) !== null) {
    // Text before the table
    const before = text.slice(lastIndex, match.index + (match[0].startsWith('\n') ? 1 : 0));
    if (before.trim()) {
      parts.push(renderParagraph(before));
    }

    const tableHtml = parseTable(match[1]);
    if (tableHtml) {
      parts.push(tableHtml);
    } else {
      // Not a real table — render as paragraph
      parts.push(renderParagraph(match[1]));
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last table
  const tail = text.slice(lastIndex);
  if (tail.trim()) {
    parts.push(renderParagraph(tail));
  }

  return parts.join('');
}

function renderParagraph(text) {
  const lines = text.split('\n');
  const result = [];
  let inList = false;
  let listType = null; // 'ul' or 'ol'
  let listItems = [];

  const closeList = () => {
    if (inList) {
      const itemsHtml = listItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('');
      result.push(`<${listType} class="md-${listType}">${itemsHtml}</${listType}>`);
      inList = false;
      listType = null;
      listItems = [];
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    // Check for bullet list item: starts with '- ' or '* ' or '• '
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.+)$/);
    // Check for numbered list item: starts with '1. ', '2. ', etc.
    const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);

    if (bulletMatch) {
      if (inList && listType !== 'ul') {
        closeList();
      }
      inList = true;
      listType = 'ul';
      listItems.push(bulletMatch[3]);
    } else if (numberMatch) {
      if (inList && listType !== 'ol') {
        closeList();
      }
      inList = true;
      listType = 'ol';
      listItems.push(numberMatch[3]);
    } else {
      closeList();
      result.push(`<p class="md-p">${inlineMarkdown(trimmed)}</p>`);
    }
  }
  closeList();

  return result.join('');
}

/**
 * React component — renders Markdown-formatted question text
 * with proper table styling, bold, italic, and code.
 */
export function MarkdownText({ text, className = '', style = {} }) {
  const html = markdownToHtml(text || '');
  return (
    <span
      className={`md-text ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownText;
