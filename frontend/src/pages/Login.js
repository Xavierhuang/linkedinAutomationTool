import React, { useState, useEffect, useRef } from 'react';
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
  const justLoggedIn = useRef(false);

  // Only redirect if user just logged in (not on initial page load)
  useEffect(() => {
    if (justLoggedIn.current && user) {
      // User just logged in, redirect based on onboarding status
      setLoading(false); // Stop loading spinner
      if (user.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
      justLoggedIn.current = false; // Reset flag
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      // Set flag to indicate user just logged in
      justLoggedIn.current = true;
      // useEffect will handle the redirect once user state is updated
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[60px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl w-full relative z-10 animate-in fade-in duration-500">
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left Side - Login Form */}
            <div className="p-8 md:p-12 flex flex-col justify-center">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center overflow-hidden">
                    <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-foreground text-lg font-serif italic">LinkedIn Pilot</span>
                </div>
                <h1 className="text-4xl font-serif italic text-foreground mb-3">
                  Log in
                </h1>
                <p className="text-muted-foreground font-light text-sm">
                  Welcome back! Enter your details to access your account.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div 
                    data-testid="login-error"
                    className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive text-sm animate-in fade-in duration-300"
                  >
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label 
                    htmlFor="email" 
                    className="block text-sm font-medium text-muted-foreground"
                  >
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
                    className="w-full px-4 py-3 bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="space-y-2">
                  <label 
                    htmlFor="password" 
                    className="block text-sm font-medium text-muted-foreground"
                  >
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
                    className="w-full px-4 py-3 bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                  />
                </div>

                <button
                  data-testid="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Logging in...' : 'Log In'}
                </button>

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link 
                      to="/signup" 
                      data-testid="login-signup-link"
                      className="text-primary hover:text-primary/80 underline font-medium transition"
                    >
                      Sign up here
                    </Link>
                  </p>
                </div>
              </form>
            </div>

            {/* Right Side - Brand Panel */}
            <div className="bg-gradient-to-br from-card to-secondary border-l border-border p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] opacity-20">
                <div className="w-full h-full border border-primary/30 rounded-full"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <h2 className="text-3xl font-serif italic text-foreground mb-4 leading-tight">
                  Transform Your Social Media Presence
                </h2>
                <p className="text-muted-foreground font-light leading-relaxed">
                  Schedule posts, create stunning content, and analyze performance—all from one powerful platform.
                </p>
              </div>

              {/* Support */}
              <div className="relative z-10 mt-auto pt-8">
                <p className="text-sm text-muted-foreground/60 mb-2 font-light">
                  Need help?
                </p>
                <Link 
                  to="/" 
                  className="text-sm text-primary hover:text-primary/80 underline font-medium transition"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
