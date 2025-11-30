import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { signup, user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) {
      // New users should always go to onboarding first
      // Only redirect to dashboard if they've somehow completed onboarding (shouldn't happen for new signups)
      if (user.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signup(formData.email, formData.password, formData.full_name);
    
    if (result.success) {
      // New signups should always go to onboarding
      navigate('/onboarding');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
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
      <div className="grid md:grid-cols-2 max-w-5xl w-full bg-card rounded-2xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Auth Card - Left Side */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-card">
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: '8px',
              letterSpacing: '-0.5px'
            }}>
              Sign up
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#4A4A4A',
              lineHeight: 1.6,
              marginBottom: '4px'
            }}>
              Create an account to start managing your social media. Have an account already?{' '}
              <Link 
                to="/login" 
                style={{
                  color: '#7FDBCB',
                  textDecoration: 'underline',
                  fontWeight: 500
                }}
              >
                Log in here
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {error && (
              <div data-testid="signup-error" style={{
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
              <label htmlFor="full_name" style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A',
                marginBottom: '4px'
              }}>
                Full name
              </label>
              <input
                id="full_name"
                data-testid="signup-name-input"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter your full name"
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
                data-testid="signup-email-input"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
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
                data-testid="signup-password-input"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="confirmPassword" style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#1A1A1A',
                marginBottom: '4px'
              }}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                data-testid="signup-confirm-password-input"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
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
              data-testid="signup-submit-btn"
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
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>

            <div style={{
              fontSize: '11px',
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 1.6,
              marginTop: '8px'
            }}>
              By signing up you agree to SocialFlow's Privacy Policy and Terms of Service
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

export default Signup;