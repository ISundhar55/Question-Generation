import React from 'react';

export function TrueFalseEditor({ answer, setAnswer, err }) {
  const norm = (answer === true || String(answer).toLowerCase() === 'true' || String(answer).toLowerCase() === 't')
    ? 'true'
    : (answer === false || String(answer).toLowerCase() === 'false' || String(answer).toLowerCase() === 'f')
      ? 'false'
      : (String(answer).trim().toUpperCase() === 'A' ? 'true' : String(answer).trim().toUpperCase() === 'B' ? 'false' : '');

  return (
    <div className="qc-field">
      <label className="qc-label">Correct Answer</label>
      <div className="qc-tf-buttons">
        <button
          type="button"
          className={`qc-tf-btn${norm === 'true' ? ' selected-true' : ''}`}
          onClick={() => setAnswer('true')}
        >✓ True</button>
        <button
          type="button"
          className={`qc-tf-btn${norm === 'false' ? ' selected-false' : ''}`}
          onClick={() => setAnswer('false')}
        >✗ False</button>
      </div>
      {err('answer')}
    </div>
  );
}

export default TrueFalseEditor;
