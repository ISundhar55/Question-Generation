/**
 * MarkdownText.jsx
 * Lightweight Markdown renderer for question text.
 * Supports: tables, bold, italic, inline code, line breaks.
 * Zero external dependencies.
 */

/**
 * Parse a Markdown table block into an HTML table string.
 * A table block looks like:
 *   | Col A | Col B |
 *   |-------|-------|
 *   | val1  | val2  |
 */
function parseTable(block) {
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Parse a row → array of cell strings
  const parseRow = (line) =>
    line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  const headerCells = parseRow(lines[0]);

  // Second line must be a separator row (----)
  const sepLine = lines[1];
  if (!/^[\|\s\-:]+$/.test(sepLine)) return null;

  const bodyRows = lines.slice(2).map(parseRow);

  const thHtml = headerCells.map(c => `<th>${inlineMarkdown(c)}</th>`).join('');
  const tbodyHtml = bodyRows
    .map(row => `<tr>${row.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
    .join('');

  return `<div class="md-table-wrapper"><table class="md-table"><thead><tr>${thHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div>`;
}

/**
 * Convert inline Markdown to HTML:
 *  **bold**, *italic*, `code`
 */
function inlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
}

/**
 * Convert full Markdown text to an HTML string.
 * Splits content into table blocks and text paragraphs.
 */
export function markdownToHtml(text) {
  if (!text) return '';

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
  return text
    .split('\n')
    .map(line => {
      const t = line.trim();
      return t ? `<p class="md-p">${inlineMarkdown(t)}</p>` : '';
    })
    .join('');
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
