import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateQuestionPage from './pages/CreateQuestionPage';
import SyllabusPage from './pages/SyllabusPage';
import AIGeneratePage from './pages/AIGeneratePage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (!token || !user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><CreateQuestionPage /></PrivateRoute>} />
        <Route path="/edit/:id" element={<PrivateRoute><CreateQuestionPage /></PrivateRoute>} />
        <Route path="/syllabus" element={<PrivateRoute><SyllabusPage /></PrivateRoute>} />
        <Route path="/ai-generate" element={<PrivateRoute><AIGeneratePage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}