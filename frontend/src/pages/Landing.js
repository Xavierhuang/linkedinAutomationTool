import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, Twitter, Instagram, Facebook, Clock, Users, Calendar, BarChart3, Sparkles, CheckCircle, Star, ArrowRight, Menu, X, Zap, TrendingUp, Shield } from 'lucide-react';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const Landing = () => {
  const navigate = useNavigate();
  const tokens = useThemeTokens();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Theme is now managed by ThemeProvider - no need to force dark mode

  // Scroll animations with Intersection Observer (2025 best practice)
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            // Optionally unobserve after animation to improve performance
            // observer.unobserve(entry.target);
          }
        });
      }, observerOptions);

      // Observe all animated elements
      const animatedElements = document.querySelectorAll('.fade-in-scroll, .slide-in-left, .slide-in-right, .scale-in, .stagger-item');
      
      // Immediately animate elements in viewport
      animatedElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isInViewport) {
          // Add animation with slight delay for stagger effect
          setTimeout(() => {
            el.classList.add('animate-in');
          }, index * 50);
        }
        
        // Still observe for scroll animations
        observer.observe(el);
      });

      return () => {
        observer.disconnect();
      };
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  const features = [
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'Smart Scheduling',
      description: 'Plan and schedule your content across all social platforms with intelligent timing suggestions.',
      color: '#7FDBCB'
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'AI-Powered Content',
      description: 'Create engaging content with our built-in design tools and AI-powered suggestions.',
      color: '#FF6B9D'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Analytics & Insights',
      description: 'Track your performance with detailed analytics and actionable insights to grow your reach.',
      color: '#FFC857'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'One-Click Publishing',
      description: 'Publish to multiple platforms simultaneously with a single click.',
      color: '#A06CD5'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Growth Optimization',
      description: 'Automatically optimize posting times and content for maximum engagement.',
      color: '#6BCF7F'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Brand Safety',
      description: 'Built-in content moderation and compliance checks to protect your brand.',
      color: '#4A9EFF'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      company: 'TechCorp',
      text: 'SocialFlow transformed how we manage our social media. We\'ve seen a 200% increase in engagement!',
      rating: 5,
      image: 'SJ'
    },
    {
      name: 'Michael Chen',
      role: 'Content Creator',
      company: 'Creative Studio',
      text: 'The scheduling features save me 10+ hours every week. It\'s a game-changer for content creators.',
      rating: 5,
      image: 'MC'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Social Media Manager',
      company: 'Brand Agency',
      text: 'Best investment we\'ve made. The analytics alone are worth it, but the whole package is incredible.',
      rating: 5,
      image: 'ER'
    }
  ];

  const stats = [
    { number: '10K+', label: 'Active Users' },
    { number: '2M+', label: 'Posts Scheduled' },
    { number: '98%', label: 'Satisfaction Rate' },
    { number: '24/7', label: 'Support' }
  ];

  return (
    <>
      {/* Modern 2025 Scroll Animations */}
      <style>{`
        /* Smooth momentum scrolling */
        * {
          scroll-behavior: smooth;
        }

        /* Base animation states (hidden before scroll) */
        .fade-in-scroll, .slide-in-left, .slide-in-right, .scale-in, .stagger-item {
          opacity: 0;
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fade-in-scroll {
          transform: translateY(60px);
          filter: blur(5px);
        }

        .slide-in-left {
          transform: translateX(-80px);
        }

        .slide-in-right {
          transform: translateX(80px);
        }

        .scale-in {
          transform: scale(0.85);
          filter: blur(3px);
        }

        .stagger-item {
          transform: translateY(40px);
          filter: blur(3px);
        }

        /* Active animation states (visible after scroll) */
        .fade-in-scroll.animate-in,
        .slide-in-left.animate-in,
        .slide-in-right.animate-in,
        .scale-in.animate-in,
        .stagger-item.animate-in {
          opacity: 1;
          transform: translate(0) scale(1);
          filter: blur(0px);
        }

        /* Stagger effect for grid items */
        .stagger-item:nth-child(1).animate-in { transition-delay: 0.1s; }
        .stagger-item:nth-child(2).animate-in { transition-delay: 0.2s; }
        .stagger-item:nth-child(3).animate-in { transition-delay: 0.3s; }
        .stagger-item:nth-child(4).animate-in { transition-delay: 0.4s; }
        .stagger-item:nth-child(5).animate-in { transition-delay: 0.5s; }
        .stagger-item:nth-child(6).animate-in { transition-delay: 0.6s; }

        /* Parallax-ready elements */
        .parallax-slow {
          will-change: transform;
        }

        /* Hover enhancements for cards (2025 trend) */
        .hover-lift {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        /* Add bounce effect to animated elements */
        .animate-in {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
          }
          60% {
            opacity: 1;
            transform: translateY(-5px) scale(1.02);
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      <div 
        className="min-h-screen overflow-x-hidden relative" 
        style={{ 
          background: `linear-gradient(135deg, ${tokens.colors.background.app} 0%, ${tokens.colors.background.layer1} 25%, ${tokens.colors.background.app} 50%, ${tokens.colors.background.layer1} 75%, ${tokens.colors.background.app} 100%)`,
          backgroundSize: '400% 400%',
          padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px)', 
          overflowY: 'scroll',
          animation: 'gradientShift 15s ease infinite'
        }}
      >
        {/* Animated Background Overlay - Dark colors */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(136, 217, 231, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(136, 217, 231, 0.1) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(136, 217, 231, 0.08) 0%, transparent 50%)',
            animation: 'pulse 8s ease-in-out infinite'
          }}
        />
        
        {/* Floating Orbs - Dark theme */}
        <div 
          className="absolute top-20 left-10 w-72 h-72 rounded-full mix-blend-screen filter blur-xl opacity-10"
          style={{ 
            background: 'radial-gradient(circle, rgba(136, 217, 231, 0.3) 0%, transparent 70%)',
            animation: 'blob 7s infinite' 
          }}
        />
        <div 
          className="absolute top-40 right-10 w-72 h-72 rounded-full mix-blend-screen filter blur-xl opacity-10"
          style={{ 
            background: 'radial-gradient(circle, rgba(136, 217, 231, 0.25) 0%, transparent 70%)',
            animation: 'blob 9s infinite', 
            animationDelay: '2s' 
          }}
        />
        <div 
          className="absolute -bottom-8 left-1/2 w-72 h-72 rounded-full mix-blend-screen filter blur-xl opacity-10"
          style={{ 
            background: 'radial-gradient(circle, rgba(136, 217, 231, 0.2) 0%, transparent 70%)',
            animation: 'blob 11s infinite', 
            animationDelay: '4s' 
          }}
        />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Main Content Card - Ultra Responsive */}
        <main 
          className="relative overflow-hidden backdrop-blur-xl" 
          role="main"
          aria-label="LinkedIn Pilot landing page content"
          style={{ 
            background: tokens.colors.background.layer2 + 'CC',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 'clamp(24px, 5vw, 48px)', 
            padding: 'clamp(24px, 5vw, 48px) clamp(20px, 4vw, 48px) clamp(40px, 8vw, 80px)', 
            boxShadow: tokens.shadow.floating,
            border: `1px solid ${tokens.colors.border.default}`,
            willChange: 'transform',
            isolation: 'isolate'
          }}
        >
          
          {/* Accent Line - Top */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${tokens.colors.accent.lime}, transparent)`
          }} />

          {/* Header - Ultra Responsive */}
          <header className="flex justify-between items-center relative z-10" style={{ marginBottom: 'clamp(40px, 8vw, 80px)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '32px', height: '32px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.lg }} className="flex items-center justify-center overflow-hidden">
                <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
              </div>
              <span style={{ 
                fontFamily: tokens.typography.fontFamily.serif, 
                fontStyle: 'italic', 
                color: tokens.colors.text.primary,
                fontSize: 'clamp(20px, 5vw, 26px)', 
                letterSpacing: 'clamp(-1px, -0.3vw, -1.5px)'
              }}>
                LinkedIn Pilot
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => navigate('/pricing')}
                style={{ fontSize: '16px', fontWeight: 500, color: tokens.colors.text.secondary }}
                className="transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
              >
                Pricing
              </button>
              <button
                data-testid="nav-login-btn"
                onClick={() => navigate('/login')}
                style={{ fontSize: '16px', fontWeight: 500, color: tokens.colors.text.secondary, padding: '8px 16px' }}
                className="transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
              >
                Login
              </button>
              <button
                data-testid="nav-signup-btn"
                onClick={() => navigate('/signup')}
                style={{ 
                  borderRadius: tokens.radius.full, 
                  padding: '8px 24px', 
                  backgroundColor: tokens.colors.accent.lime, 
                  color: tokens.colors.text.inverse, 
                  fontWeight: 500 
                }}
                className="transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
              >
                Get Started Free
              </button>
            </nav>

            {/* Mobile Hamburger Button - Ultra Touch-Friendly */}
            <button
              style={{ 
                backgroundColor: tokens.colors.background.layer2, 
                border: `1px solid ${tokens.colors.border.default}`, 
                borderRadius: tokens.radius.xl,
                width: 'clamp(44px, 12vw, 56px)', 
                height: 'clamp(44px, 12vw, 56px)',
                minWidth: '44px',
                minHeight: '44px'
              }}
              className="md:hidden flex items-center justify-center z-50 active:scale-95 transition-transform"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)', color: tokens.colors.text.primary }} />
              ) : (
                <Menu style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)', color: tokens.colors.text.primary }} />
              )}
            </button>
          </header>

          {/* Mobile Off-Canvas Menu */}
          <div
            className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <div className="absolute inset-0 bg-black bg-opacity-80" onClick={() => setMobileMenuOpen(false)} />
            
            <div 
              style={{ 
                backgroundColor: tokens.colors.background.layer2, 
                borderLeft: `1px solid ${tokens.colors.border.default}`, 
                borderTopLeftRadius: tokens.radius.xl, 
                borderBottomLeftRadius: tokens.radius.xl 
              }}
              className={`absolute right-0 top-0 bottom-0 w-80 shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
              <div className="flex flex-col p-8 pt-24">
                <button
                  onClick={() => {
                    navigate('/pricing');
                    setMobileMenuOpen(false);
                  }}
                  style={{ fontSize: '20px', fontWeight: 500, color: tokens.colors.text.secondary, padding: '16px 0', textAlign: 'left' }}
                  className="transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                  onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
                >
                  Pricing
                </button>
                <button
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  style={{ fontSize: '20px', fontWeight: 500, color: tokens.colors.text.secondary, padding: '16px 0', textAlign: 'left' }}
                  className="transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                  onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    navigate('/signup');
                    setMobileMenuOpen(false);
                  }}
                  style={{ 
                    fontSize: '18px', 
                    fontWeight: 500, 
                    color: tokens.colors.text.inverse, 
                    backgroundColor: tokens.colors.accent.lime, 
                    borderRadius: tokens.radius.full, 
                    padding: '16px 24px', 
                    marginTop: '16px' 
                  }}
                  className="transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
                >
                  Get Started Free
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section - Ultra Responsive */}
          <section className="text-center relative" style={{ padding: 'clamp(32px, 8vw, 64px) 0' }}>
            {/* Badge - Ultra Responsive */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: tokens.radius.full,
              backgroundColor: tokens.colors.accent.lime + '1A',
              border: `1px solid ${tokens.colors.accent.lime}4D`,
              gap: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
              marginBottom: 'clamp(24px, 6vw, 32px)'
            }} className="fade-in-scroll">
              <Sparkles style={{ width: 'clamp(14px, 3.5vw, 16px)', height: 'clamp(14px, 3.5vw, 16px)', color: tokens.colors.accent.lime }} />
              <span style={{ fontWeight: 500, color: tokens.colors.accent.lime, fontSize: 'clamp(11px, 2.5vw, 14px)' }}>Trusted by 10,000+ businesses worldwide</span>
            </div>

            {/* Headline - Fluid Typography */}
            <div className="relative z-10 px-4 fade-in-scroll" style={{ marginBottom: 'clamp(32px, 8vw, 48px)' }}>
              <h1 style={{ 
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic',
                fontSize: 'clamp(32px, 8vw, 80px)',
                fontWeight: 400, 
                lineHeight: 1.1, 
                color: tokens.colors.text.primary, 
                marginBottom: '32px', 
                letterSpacing: '-2.5px',
                maxWidth: '1000px',
                margin: '0 auto 32px auto'
              }}>
                LinkedIn Content,
                <span style={{
                  color: tokens.colors.accent.lime,
                  display: 'inline-block',
                  marginLeft: '16px'
                }}>
                  Engineered
                </span>
              </h1>
              
              <p style={{
                fontSize: 'clamp(16px, 4vw, 20px)',
                fontWeight: 300,
                lineHeight: 1.6,
                color: tokens.colors.text.secondary,
                maxWidth: '700px',
                margin: `0 auto clamp(32px, 6vw, 48px) auto`
              }}>
                Create, schedule, and analyze your LinkedIn content with AI-powered automation. Save time, boost engagement, and grow your professional presence.
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center mb-8 fade-in-scroll" style={{ gap: 'clamp(12px, 3vw, 16px)' }}>
                <button
                  data-testid="hero-get-started-btn"
                  onClick={() => navigate('/signup')}
                  style={{
                    borderRadius: tokens.radius.full,
                    padding: '16px 32px',
                    backgroundColor: tokens.colors.accent.lime,
                    color: tokens.colors.text.inverse,
                    fontWeight: 500,
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    minHeight: '48px',
                    width: '100%',
                    maxWidth: '280px',
                    boxShadow: `0 0 20px ${tokens.colors.accent.lime}4D`
                  }}
                  className="transition-all active:scale-95"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
                >
                  Start Free Trial →
                </button>
                <button
                  onClick={() => navigate('/demo')}
                  style={{
                    borderRadius: tokens.radius.full,
                    padding: '16px 32px',
                    border: `2px solid ${tokens.colors.border.default}`,
                    color: tokens.colors.text.primary,
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    minHeight: '48px',
                    width: '100%',
                    maxWidth: '280px',
                    backgroundColor: 'transparent'
                  }}
                  className="transition-all active:scale-95"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.border.default;
                    e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.border.default;
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Watch Demo
                </button>
              </div>

              {/* Trust Indicators - Ultra Responsive */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.text.secondary,
                gap: 'clamp(8px, 2vw, 12px)',
                fontSize: 'clamp(12px, 3vw, 14px)'
              }}>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', color: tokens.colors.accent.lime }} />
                  <span>No credit card required</span>
                </div>
                <span style={{ color: tokens.colors.text.tertiary }} className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', color: tokens.colors.accent.lime }} />
                  <span>14-day free trial</span>
                </div>
                <span style={{ color: tokens.colors.text.tertiary }} className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)', color: tokens.colors.accent.lime }} />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Hero Image/Illustration Placeholder */}
            <div 
              className="relative mx-auto mt-16 scale-in parallax-slow" 
              style={{ 
                maxWidth: '900px',
                transform: `translateY(${scrollY * 0.1}px)`
              }}
            >
              <div style={{ backgroundColor: tokens.colors.background.layer2, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.xl }} className="p-8 shadow-2xl">
                {/* Mock Dashboard Preview */}
                <div style={{ backgroundColor: tokens.colors.background.app, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg }} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                    <div style={{ backgroundColor: tokens.colors.accent.lime }} className="w-3 h-3 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div style={{ height: '96px', backgroundColor: tokens.colors.accent.lime + '1A', border: `1px solid ${tokens.colors.accent.lime}33`, borderRadius: tokens.radius.lg }} />
                    <div style={{ height: '96px', backgroundColor: tokens.colors.accent.lime + '1A', border: `1px solid ${tokens.colors.accent.lime}33`, borderRadius: tokens.radius.lg }} />
                    <div style={{ height: '96px', backgroundColor: tokens.colors.accent.lime + '1A', border: `1px solid ${tokens.colors.accent.lime}33`, borderRadius: tokens.radius.lg }} />
                  </div>
                  <div className="space-y-3">
                    <div style={{ height: '16px', backgroundColor: tokens.colors.background.input, borderRadius: tokens.radius.md, width: '75%' }} />
                    <div style={{ height: '16px', backgroundColor: tokens.colors.background.input, borderRadius: tokens.radius.md, width: '50%' }} />
                    <div style={{ height: '16px', backgroundColor: tokens.colors.background.input, borderRadius: tokens.radius.md, width: '66%' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Section - Ultra Responsive */}
          <section style={{ padding: 'clamp(48px, 10vw, 80px) clamp(16px, 4vw, 24px)' }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto" style={{ gap: 'clamp(24px, 6vw, 32px)' }}>
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center stagger-item">
                  <div style={{
                    fontFamily: tokens.typography.fontFamily.serif,
                    fontStyle: 'italic',
                    color: tokens.colors.accent.lime,
                    fontSize: 'clamp(32px, 8vw, 48px)',
                    fontWeight: 400,
                    marginBottom: 'clamp(4px, 1vw, 8px)'
                  }}>
                    {stat.number}
                  </div>
                  <div style={{ color: tokens.colors.text.secondary, fontWeight: 500, fontSize: 'clamp(12px, 3vw, 14px)' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Features Section - Ultra Responsive */}
          <section style={{ padding: 'clamp(48px, 10vw, 80px) clamp(16px, 4vw, 24px)' }}>
            <div className="text-center fade-in-scroll" style={{ marginBottom: 'clamp(48px, 10vw, 64px)' }}>
              <h2 style={{ 
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic',
                color: tokens.colors.text.primary,
                fontSize: 'clamp(32px, 7vw, 56px)',
                marginBottom: 'clamp(12px, 3vw, 16px)',
                letterSpacing: 'clamp(-1px, -0.3vw, -1.5px)',
                fontWeight: 400
              }}>
                Everything You Need to Succeed
              </h2>
              <p style={{ color: tokens.colors.text.secondary, maxWidth: '672px', margin: '0 auto', fontSize: 'clamp(16px, 4vw, 20px)' }}>
                Powerful features designed to streamline your LinkedIn content workflow
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto" style={{ gap: 'clamp(16px, 4vw, 32px)' }}>
              {features.map((feature, idx) => (
                <div 
                  key={idx}
                  className="group rounded-2xl transition-all duration-300 hover:scale-105 active:scale-100 stagger-item"
                  style={{
                    padding: 'clamp(24px, 5vw, 32px)',
                    background: tokens.colors.background.layer2,
                    border: `1px solid ${tokens.colors.border.default}`,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.accent.lime + '4D';
                    e.currentTarget.style.boxShadow = `0 20px 40px ${tokens.colors.accent.lime}1A`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.border.default;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div 
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: tokens.radius.xl,
                      backgroundColor: tokens.colors.accent.lime + '1A',
                      border: `1px solid ${tokens.colors.accent.lime}33`
                    }}
                    className="flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                  >
                    <div style={{ color: tokens.colors.accent.lime }}>
                      {feature.icon}
                    </div>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '12px', color: tokens.colors.text.primary }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: tokens.colors.text.secondary, lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-20 px-4">
            <div className="text-center mb-16 fade-in-scroll">
              <h2 style={{ 
                fontSize: 'clamp(32px, 5vw, 48px)',
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic',
                marginBottom: '16px',
                color: tokens.colors.text.primary,
                letterSpacing: '-1.5px',
                fontWeight: 400
              }}>
                Loved by Marketing Teams
              </h2>
              <p style={{ fontSize: '20px', color: tokens.colors.text.secondary }}>
                See what our customers have to say
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {testimonials.map((testimonial, idx) => (
                <div 
                  key={idx}
                  style={{
                    backgroundColor: tokens.colors.background.layer2,
                    border: `1px solid ${tokens.colors.border.default}`,
                    padding: '32px',
                    borderRadius: tokens.radius.xl
                  }}
                  className="transition-all scale-in hover-lift"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.accent.lime + '4D';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.border.default;
                  }}
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} style={{ width: '20px', height: '20px', fill: tokens.colors.accent.lime, color: tokens.colors.accent.lime }} />
                    ))}
                  </div>
                  <p style={{ color: tokens.colors.text.primary, marginBottom: '24px', lineHeight: 1.6 }}>
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div 
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.accent.lime,
                        color: tokens.colors.text.inverse,
                        fontWeight: 700
                      }}
                      className="flex items-center justify-center"
                    >
                      {testimonial.image}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: tokens.colors.text.primary }}>{testimonial.name}</div>
                      <div style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section style={{ marginTop: '80px', padding: '80px 32px', backgroundColor: tokens.colors.background.layer2, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.xl }} className="text-center relative overflow-hidden">
            {/* Decorative gradient orbs */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-10%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(136, 217, 231, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-50%',
              right: '-10%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(136, 217, 231, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />

            <div className="relative z-10 px-4 fade-in-scroll">
              <h2 style={{ 
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic',
                color: tokens.colors.text.primary,
                marginBottom: '24px',
                fontSize: 'clamp(28px, 7vw, 56px)',
                letterSpacing: 'clamp(-1px, -0.3vw, -2px)',
                lineHeight: 1.2,
                fontWeight: 400
              }}>
                Ready to Transform Your LinkedIn?
              </h2>
              <p style={{ 
                color: tokens.colors.text.secondary,
                margin: '0 auto',
                fontSize: 'clamp(16px, 4vw, 20px)',
                maxWidth: '700px', 
                marginBottom: 'clamp(32px, 8vw, 48px)',
                lineHeight: 1.6
              }}>
                Join thousands of professionals that trust LinkedIn Pilot to manage their LinkedIn presence. Start your free trial today—no credit card required.
              </p>
              <button
                onClick={() => navigate('/signup')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: tokens.radius.full,
                  padding: '16px 32px',
                  backgroundColor: tokens.colors.accent.lime,
                  color: tokens.colors.text.inverse,
                  fontWeight: 500,
                  fontSize: 'clamp(16px, 3.5vw, 18px)',
                  minHeight: '56px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 30px ${tokens.colors.accent.lime}66`
                }}
                className="transition-all active:scale-95"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
              >
                <span>Start Free Trial</span> <ArrowRight style={{ width: 'clamp(18px, 4vw, 20px)', height: 'clamp(18px, 4vw, 20px)' }} />
              </button>
              <div style={{ 
                color: tokens.colors.text.tertiary,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: 'clamp(20px, 4vw, 24px)',
                fontSize: 'clamp(12px, 3vw, 14px)'
              }}>
                <span>✨ 14-day free trial</span>
                <span style={{ color: tokens.colors.text.tertiary + '33' }} className="hidden sm:inline">•</span>
                <span>No credit card required</span>
                <span style={{ color: tokens.colors.text.tertiary + '33' }} className="hidden sm:inline">•</span>
                <span>Cancel anytime</span>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer style={{ marginTop: '80px', padding: '48px 0', borderTop: `1px solid ${tokens.colors.border.default}` }} className="text-center">
            <div className="mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                <div style={{ width: '32px', height: '32px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.lg }} className="flex items-center justify-center overflow-hidden">
                  <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
                </div>
                <span style={{ fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontSize: '20px' }}>LinkedIn Pilot</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', color: tokens.colors.text.secondary }}>
                <button onClick={() => navigate('/about')} style={{ color: tokens.colors.text.secondary }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}>
                  About
                </button>
                <button onClick={() => navigate('/pricing')} style={{ color: tokens.colors.text.secondary }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}>
                  Pricing
                </button>
                <button onClick={() => navigate('/contact')} style={{ color: tokens.colors.text.secondary }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}>
                  Contact
                </button>
                <button onClick={() => navigate('/privacy')} style={{ color: tokens.colors.text.secondary }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}>
                  Privacy
                </button>
              </div>
            </div>
            <p style={{ color: tokens.colors.text.tertiary, fontSize: '14px' }}>
              © 2025 LinkedIn Pilot. All rights reserved.
            </p>
          </footer>
        </main>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .floating-element {
          animation: float 3s ease-in-out infinite;
        }

        button:active {
          transform: scale(0.98);
        }

        @media (max-width: 768px) {
          .floating-element {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

export default Landing;
