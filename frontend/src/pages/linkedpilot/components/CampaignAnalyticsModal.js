import React, { useState, useEffect } from 'react';
import { X, TrendingUp, ThumbsUp, MessageCircle, Share2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CampaignAnalyticsModal = ({ campaign, isOpen, onClose }) => {
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

  const StatCard = ({ icon: Icon, label, value, color = 'blue' }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
      <div className="flex items-center gap-2 md:gap-3">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 md:w-5 md:h-5 text-${color}-600`} />
        </div>
        <div>
          <p className="text-xs md:text-sm text-gray-600">{label}</p>
          <p className="text-lg md:text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-50 rounded-none md:rounded-lg shadow-xl w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Responsive */}
        <div className="bg-white px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Campaign Analytics</h2>
            <p className="text-xs md:text-sm text-gray-600 mt-1">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Responsive padding */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement</h3>
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
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Average Engagement Rate</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-blue-600">
                    {analytics?.avg_engagement_rate?.toFixed(2) || '0.00'}%
                  </span>
                  <span className="text-sm text-gray-600">
                    across all posts
                  </span>
                </div>
              </div>

              {/* Campaign Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`text-sm font-medium capitalize ${
                      campaign.status === 'active' ? 'text-green-600' :
                      campaign.status === 'paused' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Frequency</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {campaign.posting_schedule?.frequency?.replace('_', ' ') || 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tone & Voice</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {campaign.tone_voice || 'Professional'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Auto-post</span>
                    <span className="text-sm font-medium text-gray-900">
                      {campaign.auto_post ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {campaign.content_pillars?.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">Content Pillars</span>
                      <div className="flex flex-wrap gap-2">
                        {campaign.content_pillars.map((pillar, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
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
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-gray-700">
                        Best performing pillar: <span className="font-semibold">{analytics.best_performing_pillar}</span>
                      </span>
                    </div>
                    {analytics.best_performing_time && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-700">
                          Best posting time: <span className="font-semibold">{analytics.best_performing_time}</span>
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
        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CampaignAnalyticsModal;
