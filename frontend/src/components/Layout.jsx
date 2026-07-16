import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'New Question', path: '/create', icon: '➕' },
  { label: 'Knowledge Base', path: '/syllabus', icon: '📚' },
  { label: 'AI Generate', path: '/ai-generate', icon: '✨' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--color-sidebar)', display: 'flex',
        flexDirection: 'column', padding: '28px 0', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>✏️</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Quizbot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '20px 12px' }}>
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: active ? 'rgba(79,110,247,0.15)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-sidebar-text)',
                  fontWeight: active ? 600 : 400, fontSize: 14,
                  transition: 'all 0.12s',
                  borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                }}
                onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '20px 12px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ color: '#a9abafff', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px 12px', background: 'var(--color-primary)',
              border: '1.5px solid var(--color-primary)', borderRadius: 6,
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.color = '#fff';
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, padding: '20px 32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
