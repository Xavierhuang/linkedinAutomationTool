import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, RefreshCw, Share2, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AnalyticsView = ({ orgId }) => {
  const [analytics, setAnalytics] = useState({
    totalPosts: 0,
    impressions: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    clicks: 0
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchAnalytics();
    }
  }, [orgId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all published posts from all collections
      const postsResponse = await axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}`);
      const publishedPosts = postsResponse.data;
      
      // Fetch published scheduled posts
      const scheduledResponse = await axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&include_cancelled=true`);
      const scheduledPosts = scheduledResponse.data.filter(p => p.status === 'published');
      
      // Fetch AI-generated posted content
      let aiPosts = [];
      try {
        const aiResponse = await axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&include_posted=true`);
        // Filter for only posted ones (not approved/scheduled)
        aiPosts = aiResponse.data.filter(p => p.status === 'posted');
      } catch (error) {
        console.log('No AI posts or error fetching:', error);
      }
      
      // Combine all posts
      const allPosts = [...publishedPosts, ...scheduledPosts, ...aiPosts];
      
      console.log('Analytics fetched:', {
        manual: publishedPosts.length,
        scheduled: scheduledPosts.length,
        ai: aiPosts.length,
        total: allPosts.length
      });
      
      // Calculate totals
      const totals = allPosts.reduce((acc, post) => {
        return {
          totalPosts: acc.totalPosts + 1,
          impressions: acc.impressions + (post.impressions || 0),
          reactions: acc.reactions + (post.reactions || 0),
          comments: acc.comments + (post.comments || 0),
          shares: acc.shares + (post.shares || 0),
          clicks: acc.clicks + (post.clicks || 0)
        };
      }, {
        totalPosts: 0,
        impressions: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
        clicks: 0
      });
      
      setAnalytics(totals);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncAnalytics = async () => {
    try {
      setSyncing(true);
      const response = await axios.post(`${BACKEND_URL}/api/posts/sync-all-analytics?org_id=${orgId}`);
      await fetchAnalytics(); // Refresh data
      
      // Show success message with sync count
      const synced = response.data.synced || 0;
      const total = response.data.total || 0;
      
      if (synced > 0) {
        alert(`Successfully synced analytics for ${synced} post(s)!`);
      } else {
        alert('No posts found to sync. Publish posts first to see analytics.');
      }
    } catch (error) {
      console.error('Error syncing analytics:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to sync analytics: ${errorMsg}\n\nMake sure LinkedIn is connected in Settings.`);
    } finally {
      setSyncing(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 mb-6">Please select an organization to view analytics.</p>
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
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Track performance and engagement metrics</p>
          </div>
          <Button 
            onClick={syncAnalytics} 
            disabled={syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from LinkedIn'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : analytics.totalPosts === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Start Publishing to See Analytics</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Once you publish posts, detailed analytics and insights will appear here.
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard/drafts'}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Create Your First Post
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Total Posts</span>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalPosts)}</p>
              <p className="text-xs text-gray-500 mt-1">Published to LinkedIn</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Impressions</span>
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.impressions)}</p>
              <p className="text-xs text-gray-500 mt-1">Total views</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Reactions</span>
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.reactions)}</p>
              <p className="text-xs text-gray-500 mt-1">Likes & reactions</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Comments</span>
                <MessageCircle className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.comments)}</p>
              <p className="text-xs text-gray-500 mt-1">Total comments</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Shares</span>
                <Share2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.shares)}</p>
              <p className="text-xs text-gray-500 mt-1">Times shared</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Clicks</span>
                <MousePointerClick className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.clicks)}</p>
              <p className="text-xs text-gray-500 mt-1">Link clicks</p>
            </div>
          </div>
        )}

        {analytics.totalPosts > 0 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Real-Time Analytics</h4>
                  <p className="text-sm text-blue-700">
                    Click "Sync from LinkedIn" to fetch the latest analytics data from LinkedIn's API. 
                    Your account has Marketing API access, so you'll see real engagement metrics.
                  </p>
                </div>
              </div>
            </div>

            <PostsList orgId={orgId} onSync={fetchAnalytics} />
          </>
        )}
      </div>
    </div>
  );
};

const PostsList = ({ orgId, onSync }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingPostId, setSyncingPostId] = useState(null);

  useEffect(() => {
    if (orgId) {
      fetchPosts();
    }
  }, [orgId]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      // Fetch all published posts from all collections
      const postsResponse = await axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}`);
      const publishedPosts = postsResponse.data;
      
      const scheduledResponse = await axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&include_cancelled=true`);
      const scheduledPosts = scheduledResponse.data.filter(p => p.status === 'published');
      
      let aiPosts = [];
      try {
        const aiResponse = await axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&include_posted=true`);
        aiPosts = aiResponse.data.filter(p => p.status === 'posted');
      } catch (error) {
        console.log('No AI posts');
      }
      
      // Combine and sort by posted date
      const allPosts = [...publishedPosts, ...scheduledPosts, ...aiPosts]
        .sort((a, b) => new Date(b.posted_at || b.created_at) - new Date(a.posted_at || a.created_at));
      
      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncPostAnalytics = async (postId) => {
    try {
      setSyncingPostId(postId);
      await axios.post(`${BACKEND_URL}/api/posts/${postId}/sync-analytics`);
      await fetchPosts(); // Refresh posts
      if (onSync) onSync(); // Refresh parent analytics
    } catch (error) {
      console.error('Error syncing post analytics:', error);
      alert('Failed to sync analytics for this post');
    } finally {
      setSyncingPostId(null);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="mt-8 text-center py-8">
        <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-sm text-gray-600 mt-2">Loading posts...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Published Posts</h2>
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
            <div className="flex gap-4">
              {/* Post Content */}
              <div className="flex-1">
                <p className="text-gray-900 mb-3 line-clamp-3">
                  {post.content?.body || post.content || 'No content'}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Posted: {formatDate(post.posted_at || post.created_at)}</span>
                  {post.linkedin_post_id && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${post.linkedin_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View on LinkedIn
                    </a>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="flex gap-6 items-center">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-blue-600 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-lg font-bold">{formatNumber(post.impressions)}</span>
                  </div>
                  <span className="text-xs text-gray-600">Views</span>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-red-600 mb-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-lg font-bold">{formatNumber(post.reactions)}</span>
                  </div>
                  <span className="text-xs text-gray-600">Reactions</span>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-purple-600 mb-1">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-lg font-bold">{formatNumber(post.comments)}</span>
                  </div>
                  <span className="text-xs text-gray-600">Comments</span>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-green-600 mb-1">
                    <Share2 className="w-4 h-4" />
                    <span className="text-lg font-bold">{formatNumber(post.shares)}</span>
                  </div>
                  <span className="text-xs text-gray-600">Shares</span>
                </div>

                <Button
                  onClick={() => syncPostAnalytics(post.id)}
                  disabled={syncingPostId === post.id}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm px-3 py-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingPostId === post.id ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsView;
