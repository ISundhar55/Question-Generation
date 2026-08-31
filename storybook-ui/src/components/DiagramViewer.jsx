import React, { useRef, useState } from 'react';

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
 * Renders an inline SVG diagram with a clean container and a 1-click PNG download button.
 */
export function DiagramViewer({ svgCode, title = 'Visual Diagram', filename = 'diagram' }) {
  const containerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!svgCode) return null;

  const handleDownloadPng = (e) => {
    e && e.stopPropagation();
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;
    setDownloading(true);
    downloadSvgAsPng(svg, `${filename}.png`, 2.5);
    setTimeout(() => setDownloading(false), 800);
  };

  return (
    <div
      style={{
        margin: '14px 0',
        borderRadius: 10,
        border: '1.5px solid #e2e8f0',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header bar with title and PNG download button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#334155' }}>
          <span style={{ fontSize: 14 }}>📐</span>
          <span>{title}</span>
        </div>

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
          }}
          title="Download diagram as high-resolution PNG image"
        >
          <span>⬇</span>
          <span>{downloading ? 'Downloading...' : 'Download Image (PNG)'}</span>
        </button>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={containerRef}
        style={{
          padding: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#ffffff',
          minHeight: 140,
          overflowX: 'auto',
        }}
        dangerouslySetInnerHTML={{ __html: svgCode }}
      />
    </div>
  );
}

export default DiagramViewer;
