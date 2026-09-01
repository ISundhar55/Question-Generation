import React, { useRef, useState } from 'react';
import { MarkdownText } from './MarkdownText';

/**
 * Download an SVG DOM element as a crisp high-res PNG image.
 */
export function downloadSvgAsPng(svgElement, filename = 'question_diagram.png', scale = 2.5) {
  if (!svgElement) return;
  try {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Determine dimensions from viewBox or client rect
    let width = svgElement.clientWidth || 450;
    let height = svgElement.clientHeight || 220;
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    }

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    img.src = url;
  } catch (err) {
    console.error('Failed to download SVG as PNG:', err);
  }
}

/**
 * DiagramViewer Component
 * Renders an inline SVG diagram unified with stem text in a single container with a 1-click PNG download button.
 */
export function DiagramViewer({
  svgCode,
  stemText = null,
  filename = 'diagram',
  hideBorder = false,
}) {
  const containerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!svgCode) return null;

  let cleanSvg = typeof svgCode === 'string' ? svgCode.trim() : '';

  // 1. Remove markdown code fences if present
  cleanSvg = cleanSvg.replace(/^```(?:xml|svg|html)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Decode HTML entities if present (&lt;svg...&gt;)
  if (cleanSvg.includes('&lt;svg') || cleanSvg.includes('&lt;/svg&gt;')) {
    cleanSvg = cleanSvg
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  // 3. Extract SVG markup if embedded in other text
  const svgMatch = cleanSvg.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    cleanSvg = svgMatch[0];
  }

  // 4. Ensure svg has xmlns attribute
  if (cleanSvg.startsWith('<svg') && !cleanSvg.includes('xmlns=')) {
    cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const isImgUrl = cleanSvg.startsWith('http://') || cleanSvg.startsWith('https://') || cleanSvg.startsWith('data:image/');

  const handleDownloadPng = (e) => {
    e && e.stopPropagation();
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) {
      const img = containerRef.current.querySelector('img');
      if (img && img.src) {
        const a = document.createElement('a');
        a.download = `${filename}.png`;
        a.href = img.src;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return;
    }
    setDownloading(true);
    downloadSvgAsPng(svg, `${filename}.png`, 2.5);
    setTimeout(() => setDownloading(false), 800);
  };

  const downloadBtn = (
    <button
      type="button"
      onClick={handleDownloadPng}
      disabled={downloading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 12px',
        borderRadius: 6,
        border: '1px solid #bae6fd',
        background: '#f0f9ff',
        fontSize: 12,
        fontWeight: 600,
        color: '#0284c7',
        cursor: downloading ? 'wait' : 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
      title="Download diagram as high-resolution PNG image"
    >
      <span>⬇</span>
      <span>{downloading ? 'Downloading...' : 'Download'}</span>
    </button>
  );

  return (
    <div
      style={{
        margin: hideBorder ? '0' : '14px 0',
        borderRadius: 10,
        border: hideBorder ? 'none' : '1.5px solid #e2e8f0',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: hideBorder ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Full-width Question Stem Text */}
      {stemText && (
        <div
          style={{
            padding: '14px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.5,
          }}
        >
          {typeof stemText === 'string' ? <MarkdownText text={stemText} /> : stemText}
        </div>
      )}

      {/* Diagram Canvas Area with Download Button below stem */}
      <div style={{ position: 'relative', background: '#ffffff', minHeight: 160 }}>
        <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 2 }}>
          {downloadBtn}
        </div>

        {/* Diagram Canvas */}
        <div
          ref={containerRef}
          style={{
            padding: '36px 16px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 140,
            overflowX: 'auto',
          }}
        >
          {isImgUrl ? (
            <img
              src={cleanSvg}
              alt="Question Diagram"
              style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: cleanSvg }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DiagramViewer;
