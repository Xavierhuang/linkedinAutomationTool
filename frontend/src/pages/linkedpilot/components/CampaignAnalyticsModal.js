import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ThumbsUp, MessageCircle, Share2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CampaignAnalyticsModal = ({ campaign, isOpen, onClose }) => {
  const tokens = useThemeTokens();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && campaign) {
      fetchAnalytics();
    }
  }, [isOpen, campaign]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/campaigns/${campaign.id}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set default analytics if fetch fails
      setAnalytics({
        total_posts: 0,
        successful_posts: 0,
        failed_posts: 0,
        pending_review: 0,
        total_impressions: 0,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
        avg_engagement_rate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !campaign) return null;

  const StatCard = ({ icon: Icon, label, value, color = 'blue' }) => {
    const colorMap = {
      blue: tokens.colors.accent.lime,
      green: '#10B981',
      yellow: '#F59E0B',
      red: '#EF4444',
      purple: '#8B5CF6',
      orange: '#F97316'
    };
    const accentColor = colorMap[color] || tokens.colors.accent.lime;
    
    return (
      <div 
        style={{
          backgroundColor: tokens.colors.background.layer2,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.border.default}`,
          padding: '12px 16px'
        }}
      >
      <div className="flex items-center gap-2 md:gap-3">
          <div 
            style={{
              width: '40px',
              height: '40px',
              borderRadius: tokens.radius.md,
              backgroundColor: accentColor + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Icon style={{ width: '20px', height: '20px', color: accentColor }} />
        </div>
        <div>
            <p style={{ fontSize: '12px', color: tokens.colors.text.secondary }}>{label}</p>
            <p style={{ fontSize: '24px', fontWeight: 700, color: tokens.colors.text.primary }}>{value}</p>
        </div>
      </div>
    </div>
  );
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-0 md:p-4"
      style={{ backgroundColor: tokens.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        className="rounded-none md:rounded-lg shadow-xl w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: tokens.colors.background.layer2,
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadow.floating
        }}
      >
        {/* Header - Responsive */}
        <div 
          className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between"
          style={{
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            backgroundColor: tokens.colors.background.layer1
          }}
        >
          <div>
            <h2 
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: tokens.colors.text.primary,
                fontFamily: tokens.typography.fontFamily.sans
              }}
            >
              Campaign Analytics
            </h2>
            <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginTop: '4px' }}>
              {campaign.name}
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ color: tokens.colors.text.secondary }}
            className="hover:opacity-70 transition-opacity"
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Responsive padding */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 
                className="w-8 h-8 animate-spin" 
                style={{ color: tokens.colors.text.secondary }}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div>
                <h3 
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: tokens.colors.text.primary,
                    marginBottom: '16px',
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                >
                  Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={TrendingUp}
                    label="Total Posts"
                    value={analytics?.total_posts || 0}
                    color="blue"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Successful"
                    value={analytics?.successful_posts || 0}
                    color="green"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Pending Review"
                    value={analytics?.pending_review || 0}
                    color="yellow"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Failed"
                    value={analytics?.failed_posts || 0}
                    color="red"
                  />
                </div>
              </div>

              {/* Engagement Metrics */}
              <div>
                <h3 
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: tokens.colors.text.primary,
                    marginBottom: '16px',
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                >
                  Engagement
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={Eye}
                    label="Impressions"
                    value={analytics?.total_impressions?.toLocaleString() || 0}
                    color="purple"
                  />
                  <StatCard
                    icon={ThumbsUp}
                    label="Likes"
                    value={analytics?.total_likes?.toLocaleString() || 0}
                    color="blue"
                  />
                  <StatCard
                    icon={MessageCircle}
                    label="Comments"
                    value={analytics?.total_comments?.toLocaleString() || 0}
                    color="green"
                  />
                  <StatCard
                    icon={Share2}
                    label="Shares"
                    value={analytics?.total_shares?.toLocaleString() || 0}
                    color="orange"
                  />
                </div>
              </div>

              {/* Engagement Rate */}
              <div 
                style={{
                  backgroundColor: tokens.colors.background.layer2,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${tokens.colors.border.default}`,
                  padding: '24px'
                }}
              >
                <h3 
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: tokens.colors.text.primary,
                    marginBottom: '8px',
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                >
                  Average Engagement Rate
                </h3>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: '36px', fontWeight: 700, color: tokens.colors.accent.lime }}>
                    {analytics?.avg_engagement_rate?.toFixed(2) || '0.00'}%
                  </span>
                  <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                    across all posts
                  </span>
                </div>
              </div>

              {/* Campaign Details */}
              <div 
                style={{
                  backgroundColor: tokens.colors.background.layer2,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${tokens.colors.border.default}`,
                  padding: '24px'
                }}
              >
                <h3 
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: tokens.colors.text.primary,
                    marginBottom: '16px',
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                >
                  Campaign Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Status</span>
                    <span 
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: campaign.status === 'active' ? '#10B981' :
                               campaign.status === 'paused' ? '#F59E0B' :
                               tokens.colors.text.secondary
                      }}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Frequency</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                      {campaign.posting_schedule?.frequency?.replace('_', ' ') || 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Tone & Voice</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                      {campaign.tone_voice || 'Professional'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Auto-post</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                      {campaign.auto_post ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {campaign.content_pillars?.length > 0 && (
                    <div>
                      <span style={{ fontSize: '14px', color: tokens.colors.text.secondary, display: 'block', marginBottom: '8px' }}>
                        Content Pillars
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {campaign.content_pillars.map((pillar, index) => (
                          <span
                            key={index}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: tokens.colors.accent.lime + '20',
                              color: tokens.colors.accent.lime,
                              fontSize: '12px',
                              fontWeight: 500,
                              borderRadius: tokens.radius.full
                            }}
                          >
                            {pillar}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Insights */}
              {analytics?.best_performing_pillar && (
                <div 
                  style={{
                    background: `linear-gradient(to right, ${tokens.colors.accent.lime}20, ${tokens.colors.accent.lime}10)`,
                    borderRadius: tokens.radius.lg,
                    border: `1px solid ${tokens.colors.accent.lime}40`,
                    padding: '24px'
                  }}
                >
                  <h3 
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: tokens.colors.text.primary,
                      marginBottom: '16px',
                      fontFamily: tokens.typography.fontFamily.sans
                    }}
                  >
                    Performance Insights
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp style={{ width: '20px', height: '20px', color: tokens.colors.accent.lime }} />
                      <span style={{ fontSize: '14px', color: tokens.colors.text.primary }}>
                        Best performing pillar: <span style={{ fontWeight: 600 }}>{analytics.best_performing_pillar}</span>
                      </span>
                    </div>
                    {analytics.best_performing_time && (
                      <div className="flex items-center gap-2">
                        <TrendingUp style={{ width: '20px', height: '20px', color: tokens.colors.accent.lime }} />
                        <span style={{ fontSize: '14px', color: tokens.colors.text.primary }}>
                          Best posting time: <span style={{ fontWeight: 600 }}>{analytics.best_performing_time}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 flex justify-end"
          style={{
            borderTop: `1px solid ${tokens.colors.border.default}`,
            backgroundColor: tokens.colors.background.layer1
          }}
        >
          <Button
            onClick={onClose}
            style={{
              backgroundColor: tokens.colors.accent.lime,
              borderRadius: tokens.radius.full,
              color: tokens.colors.text.inverse,
              fontFamily: tokens.typography.fontFamily.sans,
              fontSize: '16px',
              fontWeight: 600,
              padding: '10px 24px',
              boxShadow: tokens.shadow.subtle
            }}
            className="hover:opacity-90 transition-opacity"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CampaignAnalyticsModal;
