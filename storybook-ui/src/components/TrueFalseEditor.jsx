import React from 'react';

export function TrueFalseEditor({ answer, setAnswer, err }) {
  return (
    <div className="qc-field">
      <label className="qc-label">Correct Answer</label>
      <div className="qc-tf-buttons">
        <button
          type="button"
          className={`qc-tf-btn${answer === 'true' ? ' selected-true' : ''}`}
          onClick={() => setAnswer('true')}
        >✓ True</button>
        <button
          type="button"
          className={`qc-tf-btn${answer === 'false' ? ' selected-false' : ''}`}
          onClick={() => setAnswer('false')}
        >✗ False</button>
      </div>
      {err('answer')}
    </div>
  );
}

export default TrueFalseEditor;
