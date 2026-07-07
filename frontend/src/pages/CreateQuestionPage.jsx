import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { questionsAPI } from '../services/api';

// Import components from the storybook-ui library
import { QuestionCreator, QuestionPreview } from 'question-storybook-ui';

export default function CreateQuestionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [mode, setMode] = useState('create'); // 'create' | 'preview'
  const [previewData, setPreviewData] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load question data when editing
  useEffect(() => {
    if (!isEditing) return;
    questionsAPI.getById(id)
      .then(res => setInitialData(res.data))
      .catch(() => { setErrorMsg('Failed to load question'); })
      .finally(() => setLoadingEdit(false));
  }, [id]);

  const handleSave = async (payload) => {
    setErrorMsg('');
    try {
      if (isEditing) {
        await questionsAPI.update(id, payload);
        setSuccessMsg('Question updated successfully!');
      } else {
        await questionsAPI.create(payload);
        setSuccessMsg('Question saved successfully!');
      }
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save question');
      throw err; // re-throw so QuestionCreator knows save failed
    }
  };

  const handlePreview = (payload) => {
    setPreviewData(payload);
    setMode('preview');
  };

  const handleClose = () => navigate('/dashboard');

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {isEditing ? 'Edit Question' : 'Create Question'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {isEditing ? 'Update the question details below' : 'Choose a type and fill in the details'}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#15803d', fontSize: 13, fontWeight: 500 }}>
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          {errorMsg}
        </div>
      )}

      {loadingEdit ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          Loading question...
        </div>
      ) : (
        <div style={{ maxWidth: 1800, width: '100%' }}>
          {mode === 'create' ? (
            /* ── QuestionCreator from storybook-ui ── */
            <QuestionCreator
              initialData={initialData}
              onSave={handleSave}
              onClose={handleClose}
              onPreview={handlePreview}
            />
          ) : (
            /* ── QuestionPreview from storybook-ui ── */
            <QuestionPreview
              question={previewData}
              onBack={() => setMode('create')}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
