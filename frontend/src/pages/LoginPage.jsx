import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(email, password);
      console.log("Login response:", res.data);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1d23 0%, #2d3348 50%, #1a1d23 100%)',
      padding: 24,
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,110,247,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: -80, left: -80,
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--color-primary)', marginBottom: 16,
            fontSize: 24, boxShadow: '0 8px 24px rgba(79,110,247,0.4)',
          }}>
            ✏️
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Question Creator
          </h1>
          <p style={{ color: '#8b92a5', fontSize: 14, marginTop: 6 }}>
            Sign in to manage your question banks
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
          padding: 36,
        }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8b92a5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.com"
                required
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#fff', fontSize: 14,
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(79,110,247,0.6)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8b92a5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '12px 42px 12px 16px',
                    background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#fff', fontSize: 14,
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(79,110,247,0.6)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '55%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: '#8b92a5', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#8b92a5'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#3a4a8a' : 'var(--color-primary)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(79,110,247,0.35)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, color: '#4b5263', fontSize: 12 }}>
          Question Creator · Education Platform
        </p>
      </div>
    </div>
  );
}
