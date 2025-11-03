import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, Twitter, Instagram, Facebook, Clock, Users, Calendar, BarChart3, Sparkles, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'Smart Scheduling',
      description: 'Plan and schedule your content across all social platforms with intelligent timing suggestions.'
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Content Creation',
      description: 'Create engaging content with our built-in design tools and AI-powered suggestions.'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Analytics & Insights',
      description: 'Track your performance with detailed analytics and actionable insights to grow your reach.'
    }
  ];

  const steps = [
    { step: '01', title: 'Connect Accounts', description: 'Link your social media accounts in one click' },
    { step: '02', title: 'Create Content', description: 'Design posts with our intuitive content creator' },
    { step: '03', title: 'Schedule & Publish', description: 'Set your posting schedule and let us handle the rest' },
    { step: '04', title: 'Analyze & Grow', description: 'Monitor performance and optimize your strategy' }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      company: 'TechCorp',
      text: 'SocialFlow transformed how we manage our social media. We\'ve seen a 200% increase in engagement!',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Content Creator',
      company: 'Creative Studio',
      text: 'The scheduling features save me 10+ hours every week. It\'s a game-changer for content creators.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Social Media Manager',
      company: 'Brand Agency',
      text: 'Best investment we\'ve made. The analytics alone are worth it, but the whole package is incredible.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#7FDBCB', padding: '40px 24px' }}>
      <div className="max-w-7xl mx-auto">
        {/* Main Content Card */}
        <div style={{ backgroundColor: '#E8F0ED', borderRadius: '48px', padding: '48px', position: 'relative', overflow: 'visible' }}>
          
          {/* Header */}
          <header className="flex justify-between items-center mb-16 relative z-10">
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#000000', letterSpacing: '-1px' }}>
              SocialFlow
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => navigate('/pricing')}
                className="text-base font-medium text-black hover:opacity-70 transition-opacity"
              >
                Pricing
              </button>
              <button
                data-testid="nav-login-btn"
                onClick={() => navigate('/login')}
                className="text-base font-semibold text-black bg-transparent border-none px-4 py-2 cursor-pointer hover:opacity-70 transition-opacity"
              >
                Login
              </button>
              <button
                data-testid="nav-signup-btn"
                onClick={() => navigate('/signup')}
                className="text-base font-semibold text-white bg-black rounded-3xl px-6 py-3 cursor-pointer hover:-translate-y-0.5 transition-transform"
              >
                Sign Up
              </button>
            </nav>
          </header>

          {/* Hero Section */}
          <section className="text-center py-16 relative" style={{ minHeight: '700px' }}>
            {/* Headline and Subheadline */}
            <div className="relative z-10 mb-12">
              <h1 className="text-5xl md:text-6xl lg:text-7xl" style={{ 
                fontWeight: 900, 
                lineHeight: 1.1, 
                color: '#000000', 
                marginBottom: '24px', 
                letterSpacing: '-2px',
                maxWidth: '900px',
                margin: '0 auto 24px auto'
              }}>
                Engage, Evolve, Excel Social Evolution
              </h1>
              
              <p style={{
                fontSize: '18px',
                fontWeight: 500,
                lineHeight: 1.6,
                color: '#000000',
                opacity: 0.8,
                maxWidth: '600px',
                margin: '0 auto 40px auto'
              }}>
                Crafting social experiences that resonate, inspire, and turn followers into brand enthusiasts
              </p>
              
              <button
                data-testid="hero-get-started-btn"
                onClick={() => navigate('/signup')}
                style={{
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  fontSize: '18px',
                  fontWeight: 700,
                  padding: '16px 48px',
                  borderRadius: '32px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
                className="hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                Get Started
              </button>
            </div>

            {/* Main Image Container with Floating Elements */}
            <div className="relative mx-auto" style={{ maxWidth: '700px', marginTop: '60px' }}>
              {/* Central Image */}
              <img
                src="https://images.unsplash.com/photo-1726066012749-f81bf4422d4e"
                alt="Social Media Management"
                className="relative z-10 mx-auto"
                style={{ maxWidth: '450px', height: 'auto' }}
              />

              {/* Check Reviews Badge */}
              <div 
                className="floating-element absolute"
                style={{
                  top: '-60px',
                  left: '0',
                  backgroundColor: '#000000',
                  borderRadius: '32px',
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  zIndex: 5,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-cyan-400 border-2 border-black"></div>
                  <div className="w-8 h-8 rounded-full bg-pink-400 border-2 border-black"></div>
                  <div className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-black"></div>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                  Check reviews
                </span>
              </div>

              {/* Scribble Shape */}
              <svg 
                className="floating-element absolute"
                style={{
                  top: '20px',
                  left: '-120px',
                  width: '100px',
                  height: '120px',
                  zIndex: 1
                }}
                viewBox="0 0 100 120"
              >
                <path 
                  d="M10 10 L30 100 L50 20 L70 90 L90 30" 
                  stroke="#000000" 
                  strokeWidth="3" 
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Boost Your Social Media Circular Badge */}
              <div 
                className="floating-element absolute"
                style={{
                  top: '50px',
                  left: '-80px',
                  width: '120px',
                  height: '120px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-15deg)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 5
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.3, padding: '20px' }}>
                  Boost your Social Media now
                </div>
              </div>

              {/* Star/Asterisk Shape */}
              <svg 
                className="floating-element absolute"
                style={{
                  top: '-20px',
                  left: '20px',
                  width: '30px',
                  height: '30px',
                  zIndex: 3
                }}
                viewBox="0 0 30 30"
              >
                <path 
                  d="M15 2 L17 13 L28 15 L17 17 L15 28 L13 17 L2 15 L13 13 Z" 
                  fill="#000000"
                />
              </svg>

              {/* Oval Shape */}
              <div 
                className="floating-element absolute"
                style={{
                  top: '-40px',
                  right: '-100px',
                  width: '180px',
                  height: '120px',
                  border: '3px solid #000000',
                  borderRadius: '50%',
                  transform: 'rotate(25deg)',
                  zIndex: 1
                }}
              >
                {/* Small asterisks at intersection */}
                <div style={{ position: 'absolute', top: '40%', left: '45%', fontSize: '20px', fontWeight: 900 }}>*</div>
                <div style={{ position: 'absolute', top: '50%', left: '50%', fontSize: '16px', fontWeight: 900 }}>*</div>
              </div>

              {/* Clock Icon */}
              <div 
                className="floating-element absolute"
                style={{
                  top: '50px',
                  right: '-80px',
                  zIndex: 5
                }}
              >
                <Clock className="w-16 h-16 text-black" strokeWidth={1.5} />
              </div>

              {/* Social Icons - Floating around image */}
              <div 
                className="floating-element absolute"
                style={{
                  top: '30px',
                  left: '80px',
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 5
                }}
              >
                <Youtube className="w-7 h-7 text-red-500" />
              </div>

              <div 
                className="floating-element absolute"
                style={{
                  top: '80px',
                  left: '-40px',
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  animationDelay: '0.5s',
                  zIndex: 5
                }}
              >
                <Twitter className="w-7 h-7 text-blue-400" />
              </div>

              <div 
                className="floating-element absolute"
                style={{
                  bottom: '100px',
                  right: '-20px',
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  animationDelay: '1s',
                  zIndex: 5
                }}
              >
                <Instagram className="w-7 h-7 text-pink-500" />
              </div>

              <div 
                className="floating-element absolute"
                style={{
                  bottom: '60px',
                  left: '30px',
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  animationDelay: '1.5s',
                  zIndex: 5
                }}
              >
                <Facebook className="w-7 h-7 text-blue-600" />
              </div>
            </div>

            {/* Feature Cards Below Image */}
            <div className="relative mt-8 z-20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* Left Card */}
                <div 
                  style={{
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    borderRadius: '32px',
                    padding: '40px 28px',
                    textAlign: 'left',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <h3 style={{
                    fontSize: '32px',
                    fontWeight: 900,
                    lineHeight: 1.2,
                    marginBottom: '0'
                  }}>
                    From Likes to Leads, We Drive Results
                  </h3>
                </div>

                {/* Center Spacer */}
                <div></div>

                {/* Right Card */}
                <div 
                  style={{
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    borderRadius: '32px',
                    padding: '32px 24px',
                    textAlign: 'left',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    marginBottom: '28px',
                    lineHeight: 1.4
                  }}>
                    Thriving Brands, Thrilled Clients – Our Social Management in Action
                  </h3>

                  <div className="flex flex-col gap-6">
                    <div>
                      <div style={{
                        fontSize: '44px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        marginBottom: '6px'
                      }}>
                        500+
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#FFFFFF',
                        opacity: 0.8
                      }}>
                        Accounts Managed
                      </div>
                      <div style={{
                        width: '80%',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '2px',
                        marginTop: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: '75%',
                          height: '4px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '2px'
                        }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{
                        fontSize: '44px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        marginBottom: '6px'
                      }}>
                        800+
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#FFFFFF',
                        opacity: 0.8
                      }}>
                        Happy Customers
                      </div>
                      <div style={{
                        width: '80%',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '2px',
                        marginTop: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: '90%',
                          height: '4px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '2px'
                        }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Landing;