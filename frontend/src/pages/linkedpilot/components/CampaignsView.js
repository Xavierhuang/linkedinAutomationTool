import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  TrendingUp, 
  Loader2, 
  Edit, 
  Pause, 
  Play, 
  Trash2, 
  Calendar, 
  Clock, 
  BarChart3, 
  Zap,
  MoreVertical 
} from 'lucide-react';
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
  }, [campaign.id, campaign.last_generation_time]);

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
  }, [campaign.id, campaign.status, orgId]);

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
        return 'Waiting...';
      }

      const lastGenTime = new Date(lastGenerationTime);
      const nextGenTime = new Date(lastGenTime.getTime() + intervalMinutes * 60000);
      const now = new Date();
      const diff = nextGenTime - now;

      // If we're past the generation time, show that we're waiting
      if (diff <= 0) {
        return isChecking ? 'Checking...' : 'Generating...';
      }

      // Format time left
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
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
    <span className="font-mono text-xs font-medium text-primary">
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
        user_id: user.id
      });
      
      alert('✅ Post generated successfully! Check the Review Queue.');
      fetchCampaigns(); // Refresh to update post count
    } catch (error) {
      console.error('Error generating post:', error);
      alert(`❌ Failed to generate post: ${error.response?.data?.detail || error.message}`);
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground text-sm mb-6">Please select an organization to manage campaigns.</p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="bg-background border-b border-border px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif italic text-foreground mb-2">Campaigns</h1>
            <p className="text-sm text-muted-foreground font-light">
              Manage your automated content campaigns
            </p>
          </div>
          <Button 
            onClick={handleCreateCampaign} 
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6 border-none shadow-[0_0_20px_rgba(136,217,231,0.2)] transition-all hover:shadow-[0_0_30px_rgba(136,217,231,0.3)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No Campaigns Yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-light">
              Create your first campaign to automate content generation based on your brand DNA.
            </p>
            <Button 
              onClick={handleCreateCampaign} 
              className="bg-accent/50 hover:bg-accent text-foreground rounded-full px-6 border border-border"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all group hover:shadow-2xl hover:shadow-black/50"
              >
                {/* Status Bar */}
                <div className={`h-1 w-full ${campaign.status === 'active' ? 'bg-primary' : 'bg-muted'}`} />
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-serif italic text-xl text-foreground truncate pr-2">
                          {campaign.name}
                        </h3>
                        <span className={`
                          px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
                          ${campaign.status === 'active' 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-muted text-muted-foreground border-border'}
                        `}>
                          {campaign.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 font-light h-10">
                        {campaign.description || 'No description provided'}
                      </p>
                    </div>
                    
                    {/* Actions Menu */}
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEditCampaign(campaign)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
                        title="Edit Settings"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Frequency
                      </div>
                      <div className="text-sm font-medium text-foreground capitalize">
                        {campaign.posting_schedule?.frequency?.replace(/_/g, ' ') || 'Weekly'}
                      </div>
                    </div>
                    
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Next Post
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        <CountdownTimer campaign={campaign} orgId={orgId} />
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Button
                      onClick={() => handleToggleCampaignStatus(campaign.id, campaign.status)}
                      variant="ghost"
                      className={`flex-1 h-9 text-xs rounded-lg border ${
                        campaign.status === 'active'
                          ? 'bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-accent/50'
                          : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                      }`}
                    >
                      {campaign.status === 'active' ? (
                        <><Pause className="w-3 h-3 mr-2" /> Pause</>
                      ) : (
                        <><Play className="w-3 h-3 mr-2" /> Resume</>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleGenerateNow(campaign.id)}
                      className="flex-1 h-9 text-xs bg-muted hover:bg-accent/50 text-foreground border border-border rounded-lg"
                    >
                      <Zap className="w-3 h-3 mr-2" /> Generate
                    </Button>

                    <Button
                      onClick={() => handleViewAnalytics(campaign)}
                      className="h-9 w-9 p-0 bg-muted hover:bg-accent/50 text-foreground border border-border rounded-lg flex items-center justify-center"
                      title="View Analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfigModal && (
        <CampaignConfigModal
          isOpen={showConfigModal}
          initialData={editingCampaign}
          onSave={handleSaveCampaign}
          onClose={() => {
            setShowConfigModal(false);
            setEditingCampaign(null);
          }}
          orgId={orgId}
        />
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && analyticsCampaign && (
        <CampaignAnalyticsModal
          campaign={analyticsCampaign}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}
    </div>
  );
};

export default CampaignsView;
