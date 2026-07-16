import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { syllabusAPI } from '../services/api';
import { useUpload } from '../store/UploadContext';

const CONTENT_AREAS = ['English Language Arts', 'Mathematics', 'Science'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const AREA_COLORS = {
  'English Language Arts': { bg: '#eef4ff', color: '#3b6fe0', dot: '#3b6fe0' },
  'Mathematics': { bg: '#faf5ff', color: '#7c3aed', dot: '#7c3aed' },
  'Science': { bg: '#f0fdf4', color: '#15803d', dot: '#15803d' },
};

export default function SyllabusPage() {
  const [syllabi, setSyllabi] = useState([]);
  const [loading, setLoading] = useState(true);
  const { uploading, activeUpload, uploadMsg, startUpload, clearUpload } = useUpload();
  const [deleting, setDeleting] = useState(null);
  const [contentArea, setContentArea] = useState(CONTENT_AREAS[0]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef();

  const fetchSyllabi = async () => {
    try {
      const res = await syllabusAPI.list();
      setSyllabi(res.data);
    } catch {
      setSyllabi([]);
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, filename }

  useEffect(() => {
    fetchSyllabi();
  }, []);

  // Automatically refresh list when background upload finishes successfully
  useEffect(() => {
    if (!uploading && uploadMsg && uploadMsg.type === 'success') {
      fetchSyllabi();
    }
  }, [uploading, uploadMsg]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      clearUpload();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      clearUpload();
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('content_area', contentArea);
    formData.append('grade', grade);

    const filename = selectedFile.name;
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    startUpload(formData, filename, contentArea, grade, () => {
      fetchSyllabi();
    });
  };

  const handleDeleteClick = (id, filename) => {
    setDeleteConfirm({ id, filename });
  };

  const confirmDeleteAction = async (id) => {
    setDeleting(id);
    try {
      await syllabusAPI.delete(id);
      setSyllabi(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  const grouped = CONTENT_AREAS.reduce((acc, area) => {
    acc[area] = syllabi.filter(s => s.content_area === area);
    return acc;
  }, {});

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          Knowledge Base Library
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          Upload syllabus and documents by Content Area and Grade to power AI question generation.
        </p>
      </div>

      {/* Background Indexing Status Banner */}
      {uploading && activeUpload && (
        <div style={{
          background: 'var(--color-primary-light, #eef1fe)',
          border: '1.5px solid var(--color-primary)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '3px solid rgba(79,110,247,0.2)', borderTopColor: 'var(--color-primary)',
              animation: 'spin 0.8s linear infinite', flexShrink: 0
            }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 14 }}>
                Indexing Knowledge Source in background...
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                File: <strong style={{ color: 'var(--color-text)' }}>{activeUpload.filename}</strong> | Area: {activeUpload.contentArea} | {activeUpload.grade}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Card */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: 'var(--shadow)',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
          Upload Knowledge Source
        </h2>

        {/* Selectors Row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Content Area
            </label>
            <select
              id="content-area-select"
              value={contentArea}
              onChange={e => {
                setContentArea(e.target.value);
                clearUpload();
              }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid var(--color-border)', fontSize: 14,
                background: 'var(--color-surface)', color: 'var(--color-text)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {CONTENT_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Grade
            </label>
            <select
              id="grade-select"
              value={grade}
              onChange={e => {
                setGrade(e.target.value);
                clearUpload();
              }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid var(--color-border)', fontSize: 14,
                background: 'var(--color-surface)', color: 'var(--color-text)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Drop Zone and Upload Button Row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 5 }}>
          {/* Drop Zone */}
          <div
            id="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            style={{
              flex: 1,
              border: `2px dashed ${dragOver ? 'var(--color-primary)' : selectedFile ? 'var(--color-success)' : 'var(--color-border)'}`,
              borderRadius: 10, padding: '20px 24px', textAlign: 'left',
              background: dragOver ? 'var(--color-primary-light)' : selectedFile ? '#f0fdf4' : '#fafbfc',
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <div style={{ fontSize: 26, flexShrink: 0 }}>
              {selectedFile ? '📄' : '☁️'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: selectedFile ? 'var(--color-success)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile ? selectedFile.name : 'Drop your syllabus here or click to browse'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : 'Supported formats: PDF, DOCX — Max 20 MB'}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Upload Button */}
          <button
            id="upload-btn"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: '11px 28px', background: !selectedFile || uploading ? '#c7d2fe' : 'var(--color-primary)',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
              boxShadow: !selectedFile || uploading ? 'none' : '0 4px 14px rgba(79,110,247,0.3)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              flexShrink: 0,
            }}
          >
            {uploading ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Indexing...
              </>
            ) : '⬆ Upload Knowledge Source'}
          </button>
        </div>

        {/* Upload Message */}
        {uploadMsg && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
            background: uploadMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: uploadMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            border: `1px solid ${uploadMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {uploadMsg.text}
          </div>
        )}
      </div>

      {/* Syllabi Table grouped by Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          Loading syllabi...
        </div>
      ) : syllabi.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>No syllabi uploaded yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Upload your first syllabus above to enable AI question generation.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {CONTENT_AREAS.map(area => {
            const items = grouped[area];
            if (!items || items.length === 0) return null;
            const meta = AREA_COLORS[area] || { bg: '#f8f9fb', color: '#4f6ef7', dot: '#4f6ef7' };
            return (
              <div key={area} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)',
              }}>
                {/* Section Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 20px', background: meta.bg,
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{area}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    background: meta.color, color: '#fff',
                    padding: '2px 8px', borderRadius: 12,
                  }}>{items.length} file{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 160px 80px',
                  padding: '10px 20px', background: '#f8f9fb',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--color-text-muted)',
                }}>
                  <span>Filename</span>
                  <span>Grade</span>
                  <span>Uploaded</span>
                  <span>Action</span>
                </div>

                {/* Rows */}
                {items.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 160px 80px',
                      padding: '13px 20px', alignItems: 'center',
                      borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>
                        {s.filename.endsWith('.pdf') ? '📕' : '📘'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.filename}
                      </span>
                    </div>
                    <div>
                      <span style={{
                        display: 'inline-flex', fontSize: 13, fontWeight: 600, color: meta.color,
                      }}>
                        {s.grade}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {formatDate(s.created_at)}
                    </div>
                    <div>
                      <button
                        onClick={() => handleDeleteClick(s.id, s.filename)}
                        disabled={deleting === s.id}
                        style={{
                          padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--color-border)', background: 'transparent',
                          fontSize: 12, cursor: 'pointer', color: 'var(--color-danger)',
                          transition: 'all 0.12s',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Delete syllabus"
                      >
                        {deleting === s.id ? '...' : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: '24px 28px', maxWidth: 420, width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, marginTop: 0 }}>
              Delete Knowledge Source
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 24 }}>
              Are you sure you want to delete <strong>"{deleteConfirm.filename}"</strong>? This will permanently remove all text embeddings and chapter indexing for this knowledge source.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: '1.5px solid #cbd5e1',
                  background: '#f8fafc', fontSize: 14, fontWeight: 600,
                  color: '#475569', cursor: 'pointer', outline: 'none',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = deleteConfirm.id;
                  setDeleteConfirm(null);
                  confirmDeleteAction(targetId);
                }}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--color-danger)', fontSize: 14, fontWeight: 600,
                  color: '#ffffff', cursor: 'pointer', outline: 'none',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}
