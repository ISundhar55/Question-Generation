import { createContext, useContext, useState, useRef } from 'react';
import { syllabusAPI } from '../services/api';

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [uploading, setUploading] = useState(false);
  const [activeUpload, setActiveUpload] = useState(null); // { filename, contentArea, grade }
  const [uploadMsg, setUploadMsg] = useState(null); // { type: 'success' | 'error', text }
  const uploadInProgress = useRef(false);

  const startUpload = async (formData, filename, contentArea, grade, onSuccess) => {
    if (uploadInProgress.current) return;
    
    uploadInProgress.current = true;
    setUploading(true);
    setActiveUpload({ filename, contentArea, grade });
    setUploadMsg(null);

    try {
      const res = await syllabusAPI.upload(formData);
      const d = res.data;
      const text = d.recovered
        ? `🔄 ${d.message} (${d.chunks_indexed} chunks already indexed)`
        : `✅ ${d.message} (${d.chunks_indexed} chunks indexed)`;
      
      setUploadMsg({ type: 'success', text });
      setActiveUpload(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed. Please try again.';
      setUploadMsg({ type: 'error', text: `❌ ${msg}` });
    } finally {
      setUploading(false);
      uploadInProgress.current = false;
    }
  };

  const clearUpload = () => {
    setUploadMsg(null);
    setActiveUpload(null);
  };

  return (
    <UploadContext.Provider value={{ uploading, activeUpload, uploadMsg, startUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export const useUpload = () => useContext(UploadContext);
