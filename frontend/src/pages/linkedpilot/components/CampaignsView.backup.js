import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, TrendingUp, Loader2, Edit, Pause, Play, Trash2, Calendar, Clock, BarChart3, Timer, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampaignConfigModal from './CampaignConfigModal';
import CampaignAnalyticsModal from './CampaignAnalyticsModal';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Countdown Timer Component
const CountdownTimer = ({ campaign, orgId }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [lastPostCount, setLastPostCount] = useState(null);
  const [lastGenerationTime, setLastGenerationTime] = useState(campaign.last_generation_time);
  const [isChecking, setIsChecking] = useState(false);

  // Initialize last generation time from campaign
  useEffect(() => {
    if (campaign.last_generation_time) {
      setLastGenerationTime(campaign.last_generation_time);
    }
  }, [campaign.id, campaign.last_generation_time]); // Update when campaign or its last_generation_time changes

  // Check for new posts periodically
  useEffect(() => {
    if (campaign.status !== 'active') {
      return;
    }

    const checkForNewPosts = async () => {
      try {
        setIsChecking(true);
        const response = await axios.get(`${BACKEND_URL}/api/ai-content/review-queue?org_id=${orgId}`);
        const campaignPosts = response.data.filter(post => post.campaign_id === campaign.id);
        
        const currentPostCount = campaignPosts.length;
        
        // Initialize lastPostCount on first check
        if (lastPostCount === null) {
          setLastPostCount(currentPostCount);
          setIsChecking(false);
          return;
        }
        
        // If post count increased, a new post was generated - restart countdown
        if (currentPostCount > lastPostCount) {
          console.log(`✓ New post detected for campaign ${campaign.name}! Posts: ${lastPostCount} -> ${currentPostCount}`);
          const now = new Date().toISOString();
          setLastGenerationTime(now);
          console.log(`✓ Countdown restarted at ${now}`);
        }
        
        setLastPostCount(currentPostCount);
        setIsChecking(false);
      } catch (error) {
        console.error('Error checking for new posts:', error);
        setIsChecking(false);
      }
    };

    // Check immediately
    checkForNewPosts();

    // Then check every 10 seconds
    const checkInterval = setInterval(checkForNewPosts, 10000);

    return () => clearInterval(checkInterval);
  }, [campaign.id, campaign.status, orgId]); // Removed lastPostCount from dependencies

  // Calculate and update countdown every second
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (campaign.status !== 'active') {
        return 'Paused';
      }

      const frequency = campaign.posting_schedule?.frequency || 'weekly';

      // Frequency intervals in minutes
      const intervals = {
        'every_5_min': 5,
        'every_15_min': 15,
        'every_30_min': 30,
        'hourly': 60,
        'twice_daily': 720,
        'daily': 1440,
        '3x_week': 3360,
        '2x_week': 5040,
        'weekly': 10080,
        'bi_weekly': 20160
      };

      const intervalMinutes = intervals[frequency] || 10080;

      if (!lastGenerationTime) {
        return 'Waiting for first post...';
      }

      const lastGenTime = new Date(lastGenerationTime);
      const nextGenTime = new Date(lastGenTime.getTime() + intervalMinutes * 60000);
      const now = new Date();
      const diff = nextGenTime - now;

      // If we're past the generation time, show that we're waiting
      if (diff <= 0) {
        return isChecking ? 'Checking...' : 'Waiting for generation...';
      }

      // Format time left
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    // Update immediately
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign.status, campaign.posting_schedule, lastGenerationTime, isChecking]);

  return (
    <span className="font-mono font-medium text-gray-900">
      {timeLeft}
    </span>
  );
};

const CampaignsView = ({ orgId }) => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState(null);
  useEffect(() => {
    if (orgId) {
      fetchCampaigns();
    }
  }, [orgId]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/campaigns?org_id=${orgId}`);
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setShowConfigModal(true);
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setShowConfigModal(true);
  };

  const handleSaveCampaign = async (campaignData) => {
    try {
      console.log('Saving campaign...', campaignData);
      if (editingCampaign) {
        // Update existing campaign
        const response = await axios.put(`${BACKEND_URL}/api/campaigns/${editingCampaign.id}`, {
          ...campaignData,
          org_id: orgId,
          updated_by: user.id
        });
        console.log('Campaign updated:', response.data);
        setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? response.data : c));
        alert('✅ Campaign updated successfully!');
      } else {
        // Create new campaign
        const response = await axios.post(`${BACKEND_URL}/api/campaigns`, {
          ...campaignData,
          id: `camp_${Date.now()}`,
          org_id: orgId,
          created_by: user.id
        });
        console.log('Campaign created:', response.data);
        setCampaigns([...campaigns, response.data]);
        alert('✅ Campaign created successfully!');
      }
      setShowConfigModal(false);
      setEditingCampaign(null);
      fetchCampaigns(); // Refresh the list
    } catch (error) {
      console.error('Error saving campaign:', error);
      console.error('Error details:', error.response?.data);
      alert(`❌ Failed to save campaign: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleToggleCampaignStatus = async (campaignId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const response = await axios.patch(`${BACKEND_URL}/api/campaigns/${campaignId}/status`, {
        status: newStatus
      });
      setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error('Error toggling campaign status:', error);
      alert('Failed to update campaign status.');
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${BACKEND_URL}/api/campaigns/${campaignId}`);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign.');
    }
  };

  const handleViewAnalytics = (campaign) => {
    setAnalyticsCampaign(campaign);
    setShowAnalyticsModal(true);
  };

  const handleGenerateNow = async (campaignId) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/ai-content/generate`, {
        campaign_id: campaignId,
        org_id: orgId,
        user_api_key: user.openrouter_api_key
      });
      
      alert('✅ Post generated successfully! Check the Review Queue.');
      fetchCampaigns(); // Refresh to update post count
    } catch (error) {
      console.error('Error generating post:', error);
      alert(`❌ Failed to generate post: ${error.response?.data?.detail || error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 mb-6">Please select an organization to manage campaigns.</p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI-Powered Campaigns</h1>
            <p className="text-sm text-gray-600 mt-1">Autonomous LinkedIn content generation and posting</p>
          </div>
          <Button
            onClick={handleCreateCampaign}
            className="bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Campaigns Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first AI-powered campaign to automatically generate and post LinkedIn content.
            </p>
            <Button
              onClick={handleCreateCampaign}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Campaign
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize flex-shrink-0 ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>

                {/* Campaign Info */}
                <h3 className="text-lg font-bold text-gray-900 mb-2 break-words">{campaign.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 break-words">
                  {campaign.description || 'No description provided'}
                </p>

                {/* Metrics */}
                <div className="space-y-2 mb-4 pt-3 border-t border-gray-100">
                  {/* Countdown Timer - Featured */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-2 border border-blue-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-blue-900 flex items-center gap-1 flex-shrink-0">
                        <Timer className="w-4 h-4 flex-shrink-0 animate-pulse" />
                        Next Generation
                      </span>
                      <CountdownTimer 
                        campaign={campaign} 
                        orgId={orgId}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-600 flex items-center gap-1 flex-shrink-0">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      Next Post
                    </span>
                    <span className="font-medium text-gray-900 text-right truncate">
                      {campaign.next_post_time || 'Not scheduled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-600 flex items-center gap-1 flex-shrink-0">
                      <BarChart3 className="w-4 h-4 flex-shrink-0" />
                      Total Posts
                    </span>
                    <span className="font-medium text-gray-900">
                      {campaign.total_posts || 0}
                    </span>
                  </div>
                  {campaign.posting_schedule?.frequency && (
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-600 flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        Frequency
                      </span>
                      <span className="font-medium text-gray-900 capitalize text-right truncate">
                        {campaign.posting_schedule.frequency.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 mt-auto">
                  {/* Generate Now Button - Full Width */}
                  <Button
                    onClick={() => handleGenerateNow(campaign.id)}
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white text-sm flex items-center justify-center gap-2 py-2 font-semibold shadow-md"
                  >
                    <Zap className="w-4 h-4 flex-shrink-0" />
                    <span>Generate Now</span>
                  </Button>
                  
                  {/* Top Row: Analytics & Edit */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleViewAnalytics(campaign)}
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm flex items-center justify-center gap-1 py-2"
                    >
                      <BarChart3 className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Analytics</span>
                    </Button>
                    <Button
                      onClick={() => handleEditCampaign(campaign)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm flex items-center justify-center gap-1 py-2"
                    >
                      <Edit className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Edit</span>
                    </Button>
                  </div>
                  
                  {/* Bottom Row: Toggle & Delete */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleToggleCampaignStatus(campaign.id, campaign.status)}
                      className={`flex-1 text-sm flex items-center justify-center gap-1 py-2 ${
                        campaign.status === 'active'
                          ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                          : 'bg-green-100 hover:bg-green-200 text-green-800'
                      }`}
                    >
                      {campaign.status === 'active' ? (
                        <>
                          <Pause className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">Activate</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm flex items-center justify-center gap-1 py-2"
                    >
                      <Trash2 className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign Configuration Modal */}
      <CampaignConfigModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setEditingCampaign(null);
        }}
        onSave={handleSaveCampaign}
        initialData={editingCampaign}
        orgId={orgId}
      />

      {/* Campaign Analytics Modal */}
      <CampaignAnalyticsModal
        campaign={analyticsCampaign}
        isOpen={showAnalyticsModal}
        onClose={() => {
          setShowAnalyticsModal(false);
          setAnalyticsCampaign(null);
        }}
      />
    </div>
  );
};

export default CampaignsView;