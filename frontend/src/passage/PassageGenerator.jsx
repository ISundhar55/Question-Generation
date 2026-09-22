import React, { useState, useRef, useEffect } from 'react';
import { aiAPI, passagesAPI } from '../services/api';
import { CONTENT_AREAS, GRADES } from '../pages/aiGenerateConstants';
import PassageCard from './PassageCard';
import EditPassageModal from './EditPassageModal';

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#1e293b',
  display: 'block',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1.5px solid #cbd5e1',
  fontSize: 14,
  background: 'var(--color-surface, #fff)',
  color: '#0f172a',
  outline: 'none',
  cursor: 'pointer',
};

export default function PassageGenerator({
  initialContentArea = CONTENT_AREAS[0],
  initialGrade = GRADES[0],
  onGenerateQuestions,
  modeToggle,
}) {
  // Parameters
  const [contentArea, setContentArea] = useState(initialContentArea);
  const [contentAreaOpen, setContentAreaOpen] = useState(false);
  const contentAreaDropdownRef = useRef(null);

  const [grade, setGrade] = useState(initialGrade);
  const [gradeOpen, setGradeOpen] = useState(false);
  const gradeDropdownRef = useRef(null);

  const [assessmentTarget, setAssessmentTarget] = useState('');
  const [assessmentBoundaries, setAssessmentBoundaries] = useState('');
  const [cognitiveComplexity, setCognitiveComplexity] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [includeVisuals, setIncludeVisuals] = useState(false);

  // Status & Results
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [passages, setPassages] = useState([]);
  const [editingPassage, setEditingPassage] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(e.target)) {
        setGradeOpen(false);
      }
      if (contentAreaDropdownRef.current && !contentAreaDropdownRef.current.contains(e.target)) {
        setContentAreaOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGeneratePassages = async () => {
    setGenerating(true);
    setError(null);
    setPassages([]);

    const promptParts = [];
    if (assessmentTarget.trim()) {
      promptParts.push(`🎯 Assessment Target:\n${assessmentTarget.trim()}`);
    }
    if (assessmentBoundaries.trim()) {
      promptParts.push(`🛑 Assessment Boundaries:\n${assessmentBoundaries.trim()}`);
    }
    if (cognitiveComplexity.trim()) {
      promptParts.push(`🧠 Cognitive Complexity:\n${cognitiveComplexity.trim()}`);
    }
    if (customPrompt.trim()) {
      promptParts.push(`Additional Instructions:\n${customPrompt.trim()}`);
    }
    const combinedCustomPrompt = promptParts.length > 0 ? promptParts.join('\n\n') : undefined;

    try {
      const res = await aiAPI.generatePassage({
        content_area: contentArea,
        grade,
        count: 1,
        difficulty: 'medium',
        include_visuals: includeVisuals,
        assessment_target: assessmentTarget.trim() || undefined,
        assessment_boundaries: assessmentBoundaries.trim() || undefined,
        cognitive_complexity: cognitiveComplexity.trim() || undefined,
        instructions: customPrompt.trim() || undefined,
        custom_prompt: customPrompt.trim() || combinedCustomPrompt || undefined,
      });

      const genPassages = (res.data?.passages || []).map(p => ({
        ...p,
        content_area: contentArea,
        grade,
        assessment_target: assessmentTarget.trim() || p.assessment_target,
        assessment_boundaries: assessmentBoundaries.trim() || p.assessment_boundaries,
        cognitive_complexity: cognitiveComplexity.trim() || p.cognitive_complexity,
        visual: p.visual || null,
        status: 'draft',
      }));

      if (genPassages.length === 0) {
        throw new Error('No passages generated. Please try again.');
      }

      setPassages(genPassages);

      // Auto-save generated passages as draft in DB
      (async () => {
        try {
          const savedResults = await Promise.all(
            genPassages.map(p => passagesAPI.create({
              title: p.title,
              text: p.text,
              visual: p.visual || null,
              genre: p.genre || 'Informational',
              grade: p.grade || grade,
              content_area: p.content_area || contentArea,
              word_count: p.word_count || (p.text ? p.text.trim().split(/\s+/).length : 0),
              assessment_target: p.assessment_target,
              assessment_boundaries: p.assessment_boundaries,
              status: 'draft',
            }))
          );
          setPassages(prev =>
            prev.map((p, i) => ({
              ...p,
              id: savedResults[i]?.data?.id || p.id,
              status: 'draft',
            }))
          );
        } catch (saveErr) {
          console.warn('Auto-save passages as draft failed:', saveErr);
        }
      })();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Passage generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePassageStatusUpdate = async (p, newStatus, idx) => {
    try {
      if (p.id) {
        await passagesAPI.updateStatus(p.id, newStatus);
      } else {
        const res = await passagesAPI.create({
          title: p.title,
          text: p.text,
          visual: p.visual || null,
          genre: p.genre || 'Informational',
          grade: p.grade || grade,
          content_area: p.content_area || contentArea,
          word_count: p.word_count || (p.text ? p.text.trim().split(/\s+/).length : 0),
          assessment_target: p.assessment_target,
          assessment_boundaries: p.assessment_boundaries,
          status: newStatus,
        });
        if (res.data?.id) p = { ...p, id: res.data.id };
      }
      setPassages(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], id: p.id, status: newStatus };
        return next;
      });
    } catch (err) {
      console.error('Update passage status error:', err);
      alert(err.response?.data?.message || 'Failed to update passage status');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px minmax(0, 1fr)', gap: 14, alignItems: 'start', width: '100%' }}>
      {/* ─── Left Panel: Passage Form ─── */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: '20px 18px', boxShadow: 'var(--shadow)', position: 'sticky', top: 16,
        minHeight: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
          Generation Parameters
        </h2>

        {modeToggle}

        {/* Content Area */}
        <div style={{ marginBottom: 18, position: 'relative' }} ref={contentAreaDropdownRef}>
          <label style={labelStyle}>Content Area</label>
          <div
            id="passage-content-area-select"
            onClick={() => setContentAreaOpen(prev => !prev)}
            style={{
              ...selectStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
              borderColor: contentAreaOpen ? '#0d9488' : '#cbd5e1',
              boxShadow: contentAreaOpen ? '0 0 0 3px rgba(13, 148, 136, 0.15)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontWeight: 500 }}>{contentArea}</span>
            <span style={{ fontSize: 10, color: '#64748b', transition: 'transform 0.15s', transform: contentAreaOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
          </div>

          {contentAreaOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--color-surface, #fff)',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 60,
            }}>
              {CONTENT_AREAS.map(a => (
                <div
                  key={a}
                  onClick={() => {
                    setContentArea(a);
                    setContentAreaOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13.5,
                    fontWeight: contentArea === a ? 600 : 400,
                    background: contentArea === a ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                    color: contentArea === a ? '#0d9488' : 'var(--color-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (contentArea !== a) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (contentArea !== a) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{a}</span>
                  {contentArea === a && <span style={{ fontSize: 12, color: '#0d9488' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade */}
        <div style={{ marginBottom: 18, position: 'relative' }} ref={gradeDropdownRef}>
          <label style={labelStyle}>Grade</label>
          <div
            id="passage-grade-select"
            onClick={() => setGradeOpen(prev => !prev)}
            style={{
              ...selectStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
              borderColor: gradeOpen ? '#0d9488' : '#cbd5e1',
              boxShadow: gradeOpen ? '0 0 0 3px rgba(13, 148, 136, 0.15)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontWeight: 500 }}>{grade}</span>
            <span style={{ fontSize: 10, color: '#64748b', transition: 'transform 0.15s', transform: gradeOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
          </div>

          {gradeOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--color-surface, #fff)',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 60,
            }}>
              {GRADES.map(g => (
                <div
                  key={g}
                  onClick={() => {
                    setGrade(g);
                    setGradeOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13.5,
                    fontWeight: grade === g ? 600 : 400,
                    background: grade === g ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                    color: grade === g ? '#0d9488' : 'var(--color-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (grade !== g) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (grade !== g) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{g}</span>
                  {grade === g && <span style={{ fontSize: 12, color: '#0d9488' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessment Boundaries */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Assessment Boundaries</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
          </label>
          <input
            id="passage-assessment-boundaries"
            type="text"
            placeholder="e.g. Exclude biochemical mechanisms (Calvin cycle, Krebs cycle)"
            value={assessmentBoundaries}
            onChange={e => setAssessmentBoundaries(e.target.value)}
            style={{
              ...selectStyle,
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: 'text',
            }}
          />
        </div>

        {/* Assessment Target */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Assessment Target</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
          </label>
          <textarea
            id="passage-assessment-target"
            rows={3}
            placeholder="e.g. MS-LS1-6: Construct a scientific explanation based on evidence for the role of photosynthesis in the cycling of matter and flow of energy into and out of organisms."
            value={assessmentTarget}
            onChange={e => setAssessmentTarget(e.target.value)}
            style={{
              ...selectStyle,
              resize: 'vertical',
              minHeight: 70,
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.45,
              fontStyle: assessmentTarget ? 'normal' : 'italic',
              cursor: 'text',
            }}
          />
        </div>

        {/* Cognitive Complexity */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cognitive Complexity</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
          </label>
          <input
            id="passage-cognitive-complexity"
            type="text"
            placeholder="e.g. DOK Level 2 / Bloom's: Analysis (cause-and-effect reasoning)"
            value={cognitiveComplexity}
            onChange={e => setCognitiveComplexity(e.target.value)}
            style={{
              ...selectStyle,
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: 'text',
            }}
          />
        </div>

        {/* Additional Instructions */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Additional Instructions</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, background: 'var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>optional</span>
          </label>
          <textarea
            id="passage-custom-prompt"
            rows={3}
            placeholder="e.g. Set the passage in a marine biology field laboratory context. Include an informational tone with scientific terminology suitable for Grade 8."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            style={{
              ...selectStyle,
              resize: 'vertical',
              minHeight: 80,
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.5,
              fontStyle: customPrompt ? 'normal' : 'italic',
              cursor: 'text',
            }}
          />
          {(assessmentTarget.trim() || assessmentBoundaries.trim() || cognitiveComplexity.trim() || customPrompt.trim()) && (
            <div style={{ fontSize: 11, color: '#0d9488', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>💡</span> AI will strictly apply these assessment parameters and instructions
            </div>
          )}
        </div>

        {/* Visual Diagrams Toggle */}
        <div
          id="passage-include-visuals-toggle"
          onClick={() => setIncludeVisuals(!includeVisuals)}
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            background: includeVisuals ? '#f0fdfa' : '#f8fafc',
            border: `1.5px solid ${includeVisuals ? '#2dd4bf' : 'var(--color-border)'}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            boxShadow: includeVisuals ? '0 2px 8px rgba(13, 148, 136, 0.12)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: includeVisuals ? '#0f766e' : 'var(--color-text)' }}>
                Include Visual Diagrams
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                Accompany passage with vector diagram, cycle, chart, or scientific illustration
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            id="passage-include-visuals"
            checked={includeVisuals}
            onChange={e => setIncludeVisuals(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0d9488' }}
          />
        </div>

        {/* Generate Button */}
        <button
          id="generate-passage-btn"
          className="btn-generate"
          onClick={handleGeneratePassages}
          disabled={generating}
          style={{
            width: '100%', padding: '13px',
            background: generating ? '#99f6e4' : '#0d9488',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: generating ? 'none' : '0 4px 14px rgba(13, 148, 136, 0.35)',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {generating ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Generating Stimulus Passage...
            </>
          ) : (
            '📖 Generate Stimulus Passage'
          )}
        </button>
      </div>

      {/* ─── Right Panel: Results ─── */}
      <div style={{ minWidth: 0, width: '100%' }}>
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '14px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Empty state while generating */}
        {generating && (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: 60, textAlign: 'center', boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>
              📖
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
              Synthesizing Reading Stimulus...
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Crafting curriculum-aligned passage grounded in assessment targets and boundaries...
            </div>
          </div>
        )}

        {/* Empty state before generation */}
        {!generating && passages.length === 0 && !error && (
          <div style={{
            background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
            borderRadius: 12, padding: 60, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Ready to Generate Stimulus Passages</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Configure parameters on the left and click Generate Stimulus Passage.
            </div>
          </div>
        )}

        {/* Render generated passages */}
        {!generating && passages.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Generated stimulus passage for <strong style={{ color: 'var(--color-text)' }}>{grade} {contentArea}</strong>
              </div>
            </div>

            {passages.map((p, idx) => (
              <PassageCard
                key={p.id || idx}
                passage={p}
                index={idx}
                onUpdateStatus={(pass, status) => handlePassageStatusUpdate(pass, status, idx)}
                onDelete={null}
                onEdit={() => setEditingPassage(p)}
                onGenerateQuestions={onGenerateQuestions}
                showCopy={false}
                showTargetBoundaries={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Edit Stimulus Passage Modal ─── */}
      {editingPassage && (
        <EditPassageModal
          passage={editingPassage}
          onSaveSuccess={(updated) => {
            setPassages(prev => prev.map(p => (p.id === updated.id || (p.title === editingPassage.title && !p.id)) ? updated : p));
            setEditingPassage(null);
          }}
          onClose={() => setEditingPassage(null)}
        />
      )}
    </div>
  );
}
