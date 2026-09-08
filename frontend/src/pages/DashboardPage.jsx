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
  GAP_MATCH: { label: 'Gap Match', color: '#2563eb', bg: '#eff6ff' },
  MULTIPLE_DROP_BUCKET: { label: 'Multiple Drop Bucket', color: '#0284c7', bg: '#f0f9ff' },
  MATRIX_INTERACTION: { label: 'Matrix Interaction', color: '#16a34a', bg: '#f0fdf4' },
  SELECT_TEXT: { label: 'Select Text', color: '#7c3aed', bg: '#f5f3ff' },
  BACKGROUND_GRAPHIC: { label: 'Background Graphic', color: '#059669', bg: '#ecfdf5' },
  // Legacy / Hidden types (still supported for rendering existing data):
  SHORT_ANSWER: { label: 'Short Answer', color: '#f59e0b', bg: '#fffbeb' },
  FILL_IN_BLANK: { label: 'Fill in Blank', color: '#9ca3af', bg: '#f9fafb' },
};

const ACTIVE_TYPES = [
  'SINGLE_SELECT',
  'MULTIPLE_SELECT',
  'TRUE_FALSE',
  'CONSTRUCTED_RESPONSE',
  'DROPDOWN',
  'MATCHING_LINES',
  'ORDERING',
  'GAP_MATCH',
  'MULTIPLE_DROP_BUCKET',
  'MATRIX_INTERACTION',
  'SELECT_TEXT',
  // 'BACKGROUND_GRAPHIC',
];

const SHORT_LABELS = {
  SINGLE_SELECT: 'MCQ (Single)',
  MULTIPLE_SELECT: 'MCQ (Multi)',
  MCQ: 'MCQ (Legacy)',
  TRUE_FALSE: 'True / False',
  CONSTRUCTED_RESPONSE: 'Constructed',
  DROPDOWN: 'Dropdown',
  MATCHING_LINES: 'Matching',
  ORDERING: 'Ordering',
  GAP_MATCH: 'Gap Match',
  MULTIPLE_DROP_BUCKET: 'Multiple Drop Bucket',
  MATRIX_INTERACTION: 'Matrix Interaction',
  SELECT_TEXT: 'Select Text',
  BACKGROUND_GRAPHIC: 'Background Graphic',
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
  const [tab, setTab] = useState('ready_for_review'); // 'ready_for_review' | 'approved'
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
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

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      await questionsAPI.updateStatus(id, 'approved');
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: 'approved' } : q));
    } catch (err) {
      console.error('Failed to approve question:', err);
      alert(err.response?.data?.message || 'Failed to approve question.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id) => {
    setRejectingId(id);
    try {
      await questionsAPI.updateStatus(id, 'rejected');
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: 'rejected' } : q));
    } catch (err) {
      console.error('Failed to reject question:', err);
      alert(err.response?.data?.message || 'Failed to reject question.');
    } finally {
      setRejectingId(null);
    }
  };

  const handleApproveAllInView = async () => {
    const toApprove = filtered.filter(q => q.status !== 'approved');
    if (toApprove.length === 0) return;
    for (const q of toApprove) {
      try {
        await questionsAPI.updateStatus(q.id, 'approved');
      } catch (_) {}
    }
    setQuestions(prev => prev.map(q => toApprove.some(a => a.id === q.id) ? { ...q, status: 'approved' } : q));
  };

  // Separate questions by review vs approved (exclude rejected and draft from active lists)
  const reviewQuestions = questions.filter(
    q => q.status === 'ready_for_review' || (!q.status && q.status !== 'approved' && q.status !== 'rejected' && q.status !== 'draft')
  );
  const approvedQuestions = questions.filter(q => q.status === 'approved');

  const currentTabQuestions = tab === 'ready_for_review' ? reviewQuestions : approvedQuestions;

  const filtered = currentTabQuestions.filter(q => {
    const matchType = filter === 'ALL' || q.type === filter;
    const matchSearch = q.text.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Reset to page 1 whenever tab, filter or search changes
  useEffect(() => { setPage(1); }, [tab, filter, search]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Question Bank
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
            Manage, review, and organize assessment questions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/ai-generate')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', background: '#f5f3ff',
              border: '1px solid #ddd6fe', borderRadius: 8, color: '#7c3aed',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ede9fe'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f3ff'; }}
          >
            ✨ Generate with AI
          </button>
          <button
            onClick={() => navigate('/create')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', background: 'var(--color-primary)',
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
      </div>

      {/* ─── Top 2 Tabs: Ready for Review & Approved Questions ─── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid var(--color-border)', paddingBottom: 0 }}>
        <button
          id="tab-ready-for-review"
          className="tab-btn"
          onClick={() => { setTab('ready_for_review'); setFilter('ALL'); setPage(1); }}
          style={{
            padding: '9px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: tab === 'ready_for_review' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: tab === 'ready_for_review' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontSize: 13.5,
            fontWeight: tab === 'ready_for_review' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'color 0.15s, border-bottom 0.15s',
            marginBottom: -2,
            outline: 'none',
          }}
        >
          <span>📋 Ready for Review Questions</span>
          <span style={{
            background: tab === 'ready_for_review' ? 'var(--color-primary-light)' : '#f1f5f9',
            color: tab === 'ready_for_review' ? 'var(--color-primary)' : '#64748b',
            padding: '2px 7px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
          }}>
            {reviewQuestions.length}
          </span>
        </button>

        <button
          id="tab-approved-questions"
          className="tab-btn"
          onClick={() => { setTab('approved'); setFilter('ALL'); setPage(1); }}
          style={{
            padding: '9px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: tab === 'approved' ? '3px solid #16a34a' : '3px solid transparent',
            color: tab === 'approved' ? '#16a34a' : 'var(--color-text-muted)',
            fontSize: 13.5,
            fontWeight: tab === 'approved' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'color 0.15s, border-bottom 0.15s',
            marginBottom: -2,
            outline: 'none',
          }}
        >
          <span>🏆 Approved Questions</span>
          <span style={{
            background: tab === 'approved' ? '#dcfce7' : '#f1f5f9',
            color: tab === 'approved' ? '#16a34a' : '#64748b',
            padding: '2px 7px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
          }}>
            {approvedQuestions.length}
          </span>
        </button>
      </div>

      {/* Stats Row (Filtered by Active Tab) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 12, marginBottom: 24 }}>
        {/* All in Tab Card */}
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
            <span>{currentTabQuestions.length}</span>
            {filter === 'ALL' && <span style={{ fontSize: 12 }}>🎯</span>}
          </div>
          <div style={{ fontSize: 11, color: filter === 'ALL' ? 'var(--color-text)' : 'var(--color-text-muted)', marginTop: 4, fontWeight: filter === 'ALL' ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            All {tab === 'ready_for_review' ? 'Pending' : 'Approved'}
          </div>
        </div>

        {ACTIVE_TYPES.map(type => {
          const meta = TYPE_LABELS[type];
          const isActive = filter === type;
          const count = currentTabQuestions.filter(q => q.type === type).length;
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
                  e.currentTarget.style.background = `${meta.bg}22`;
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
                <span>{count}</span>
                {isActive && <span style={{ fontSize: 12 }}>🎯</span>}
              </div>
              <div style={{ fontSize: 11, color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)', marginTop: 4, fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SHORT_LABELS[type] || meta.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Action Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280 }}>
          <input
            placeholder={`Search ${tab === 'ready_for_review' ? 'ready for review' : 'approved'} questions...`}
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

        {tab === 'ready_for_review' && filtered.length > 0 && (
          <button
            onClick={handleApproveAllInView}
            style={{
              padding: '9px 18px',
              background: '#16a34a',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s',
            }}
          >
            ✓ Approve All Filtered ({filtered.length}) items
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'var(--shadow)',
        width: '100%',
        maxHeight: 'calc(100vh - 365px)',
        minHeight: 140,
        overflowY: 'auto',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading questions...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {tab === 'ready_for_review' ? '🎉' : '📭'}
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {tab === 'ready_for_review' ? 'No pending questions for review' : 'No approved questions found'}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {tab === 'ready_for_review'
                ? 'All questions have been approved or rejected.'
                : 'Approve questions from Ready for Review to add them to your final bank.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fb' }}>
              <tr style={{
                borderBottom: '1px solid var(--color-border)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}>
                <th style={{ padding: '12px 16px', width: 65, textAlign: 'left' }}>ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Question</th>
                <th style={{ padding: '12px 16px', width: 180, textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px 16px', width: 105, textAlign: 'left' }}>Difficulty</th>
                <th style={{ padding: '12px 16px', width: 85, textAlign: 'center' }}>Points</th>
                <th style={{ padding: '12px 16px', width: 85, textAlign: 'center' }}>Preview</th>
                <th style={{ padding: '12px 16px', width: 95, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((q, i) => {
                const typeMeta = TYPE_LABELS[q.type] || {};
                const diffMeta = DIFFICULTY_COLORS[q.difficulty] || DIFFICULTY_COLORS.medium;

                return (
                  <tr
                    key={q.id}
                    style={{
                      borderBottom: i < paged.length - 1 ? '1px solid var(--color-border)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* ID */}
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={q.id}>
                      {q.id}
                    </td>

                    {/* Question */}
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={q.text}>
                      {q.text}
                    </td>

                    {/* Type */}
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: typeMeta.color,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {typeMeta.label}
                    </td>

                    {/* Difficulty */}
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: diffMeta.color,
                      textTransform: 'capitalize',
                      whiteSpace: 'nowrap',
                    }}>
                      {q.difficulty}
                    </td>

                    {/* Points */}
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      {q.points} pt{q.points !== 1 ? 's' : ''}
                    </td>

                    {/* Preview */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/edit/${q.id}`, { state: { startInPreview: true } })}
                        style={{
                          padding: '5px 9px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'transparent',
                          fontSize: 13,
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
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => navigate(`/edit/${q.id}`)}
                          style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => handleDeleteClick(q.id, q.text)}
                          disabled={deleting === q.id}
                          style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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

