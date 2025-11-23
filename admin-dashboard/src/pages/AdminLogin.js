import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useThemeTokens } from '../hooks/useThemeTokens';
import { Shield, AlertCircle } from 'lucide-react';

const AdminLogin = () => {
  const tokens = useThemeTokens();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.background.app }} className="flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-in fade-in duration-500">
        <div style={{ backgroundColor: tokens.colors.background.layer2, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, boxShadow: tokens.shadow.floating, padding: '32px' }}>
          <div className="text-center mb-8">
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', backgroundColor: tokens.colors.accent.lime, borderRadius: '50%', marginBottom: '16px' }}>
              <Shield style={{ width: '32px', height: '32px', color: tokens.colors.text.inverse }} />
            </div>
            <h1 style={{ fontSize: '30px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, marginBottom: '8px' }}>
              Admin Dashboard
            </h1>
            <p style={{ color: tokens.colors.text.secondary, fontWeight: 300 }}>
              LinkedPilot Admin Access
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: '24px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: tokens.radius.lg, padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }} className="animate-in fade-in duration-300">
              <AlertCircle style={{ width: '20px', height: '20px', color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', color: '#EF4444', fontWeight: 500 }}>Login Failed</p>
                <p style={{ fontSize: '14px', color: '#FCA5A5', marginTop: '4px' }}>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: tokens.colors.background.input,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  borderRadius: tokens.radius.lg,
                  fontFamily: tokens.typography.fontFamily.sans,
                  fontSize: '14px'
                }}
                className="placeholder:opacity-60 outline-none transition"
                placeholder="admin@mandi.media"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.border.default;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: tokens.colors.background.input,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  borderRadius: tokens.radius.lg,
                  fontFamily: tokens.typography.fontFamily.sans,
                  fontSize: '14px'
                }}
                className="placeholder:opacity-60 outline-none transition"
                placeholder="••••••••"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.border.default;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: tokens.colors.accent.lime,
                color: tokens.colors.text.inverse,
                padding: '12px',
                borderRadius: tokens.radius.lg,
                fontWeight: 500,
                fontSize: '14px',
                fontFamily: tokens.typography.fontFamily.sans
              }}
              className="transition disabled:opacity-50 disabled:cursor-not-allowed"
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = tokens.colors.accent.lime;
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${tokens.colors.border.default}` }}>
            <p style={{ textAlign: 'center', fontSize: '14px', color: tokens.colors.text.tertiary, fontWeight: 300 }}>
              Admin access only. Unauthorized access is prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
