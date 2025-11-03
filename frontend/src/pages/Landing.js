import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, Twitter, Instagram, Facebook, Clock, Users, Calendar, BarChart3, Sparkles, CheckCircle, Star, ArrowRight, Menu, X, Zap, TrendingUp, Shield } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

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
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ 
        backgroundColor: '#7FDBCB', 
        padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px)', 
        overflowY: 'scroll'
      }}>
      <div className="max-w-7xl mx-auto">
        {/* Main Content Card - Ultra Responsive */}
        <div className="bg-white relative overflow-hidden" style={{ 
          borderRadius: 'clamp(24px, 5vw, 48px)', 
          padding: 'clamp(24px, 5vw, 48px) clamp(20px, 4vw, 48px) clamp(40px, 8vw, 80px)', 
          boxShadow: '0 clamp(12px, 3vw, 24px) clamp(40px, 8vw, 80px) rgba(0, 0, 0, 0.12)'
        }}>
          
          {/* Gradient Accent - Top */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #7FDBCB, #FF6B9D, #FFC857, #7FDBCB)',
            backgroundSize: '200% 100%',
            animation: 'gradientShift 3s ease infinite'
          }} />

          {/* Header - Ultra Responsive */}
          <header className="flex justify-between items-center relative z-10" style={{ marginBottom: 'clamp(40px, 8vw, 80px)' }}>
            <div style={{ 
              fontSize: 'clamp(24px, 6vw, 32px)', 
              fontWeight: 900, 
              color: '#000000', 
              letterSpacing: 'clamp(-1px, -0.3vw, -1.5px)',
              background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              SocialFlow
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => navigate('/pricing')}
                className="text-base font-semibold text-gray-700 hover:text-black transition-colors"
              >
                Pricing
              </button>
              <button
                data-testid="nav-login-btn"
                onClick={() => navigate('/login')}
                className="text-base font-semibold text-gray-700 hover:text-black transition-colors px-4 py-2"
              >
                Login
              </button>
              <button
                data-testid="nav-signup-btn"
                onClick={() => navigate('/signup')}
                style={{
                  background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 700,
                  padding: '14px 32px',
                  borderRadius: '50px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s ease'
                }}
                className="hover:scale-105 hover:shadow-2xl"
              >
                Get Started Free
              </button>
            </nav>

            {/* Mobile Hamburger Button - Ultra Touch-Friendly */}
            <button
              className="md:hidden bg-black rounded-xl flex items-center justify-center z-50 active:scale-95 transition-transform"
              style={{ 
                width: 'clamp(44px, 12vw, 56px)', 
                height: 'clamp(44px, 12vw, 56px)',
                minWidth: '44px',
                minHeight: '44px'
              }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)' }} className="text-white" />
              ) : (
                <Menu style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)' }} className="text-white" />
              )}
            </button>
          </header>

          {/* Mobile Off-Canvas Menu */}
          <div
            className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
            
            <div 
              className={`absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
              style={{ borderTopLeftRadius: '32px', borderBottomLeftRadius: '32px' }}
            >
              <div className="flex flex-col p-8 pt-24">
                <button
                  onClick={() => {
                    navigate('/pricing');
                    setMobileMenuOpen(false);
                  }}
                  className="text-xl font-semibold text-gray-800 py-4 text-left hover:text-black transition-colors"
                >
                  Pricing
                </button>
                <button
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  className="text-xl font-semibold text-gray-800 py-4 text-left hover:text-black transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    navigate('/signup');
                    setMobileMenuOpen(false);
                  }}
                  className="text-lg font-semibold text-white bg-black rounded-3xl px-6 py-4 mt-4 hover:-translate-y-0.5 transition-transform"
                >
                  Get Started Free
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section - Ultra Responsive */}
          <section className="text-center relative" style={{ padding: 'clamp(32px, 8vw, 64px) 0' }}>
            {/* Badge - Ultra Responsive */}
            <div className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 fade-in-scroll" style={{
              gap: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
              marginBottom: 'clamp(24px, 6vw, 32px)'
            }}>
              <Sparkles style={{ width: 'clamp(14px, 3.5vw, 16px)', height: 'clamp(14px, 3.5vw, 16px)' }} className="text-purple-600" />
              <span className="font-semibold text-purple-900" style={{ fontSize: 'clamp(11px, 2.5vw, 14px)' }}>Trusted by 10,000+ businesses worldwide</span>
            </div>

            {/* Headline - Fluid Typography */}
            <div className="relative z-10 px-4 fade-in-scroll" style={{ marginBottom: 'clamp(32px, 8vw, 48px)' }}>
              <h1 style={{ 
                fontSize: 'clamp(32px, 8vw, 80px)',
                fontWeight: 900, 
                lineHeight: 1.1, 
                color: '#000000', 
                marginBottom: '32px', 
                letterSpacing: '-2.5px',
                maxWidth: '1000px',
                margin: '0 auto 32px auto'
              }}>
                Social Media Management,
                <span style={{
                  background: 'linear-gradient(135deg, #7FDBCB 0%, #FF6B9D 50%, #FFC857 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                  marginLeft: '16px'
                }}>
                  Simplified
                </span>
              </h1>
              
              <p style={{
                fontSize: 'clamp(16px, 4vw, 20px)',
                fontWeight: 500,
                lineHeight: 1.6,
                color: '#666666',
                maxWidth: '700px',
                margin: `0 auto clamp(32px, 6vw, 48px) auto`
              }}>
                Create, schedule, and analyze your content across all social platforms. Save time, boost engagement, and grow your brand with intelligent automation.
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center mb-8 fade-in-scroll" style={{ gap: 'clamp(12px, 3vw, 16px)' }}>
                <button
                  data-testid="hero-get-started-btn"
                  onClick={() => navigate('/signup')}
                  className="hover:scale-105 hover:shadow-2xl transition-all active:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
                    color: '#FFFFFF',
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    fontWeight: 700,
                    padding: 'clamp(14px, 3.5vw, 18px) clamp(32px, 8vw, 48px)',
                    borderRadius: '50px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
                    minHeight: '48px',
                    width: '100%',
                    maxWidth: '280px'
                  }}
                >
                  Start Free Trial →
                </button>
                <button
                  onClick={() => navigate('/demo')}
                  className="hover:bg-black hover:text-white transition-all active:scale-95"
                  style={{
                    background: 'transparent',
                    color: '#000000',
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    fontWeight: 700,
                    padding: 'clamp(14px, 3.5vw, 18px) clamp(32px, 8vw, 48px)',
                    borderRadius: '50px',
                    border: '2px solid #000000',
                    cursor: 'pointer',
                    minHeight: '48px',
                    width: '100%',
                    maxWidth: '280px'
                  }}
                >
                  Watch Demo
                </button>
              </div>

              {/* Trust Indicators - Ultra Responsive */}
              <div className="flex flex-wrap items-center justify-center text-gray-600" style={{
                gap: 'clamp(8px, 2vw, 12px)',
                fontSize: 'clamp(12px, 3vw, 14px)'
              }}>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)' }} className="text-green-500" />
                  <span>No credit card required</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)' }} className="text-green-500" />
                  <span>14-day free trial</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle style={{ width: 'clamp(14px, 3vw, 16px)', height: 'clamp(14px, 3vw, 16px)' }} className="text-green-500" />
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
              <div style={{
                background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)',
                borderRadius: '24px',
                padding: '60px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                {/* Mock Dashboard Preview */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl" />
                    <div className="h-24 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl" />
                    <div className="h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
                    <div className="h-4 bg-gray-200 rounded-lg w-1/2" />
                    <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
                  </div>
                </div>

                {/* Floating Social Icons */}
                <div className="floating-element absolute" style={{ top: '20px', left: '-40px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, #7FDBCB 0%, #5FC9B9 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(127, 219, 203, 0.4)'
                  }}>
                    <Twitter className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="floating-element absolute" style={{ top: '60px', right: '-40px', animationDelay: '0.5s' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, #FF6B9D 0%, #E85585 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(255, 107, 157, 0.4)'
                  }}>
                    <Instagram className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="floating-element absolute" style={{ bottom: '40px', left: '-30px', animationDelay: '1s' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, #FFC857 0%, #FFB83D 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(255, 200, 87, 0.4)'
                  }}>
                    <Youtube className="w-8 h-8 text-white" />
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
                    fontSize: 'clamp(32px, 8vw, 48px)',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: 'clamp(4px, 1vw, 8px)'
                  }}>
                    {stat.number}
                  </div>
                  <div className="text-gray-600 font-semibold" style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Features Section - Ultra Responsive */}
          <section style={{ padding: 'clamp(48px, 10vw, 80px) clamp(16px, 4vw, 24px)' }}>
            <div className="text-center fade-in-scroll" style={{ marginBottom: 'clamp(48px, 10vw, 64px)' }}>
              <h2 className="font-black" style={{ 
                fontSize: 'clamp(32px, 7vw, 56px)',
                marginBottom: 'clamp(12px, 3vw, 16px)',
                letterSpacing: 'clamp(-1px, -0.3vw, -1.5px)',
                color: '#000000'
              }}>
                Everything You Need to Succeed
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto" style={{ fontSize: 'clamp(16px, 4vw, 20px)' }}>
                Powerful features designed to streamline your social media workflow
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto" style={{ gap: 'clamp(16px, 4vw, 32px)' }}>
              {features.map((feature, idx) => (
                <div 
                  key={idx}
                  className="group rounded-3xl transition-all duration-300 hover:scale-105 active:scale-100 stagger-item hover-lift"
                  style={{
                    padding: 'clamp(24px, 5vw, 32px)',
                    background: '#F8F9FA',
                    border: '2px solid transparent',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = feature.color;
                    e.currentTarget.style.boxShadow = `0 20px 40px ${feature.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                    style={{ 
                      backgroundColor: feature.color,
                      color: '#FFFFFF'
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 100%)' }}>
            <div className="text-center mb-16 fade-in-scroll">
              <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ 
                letterSpacing: '-1.5px',
                color: '#000000'
              }}>
                Loved by Marketing Teams
              </h2>
              <p className="text-xl text-gray-600">
                See what our customers have to say
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {testimonials.map((testimonial, idx) => (
                <div 
                  key={idx}
                  className="bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-shadow border border-gray-100 scale-in hover-lift"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ 
                        background: 'linear-gradient(135deg, #7FDBCB 0%, #FF6B9D 100%)'
                      }}
                    >
                      {testimonial.image}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{testimonial.name}</div>
                      <div className="text-sm text-gray-600">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="mt-20 py-20 px-8 text-center relative overflow-hidden" style={{ 
            background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)', 
            borderRadius: '48px',
            position: 'relative'
          }}>
            {/* Decorative gradient orbs */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-10%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(127, 219, 203, 0.3) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-50%',
              right: '-10%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(255, 107, 157, 0.3) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />

            <div className="relative z-10 px-4 fade-in-scroll">
              <h2 className="font-black text-white mb-6" style={{ 
                fontSize: 'clamp(28px, 7vw, 56px)',
                letterSpacing: 'clamp(-1px, -0.3vw, -2px)',
                lineHeight: 1.2
              }}>
                Ready to Transform Your Social Media?
              </h2>
              <p className="text-gray-300 mx-auto" style={{ 
                fontSize: 'clamp(16px, 4vw, 20px)',
                maxWidth: '700px', 
                marginBottom: 'clamp(32px, 8vw, 48px)',
                lineHeight: 1.6
              }}>
                Join thousands of businesses that trust SocialFlow to manage their social media presence. Start your free trial today—no credit card required.
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center justify-center gap-2 hover:scale-105 active:scale-100 transition-transform mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #7FDBCB 0%, #5FC9B9 100%)',
                  color: '#000000',
                  fontSize: 'clamp(16px, 3.5vw, 18px)',
                  fontWeight: 700,
                  padding: 'clamp(16px, 4vw, 20px) clamp(32px, 8vw, 56px)',
                  borderRadius: '50px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 12px 32px rgba(127, 219, 203, 0.4)',
                  minHeight: '56px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>Start Free Trial</span> <ArrowRight style={{ width: 'clamp(18px, 4vw, 20px)', height: 'clamp(18px, 4vw, 20px)' }} />
              </button>
              <div className="text-gray-400 flex flex-wrap items-center justify-center gap-2" style={{ 
                marginTop: 'clamp(20px, 4vw, 24px)',
                fontSize: 'clamp(12px, 3vw, 14px)'
              }}>
                <span>✨ 14-day free trial</span>
                <span className="hidden sm:inline">•</span>
                <span>No credit card required</span>
                <span className="hidden sm:inline">•</span>
                <span>Cancel anytime</span>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-20 py-12 text-center border-t border-gray-200">
            <div className="mb-6">
              <div style={{ 
                fontSize: '28px', 
                fontWeight: 900, 
                color: '#000000', 
                letterSpacing: '-1px',
                marginBottom: '16px'
              }}>
                SocialFlow
              </div>
              <div className="flex items-center justify-center gap-6 text-gray-600">
                <button onClick={() => navigate('/about')} className="hover:text-black transition-colors">
                  About
                </button>
                <button onClick={() => navigate('/pricing')} className="hover:text-black transition-colors">
                  Pricing
                </button>
                <button onClick={() => navigate('/contact')} className="hover:text-black transition-colors">
                  Contact
                </button>
                <button onClick={() => navigate('/privacy')} className="hover:text-black transition-colors">
                  Privacy
                </button>
              </div>
            </div>
            <p style={{ color: '#666666', fontSize: '14px' }}>
              © 2025 SocialFlow. All rights reserved.
            </p>
          </footer>
        </div>
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
