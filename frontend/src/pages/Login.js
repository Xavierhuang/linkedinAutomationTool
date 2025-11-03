import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000428 0%, #001645 50%, #00142E 100%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Effects */}
      <div className="floating-bg" style={{
        position: 'absolute',
        top: '-10%',
        left: '-5%',
        width: '400px',
        height: '400px',
        background: 'linear-gradient(135deg, rgba(127, 219, 203, 0.15), rgba(91, 196, 179, 0.1))',
        filter: 'blur(60px)',
        borderRadius: '50%'
      }}></div>
      
      <div className="floating-bg" style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: '500px',
        height: '500px',
        background: 'linear-gradient(135deg, rgba(127, 219, 203, 0.1), rgba(168, 230, 217, 0.15))',
        filter: 'blur(80px)',
        borderRadius: '50%',
        animationDirection: 'reverse'
      }}></div>

      {/* Abstract curved lines */}
      <svg style={{
        position: 'absolute',
        top: '10%',
        left: '5%',
        width: '200px',
        height: '200px',
        opacity: 0.6
      }}>
        <path d="M20,100 Q60,20 100,100 T180,100" stroke="#7FDBCB" strokeWidth="2" fill="none" 
          style={{ filter: 'drop-shadow(0 0 8px rgba(127, 219, 203, 0.6))' }} />
      </svg>

      <svg style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: '250px',
        height: '250px',
        opacity: 0.4
      }}>
        <path d="M30,125 Q90,40 150,125 T250,125" stroke="#A8E6D9" strokeWidth="2" fill="none" 
          style={{ filter: 'drop-shadow(0 0 10px rgba(168, 230, 217, 0.5))' }} />
      </svg>

      {/* Main Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        maxWidth: '1000px',
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        zIndex: 1
      }} className="auth-container">
        
        {/* Auth Card - Left Side */}
        <div style={{
          padding: '64px 48px',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: '8px',
              letterSpacing: '-0.5px'
            }}>
              Log in
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#4A4A4A',
              lineHeight: 1.6,
              marginBottom: '4px'
            }}>
              Welcome back! Enter your details to access your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {error && (
              <div data-testid="login-error" style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="email" style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A',
                marginBottom: '4px'
              }}>
                Email address
              </label>
              <input
                id="email"
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7FDBCB';
                  e.target.style.boxShadow = '0 0 0 3px rgba(127, 219, 203, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E5E5';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="password" style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A',
                marginBottom: '4px'
              }}>
                Password
              </label>
              <input
                id="password"
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7FDBCB';
                  e.target.style.boxShadow = '0 0 0 3px rgba(127, 219, 203, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E5E5';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#FFFFFF',
                background: 'linear-gradient(135deg, #7FDBCB 0%, #5BC4B3 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(127, 219, 203, 0.3)',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(127, 219, 203, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(127, 219, 203, 0.3)';
              }}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <p style={{ fontSize: '14px', color: '#4A4A4A' }}>
                Don't have an account?{' '}
                <Link 
                  to="/signup" 
                  data-testid="login-signup-link"
                  style={{
                    color: '#7FDBCB',
                    textDecoration: 'underline',
                    fontWeight: 500
                  }}
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Brand Panel - Right Side */}
        <div className="brand-panel" style={{
          padding: '64px 48px',
          background: 'linear-gradient(135deg, #000428 0%, #001645 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative glowing curve */}
          <svg style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            opacity: 0.6
          }} className="glow-animation">
            <path d="M50,150 Q100,50 150,150 T250,150" stroke="#7FDBCB" strokeWidth="2" fill="none" />
            <path d="M50,180 Q100,80 150,180 T250,180" stroke="#A8E6D9" strokeWidth="2" fill="none" />
          </svg>

          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '48px',
            position: 'relative',
            zIndex: 1
          }}>
            <Zap className="w-8 h-8 text-white" />
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#FFFFFF'
            }}>
              SocialFlow
            </span>
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.3,
              marginBottom: '16px',
              letterSpacing: '-0.5px'
            }}>
              Transform Your Social Media Presence
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.6
            }}>
              Schedule posts, create stunning content, and analyze performance—all from one powerful platform.
            </p>
          </div>

          {/* Support */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '48px',
            position: 'relative',
            zIndex: 1
          }}>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px'
            }}>
              Need help?
            </p>
            <Link 
              to="/" 
              style={{
                fontSize: '14px',
                color: '#7FDBCB',
                textDecoration: 'underline',
                fontWeight: 500
              }}
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;