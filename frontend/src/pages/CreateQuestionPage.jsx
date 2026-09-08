import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { questionsAPI } from '../services/api';

// Import components from the storybook-ui library
import { QuestionCreator, QuestionPreview } from 'question-storybook-ui';

export default function CreateQuestionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);

  const [mode, setMode] = useState(location.state?.startInPreview ? 'preview' : 'create'); // 'create' | 'preview'
  const [previewData, setPreviewData] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load question data when editing
  useEffect(() => {
    if (!isEditing) return;
    questionsAPI.getById(id)
      .then(res => {
        setInitialData(res.data);
        setPreviewData(res.data);
      })
      .catch(() => { setErrorMsg('Failed to load question'); })
      .finally(() => setLoadingEdit(false));
  }, [id, isEditing]);

  const handleSave = async (payload, targetStatus = null) => {
    setErrorMsg('');
    try {
      const finalStatus = targetStatus || payload.status || initialData?.status || 'ready_for_review';
      const fullPayload = { ...payload, status: finalStatus };

      if (isEditing) {
        const res = await questionsAPI.update(id, fullPayload);
        const updatedQ = res.data || fullPayload;
        setSuccessMsg(targetStatus === 'approved' ? 'Question approved and moved to Final Bank!' : 'Question updated successfully!');
        setInitialData(updatedQ);
        setPreviewData(updatedQ);
        if (targetStatus === 'approved' || targetStatus === 'rejected') {
          setTimeout(() => navigate('/dashboard'), 1000);
        }
      } else {
        const res = await questionsAPI.create(fullPayload);
        setSuccessMsg('Question saved to Ready for Review!');
        const savedQ = res.data;
        setInitialData(savedQ);
        setPreviewData(savedQ);
        navigate(`/edit/${savedQ.id}`, { replace: true });
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save question');
      throw err; // re-throw so QuestionCreator knows save failed
    }
  };

  const handleApprove = async (payload) => {
    await handleSave(payload, 'approved');
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      await questionsAPI.updateStatus(id, 'rejected');
      setSuccessMsg('Question marked as rejected.');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to reject question');
    }
  };

  const handlePreview = (payload) => {
    setPreviewData(payload);
    setInitialData(payload);
    setMode('preview');
  };

  const handleClose = () => navigate('/dashboard');

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {isEditing ? 'Edit Question' : 'Create Question'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
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
              key={initialData?.id || 'create'}
              initialData={initialData}
              onSave={handleSave}
              onSaveAndAccept={isEditing && initialData?.status === 'ready_for_review' ? handleApprove : undefined}
              onReject={isEditing ? handleReject : undefined}
              onClose={handleClose}
              onPreview={handlePreview}
            />
          ) : (
            /* ── QuestionPreview from storybook-ui ── */
            <QuestionPreview
              question={previewData}
              onBack={location.state?.startInPreview ? () => navigate('/dashboard') : () => setMode('create')}
              backLabel={location.state?.startInPreview ? 'Go to Dashboard' : 'Back to Editor'}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
