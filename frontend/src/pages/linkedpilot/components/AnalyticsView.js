import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, FileText, Calendar, Sparkles, Clock, 
  Target, Zap, CheckCircle, Edit3, Hash, Image, Activity,
  Award, BookOpen, Timer
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
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground text-sm mb-6">Please select an organization to view analytics.</p>
        </div>
      </div>
    );
  }

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = 'blue' }) => (
    <div className="bg-card rounded-2xl border border-border p-6 hover:border-primary/50 transition-all group hover:shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`w-5 h-5 text-${color}-400 opacity-80 group-hover:opacity-100 transition-opacity`} />
      </div>
      <p className="text-3xl font-serif italic text-foreground mb-1">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="bg-background border-b border-border px-6 py-4">
        <div>
          <h1 className="text-3xl font-serif italic text-foreground mb-2">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground font-light">Comprehensive insights into your content strategy</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !analytics || analytics.totalPosts === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">Start Publishing to See Analytics</h3>
            <p className="text-muted-foreground max-w-md mx-auto font-light">
              Once you publish posts, comprehensive analytics will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* 1. Content Production Metrics */}
            <div className="animate-in fade-in duration-500">
              <h2 className="text-lg font-medium text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                <TrendingUp className="w-5 h-5 text-[#88D9E7]" />
                Content Production
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={FileText} label="Total Published" value={analytics.totalPosts} subtitle="All time" color="emerald" />
                <MetricCard icon={Sparkles} label="AI Generated" value={analytics.aiPosts} subtitle="AI-assisted posts" color="purple" />
                <MetricCard icon={Activity} label="This Week" value={analytics.postsThisWeek} subtitle="Last 7 days" color="blue" />
                <MetricCard icon={Target} label="Weekly Avg" value={analytics.avgPerWeek} subtitle="Posts per week" color="orange" />
              </div>
            </div>

            {/* 2. Content Quality Insights */}
            <div className="animate-in fade-in duration-500">
              <h2 className="text-lg font-medium text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                <Award className="w-5 h-5 text-blue-400" />
                Quality Insights
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Edit3} label="Avg Length" value={analytics.avgPostLength} subtitle="Characters" color="blue" />
                <MetricCard icon={Image} label="Media Rate" value={`${analytics.mediaRate}%`} subtitle="Posts with media" color="indigo" />
                <MetricCard icon={Hash} label="Avg Hashtags" value={analytics.avgHashtags} subtitle="Per post" color="pink" />
                <MetricCard icon={BookOpen} label="Text Only" value={`${(100 - analytics.mediaRate).toFixed(1)}%`} subtitle="Content mix" color="cyan" />
              </div>
            </div>

            {/* 3. Operational Efficiency */}
            <div className="animate-in fade-in duration-500">
              <h2 className="text-lg font-medium text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                <Zap className="w-5 h-5 text-orange-400" />
                Efficiency
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={FileText} label="Active Drafts" value={analytics.totalDrafts} subtitle="In progress" color="yellow" />
                <MetricCard icon={Clock} label="Next 7 Days" value={analytics.queueNext7} subtitle="Scheduled posts" color="emerald" />
                <MetricCard icon={Calendar} label="Next 30 Days" value={analytics.queueNext30} subtitle="Monthly pipeline" color="blue" />
                <MetricCard icon={Target} label="Active Campaigns" value={analytics.activeCampaigns} subtitle="Running now" color="rose" />
              </div>
            </div>

            {/* 4. AI Performance */}
            <div className="animate-in fade-in duration-500">
              <h2 className="text-lg font-medium text-foreground mb-6 flex items-center gap-3 border-b border-border pb-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI Performance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Sparkles} label="Generated" value={analytics.totalAIGenerated} subtitle="Total AI content" color="purple" />
                <MetricCard icon={CheckCircle} label="Approval Rate" value={`${analytics.aiAcceptanceRate}%`} subtitle="Content approved" color="green" />
                <MetricCard icon={TrendingUp} label="Published" value={analytics.aiPosted} subtitle="Live AI posts" color="blue" />
                <MetricCard icon={Timer} label="Time Saved" value={`~${Math.round(analytics.aiPosted * 0.5)}h`} subtitle="Estimated hours" color="orange" />
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#161616] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in duration-500">
              <h3 className="text-xl font-serif italic text-white mb-6">Executive Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm font-light leading-relaxed">
                <div className="space-y-4">
                  <p className="text-white/80">
                    <strong className="text-[#88D9E7] font-medium">Content Production:</strong> You've published <strong>{analytics.totalPosts} posts</strong> total, 
                    with <strong>{analytics.postsThisMonth} this month</strong>. Your scheduling consistency is <strong>{analytics.consistencyScore.toLowerCase()}</strong>.
                  </p>
                  <p className="text-white/80">
                    <strong className="text-[#88D9E7] font-medium">AI Impact:</strong> AI is driving your strategy with a <strong>{analytics.aiAcceptanceRate}% approval rate</strong>, 
                    saving an estimated <strong>{Math.round(analytics.aiPosted * 0.5)} hours</strong> of work.
                  </p>
                </div>
                <div className="space-y-4">
                  <p className="text-white/80">
                    <strong className="text-[#88D9E7] font-medium">Pipeline Health:</strong> You have <strong>{analytics.queueNext7} posts</strong> scheduled for next week, 
                    ensuring consistent audience engagement.
                  </p>
                  <p className="text-white/80">
                    <strong className="text-[#88D9E7] font-medium">Content Mix:</strong> Your posts average <strong>{analytics.avgPostLength} characters</strong>, 
                    with <strong>{analytics.mediaRate}%</strong> featuring visual media for higher engagement.
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
