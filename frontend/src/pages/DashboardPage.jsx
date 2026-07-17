import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { questionsAPI } from '../services/api';

const TYPE_LABELS = {
  SINGLE_SELECT: { label: 'Multiple Choice (Single)', color: '#4f6ef7', bg: '#eef1fe' },
  MULTIPLE_SELECT: { label: 'Multiple Choice (Multiple)', color: '#3b82f6', bg: '#dbeafe' },
  MCQ: { label: 'MCQ (Legacy)', color: '#4f6ef7', bg: '#eef1fe' },
  TRUE_FALSE: { label: 'True / False', color: '#22c55e', bg: '#f0fdf4' },
  CONSTRUCTED_RESPONSE: { label: 'Constructed Response', color: '#7c3aed', bg: '#f5f3ff' },
  DROPDOWN: { label: 'Dropdown', color: '#0e7490', bg: '#ecfeff' },
  MATCHING_LINES: { label: 'Matching Lines', color: '#0891b2', bg: '#ecfeff' },
  ORDERING: { label: 'Ordering', color: '#db2777', bg: '#fdf2f8' },
  // Legacy / Hidden types (still supported for rendering existing data):
  SHORT_ANSWER: { label: 'Short Answer', color: '#f59e0b', bg: '#fffbeb' },
  FILL_IN_BLANK: { label: 'Fill in Blank', color: '#9ca3af', bg: '#f9fafb' },
};

const ACTIVE_TYPES = ['SINGLE_SELECT', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'CONSTRUCTED_RESPONSE', 'DROPDOWN', 'MATCHING_LINES', 'ORDERING'];

const SHORT_LABELS = {
  SINGLE_SELECT: 'MCQ (Single)',
  MULTIPLE_SELECT: 'MCQ (Multi)',
  MCQ: 'MCQ (Legacy)',
  TRUE_FALSE: 'True / False',
  CONSTRUCTED_RESPONSE: 'Constructed',
  DROPDOWN: 'Dropdown',
  MATCHING_LINES: 'Matching',
  ORDERING: 'Ordering',
};

const DIFFICULTY_COLORS = {
  easy: { color: '#15803d', bg: '#f0fdf4' },
  medium: { color: '#92400e', bg: '#fffbeb' },
  hard: { color: '#991b1b', bg: '#fef2f2' },
};

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const fetchQuestions = async () => {
    try {
      const res = await questionsAPI.getAll();
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, title }

  useEffect(() => { fetchQuestions(); }, []);

  const handleDeleteClick = (id, text) => {
    // Truncate text for prompt display if too long
    const cleanText = text.length > 60 ? text.substring(0, 57) + '...' : text;
    setDeleteConfirm({ id, title: `"${cleanText}"` });
  };

  const confirmDeleteAction = async (id) => {
    setDeleting(id);
    try {
      await questionsAPI.delete(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Failed to delete question:', err);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = questions.filter(q => {
    const matchType = filter === 'ALL' || q.type === filter;
    const matchSearch = q.text.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Reset to page 1 whenever filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Page numbers to render (up to 5, centred around current page)
  const pageNumbers = (() => {
    const delta = 2;
    const start = Math.max(1, safePage - delta);
    const end = Math.min(totalPages, safePage + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Question Bank
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
            Total Question{questions.length !== 1 ? 's' : ''}: {questions.length}
          </p>
        </div>
        <button
          onClick={() => navigate('/create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', background: 'var(--color-primary)',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79,110,247,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-dark)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.transform = 'none'; }}
        >
          + New Question
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, marginBottom: 28 }}>
        {/* All Questions Card */}
        <div
          onClick={() => setFilter('ALL')}
          style={{
            background: filter === 'ALL' ? 'var(--color-primary-light)' : 'var(--color-surface)',
            border: `1.5px solid ${filter === 'ALL' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: filter === 'ALL' ? '0 4px 12px rgba(79,110,247,0.15)' : 'var(--shadow)',
            cursor: 'pointer',
            transition: 'all 0.15s ease-in-out',
          }}
          onMouseEnter={(e) => {
            if (filter !== 'ALL') {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.background = 'var(--color-primary-light)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (filter !== 'ALL') {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.background = 'var(--color-surface)';
              e.currentTarget.style.transform = 'none';
            }
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{questions.length}</span>
            {filter === 'ALL' && <span style={{ fontSize: 12 }}>🎯</span>}
          </div>
          <div style={{ fontSize: 11, color: filter === 'ALL' ? 'var(--color-text)' : 'var(--color-text-muted)', marginTop: 4, fontWeight: filter === 'ALL' ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            All
          </div>
        </div>

        {ACTIVE_TYPES.map(type => {
          const meta = TYPE_LABELS[type];
          const isActive = filter === type;
          return (
            <div
              key={type}
              onClick={() => setFilter(isActive ? 'ALL' : type)}
              style={{
                background: isActive ? meta.bg : 'var(--color-surface)',
                border: `1.5px solid ${isActive ? meta.color : 'var(--color-border)'}`,
                borderRadius: 8,
                padding: '12px 14px',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'var(--shadow)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = meta.color;
                  e.currentTarget.style.background = `${meta.bg}22`; // very faint light background
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-surface)';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{questions.filter(q => q.type === type).length}</span>
                {isActive && <span style={{ fontSize: 12 }}>🎯</span>}
              </div>
              <div style={{ fontSize: 11, color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)', marginTop: 4, fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SHORT_LABELS[type] || meta.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '9px 14px',
            border: '1.5px solid var(--color-border)', borderRadius: 8,
            fontSize: 14, outline: 'none', background: 'var(--color-surface)',
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '9px 36px 9px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text)', outline: 'none', cursor: 'pointer',
            appearance: 'none', minWidth: 200,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
          }}
        >
          <option value="ALL">All Question Types</option>
          {ACTIVE_TYPES.map(value => {
            const meta = TYPE_LABELS[value];
            return (
              <option key={value} value={value}>{meta.label}</option>
            );
          })}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'clip', boxShadow: 'var(--shadow)', width: '100%', minWidth: 0 }}>
        {/* Table Header — always visible, never scrolls */}
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 140px 100px 60px 70px 80px',
          padding: '12px 20px', background: '#f8f9fb',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}>
          <span>ID</span>
          <span>Question</span>
          <span>Type</span>
          <span>Difficulty</span>
          <span>Points</span>
          <span>Preview</span>
          <span>Actions</span>
        </div>

        {/* Scrollable body */}
        <div style={{ maxHeight: 'calc(100vh - 335px)', minHeight: 140, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading questions...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 600 }}>No questions found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {questions.length === 0 ? 'Create your first question to get started' : 'Try changing the filters'}
              </div>
            </div>
          ) : (
            paged.map((q, i) => {
              const typeMeta = TYPE_LABELS[q.type] || {};
              const diffMeta = DIFFICULTY_COLORS[q.difficulty] || DIFFICULTY_COLORS.medium;
              return (
                <div
                  key={q.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 140px 100px 60px 70px 80px',
                    padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < paged.length - 1 ? '1px solid var(--color-border)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Question ID — first column */}
                  <div style={{ paddingRight: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                      display: 'inline-block',
                      maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={q.id}>
                      {q.id}
                    </span>
                  </div>
                  <div style={{ paddingRight: 16, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.text}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: typeMeta.color }}>
                      {typeMeta.label}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: diffMeta.color, textTransform: 'capitalize' }}>
                      {q.difficulty}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {q.points} pt{q.points !== 1 ? 's' : ''}
                  </div>
                  <div>
                    <button
                      onClick={() => navigate(`/edit/${q.id}`, { state: { startInPreview: true } })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        fontSize: 14,
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eef2ff';
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                      }}
                      title="Preview question"
                    >
                      👁️
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => navigate(`/edit/${q.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      title="Edit"
                    >✏️</button>
                    <button
                      onClick={() => handleDeleteClick(q.id, q.text)}
                      disabled={deleting === q.id}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Delete"
                    >
                      {deleting === q.id ? '...' : (
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
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, flexWrap: 'wrap', gap: 12,
        }}>
          {/* Showing X–Y of Z */}
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>

          {/* Page buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Previous */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={pageBtnStyle(false, safePage === 1)}
            >← Prev</button>

            {/* First page if not visible */}
            {pageNumbers[0] > 1 && (
              <>
                <button onClick={() => setPage(1)} style={pageBtnStyle(safePage === 1, false)}>1</button>
                {pageNumbers[0] > 2 && <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>…</span>}
              </>
            )}

            {/* Page number buttons */}
            {pageNumbers.map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={pageBtnStyle(n === safePage, false)}
              >{n}</button>
            ))}

            {/* Last page if not visible */}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>…</span>}
                <button onClick={() => setPage(totalPages)} style={pageBtnStyle(safePage === totalPages, false)}>{totalPages}</button>
              </>
            )}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={pageBtnStyle(false, safePage === totalPages)}
            >Next →</button>
          </div>
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
              Confirm Deletion
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 24 }}>
              Are you sure you want to delete this question {deleteConfirm.title}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: '1px solid var(--color-border)',
                  background: 'transparent', fontSize: 14, fontWeight: 600,
                  color: 'var(--color-text)', cursor: 'pointer', outline: 'none',
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
    </Layout>
  );
}

/** Helper: styles for pagination buttons */
function pageBtnStyle(active, disabled) {
  return {
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    border: active ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : disabled ? '#cbd5e1' : 'var(--color-text-muted)',
    transition: 'all 0.12s',
    opacity: disabled ? 0.5 : 1,
  };
}
