import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, FileText, Calendar, Sparkles, Clock, 
  Target, Zap, CheckCircle, Edit3, Hash, Image, Activity,
  TrendingDown, Award, BookOpen, Timer
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AnalyticsView = ({ orgId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) {
      fetchAnalytics();
    }
  }, [orgId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all data sources
      const [postsRes, scheduledRes, draftsRes, aiContentRes, campaignsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}`),
        axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&include_cancelled=true`),
        axios.get(`${BACKEND_URL}/api/drafts?org_id=${orgId}`),
        axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&include_posted=true`).catch(() => ({ data: [] })),
        axios.get(`${BACKEND_URL}/api/campaigns?org_id=${orgId}`).catch(() => ({ data: [] }))
      ]);

      const publishedPosts = postsRes.data;
      const scheduledPosts = scheduledRes.data;
      const drafts = draftsRes.data;
      const aiContent = aiContentRes.data;
      const campaigns = campaignsRes.data;

      // Filter for published scheduled posts
      const publishedScheduled = scheduledPosts.filter(p => p.status === 'published');
      const pendingScheduled = scheduledPosts.filter(p => p.status === 'scheduled' || p.status === 'pending');
      
      // Filter AI posts
      const aiPosted = aiContent.filter(p => p.status === 'posted');
      const aiApproved = aiContent.filter(p => p.status === 'approved' || p.status === 'posted');

      // Combine all published posts
      const allPublished = [...publishedPosts, ...publishedScheduled, ...aiPosted];

      // Calculate metrics
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const postsThisWeek = allPublished.filter(p => {
        const date = new Date(p.created_at || p.published_at || p.scheduled_time);
        return date >= weekAgo;
      }).length;

      const postsThisMonth = allPublished.filter(p => {
        const date = new Date(p.created_at || p.published_at || p.scheduled_time);
        return date >= monthAgo;
      }).length;

      // Content quality metrics
      const postsWithMedia = allPublished.filter(p => p.image_url || p.media_url).length;
      const avgPostLength = allPublished.length > 0 
        ? Math.round(allPublished.reduce((sum, p) => sum + (p.content?.length || 0), 0) / allPublished.length)
        : 0;

      const totalHashtags = allPublished.reduce((sum, p) => {
        const matches = (p.content || '').match(/#\w+/g);
        return sum + (matches ? matches.length : 0);
      }, 0);
      const avgHashtags = allPublished.length > 0 ? (totalHashtags / allPublished.length).toFixed(1) : 0;

      // Scheduling metrics
      const next7Days = pendingScheduled.filter(p => {
        const date = new Date(p.scheduled_time);
        return date <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }).length;

      const next30Days = pendingScheduled.filter(p => {
        const date = new Date(p.scheduled_time);
        return date <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }).length;

      // Draft conversion
      const totalDrafts = drafts.length + allPublished.length;
      const conversionRate = totalDrafts > 0 ? ((allPublished.length / totalDrafts) * 100).toFixed(1) : 0;

      // AI metrics
      const aiAcceptanceRate = aiContent.length > 0 ? ((aiApproved.length / aiContent.length) * 100).toFixed(1) : 0;

      // Time-based analysis
      const postingDays = {};
      allPublished.forEach(p => {
        const date = new Date(p.created_at || p.published_at || p.scheduled_time);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        postingDays[dayName] = (postingDays[dayName] || 0) + 1;
      });

      const peakDay = Object.entries(postingDays).sort((a, b) => b[1] - a[1])[0];

      setAnalytics({
        // Content Production
        totalPosts: allPublished.length,
        manualPosts: publishedPosts.length,
        scheduledPosts: publishedScheduled.length,
        aiPosts: aiPosted.length,
        postsThisWeek,
        postsThisMonth,
        avgPerWeek: (postsThisMonth / 4.3).toFixed(1),
        
        // Content Quality
        avgPostLength,
        mediaRate: allPublished.length > 0 ? ((postsWithMedia / allPublished.length) * 100).toFixed(1) : 0,
        avgHashtags,
        
        // Operational
        totalDrafts: drafts.length,
        conversionRate,
        queueNext7: next7Days,
        queueNext30: next30Days,
        activeCampaigns: campaigns.filter(c => c.status === 'active').length,
        
        // AI Performance
        totalAIGenerated: aiContent.length,
        aiAcceptanceRate,
        aiPosted: aiPosted.length,
        
        // Scheduling
        peakDay: peakDay ? `${peakDay[0]} (${peakDay[1]} posts)` : 'N/A',
        consistencyScore: postsThisMonth >= 20 ? 'Excellent' : postsThisMonth >= 10 ? 'Good' : postsThisMonth >= 5 ? 'Fair' : 'Low'
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600">Please select an organization to view analytics.</p>
        </div>
      </div>
    );
  }

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = 'blue' }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Comprehensive insights into your content strategy</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : !analytics || analytics.totalPosts === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Start Publishing to See Analytics</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Once you publish posts, comprehensive analytics will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Content Production Metrics */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Content Production Metrics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={FileText} label="Total Posts Published" value={analytics.totalPosts} subtitle="All time" color="green" />
                <MetricCard icon={FileText} label="Manual Posts" value={analytics.manualPosts} subtitle="Created manually" color="blue" />
                <MetricCard icon={Sparkles} label="AI Posts" value={analytics.aiPosts} subtitle="AI-generated" color="purple" />
                <MetricCard icon={Calendar} label="Scheduled Posts" value={analytics.scheduledPosts} subtitle="Pre-scheduled" color="orange" />
                <MetricCard icon={Activity} label="Posts This Week" value={analytics.postsThisWeek} subtitle="Last 7 days" color="green" />
                <MetricCard icon={TrendingUp} label="Posts This Month" value={analytics.postsThisMonth} subtitle="Last 30 days" color="blue" />
                <MetricCard icon={Target} label="Avg Posts Per Week" value={analytics.avgPerWeek} subtitle="Monthly average" color="purple" />
                <MetricCard icon={CheckCircle} label="Draft Conversion Rate" value={`${analytics.conversionRate}%`} subtitle="Drafts published" color="green" />
              </div>
            </div>

            {/* 2. Content Quality Insights */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                Content Quality Insights
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Edit3} label="Avg Post Length" value={analytics.avgPostLength} subtitle="Characters per post" color="blue" />
                <MetricCard icon={Image} label="Media Attachment Rate" value={`${analytics.mediaRate}%`} subtitle="Posts with media" color="purple" />
                <MetricCard icon={Hash} label="Avg Hashtags" value={analytics.avgHashtags} subtitle="Per post" color="green" />
                <MetricCard icon={BookOpen} label="Content Mix" value={`${(100 - analytics.mediaRate).toFixed(1)}%`} subtitle="Text-only posts" color="orange" />
              </div>
            </div>

            {/* 3. Operational Efficiency */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600" />
                Operational Efficiency
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={FileText} label="Active Drafts" value={analytics.totalDrafts} subtitle="In progress" color="blue" />
                <MetricCard icon={Clock} label="Queue Next 7 Days" value={analytics.queueNext7} subtitle="Upcoming posts" color="green" />
                <MetricCard icon={Calendar} label="Queue Next 30 Days" value={analytics.queueNext30} subtitle="Monthly pipeline" color="purple" />
                <MetricCard icon={Target} label="Active Campaigns" value={analytics.activeCampaigns} subtitle="Running campaigns" color="orange" />
              </div>
            </div>

            {/* 4. Scheduling Intelligence */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Scheduling Intelligence
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard icon={TrendingUp} label="Peak Publishing Day" value={analytics.peakDay.split(' ')[0]} subtitle={analytics.peakDay} color="purple" />
                <MetricCard icon={Activity} label="Consistency Score" value={analytics.consistencyScore} subtitle="Posting regularity" color="green" />
                <MetricCard icon={Calendar} label="Calendar Fill Rate" value={`${analytics.queueNext30 > 0 ? 'Active' : 'Low'}`} subtitle={`${analytics.queueNext30} scheduled`} color="blue" />
              </div>
            </div>

            {/* 5. AI Performance */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-600" />
                AI Performance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Sparkles} label="Total AI Generated" value={analytics.totalAIGenerated} subtitle="All AI content" color="purple" />
                <MetricCard icon={CheckCircle} label="AI Acceptance Rate" value={`${analytics.aiAcceptanceRate}%`} subtitle="Approved/Posted" color="green" />
                <MetricCard icon={TrendingUp} label="AI Posts Published" value={analytics.aiPosted} subtitle="Successfully posted" color="blue" />
                <MetricCard icon={Timer} label="Time Saved" value={`~${Math.round(analytics.aiPosted * 0.5)}h`} subtitle="Est. hours saved" color="orange" />
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-700">
                    <strong>Content Production:</strong> You've published <strong>{analytics.totalPosts} posts</strong> total, 
                    with <strong>{analytics.postsThisMonth} this month</strong>.
                  </p>
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>AI Utilization:</strong> <strong>{analytics.aiAcceptanceRate}%</strong> of AI-generated content 
                    is approved, saving ~<strong>{Math.round(analytics.aiPosted * 0.5)} hours</strong>.
                  </p>
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Publishing Schedule:</strong> <strong>{analytics.queueNext7} posts</strong> scheduled for next week, 
                    maintaining <strong>{analytics.consistencyScore.toLowerCase()}</strong> consistency.
                  </p>
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Content Quality:</strong> Avg <strong>{analytics.avgPostLength} characters</strong> per post, 
                    <strong>{analytics.mediaRate}%</strong> include media.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;
