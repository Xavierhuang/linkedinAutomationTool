import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Calendar, 
  CheckCircle, 
  ExternalLink, 
  TrendingUp, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Grid3x3, 
  List, 
  Search, 
  ChevronDown, 
  MoreVertical, 
  Trash2, 
  Edit, 
  Copy, 
  Check,
  Linkedin,
  Loader2,
  FileText,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PostsView = ({ orgId }) => {
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchAllPosts();
    }
  }, [orgId]);

  const importFromLinkedIn = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${BACKEND_URL}/api/posts/import-from-linkedin?org_id=${orgId}`);
      alert(`Successfully imported ${response.data.imported} new posts and updated ${response.data.updated} existing posts!`);
      await fetchAllPosts();
    } catch (error) {
      console.error('Error importing from LinkedIn:', error);
      alert(`Failed to import: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const togglePostSelection = (postId) => {
    setSelectedPosts(prev => {
      if (prev.includes(postId)) {
        return prev.filter(id => id !== postId);
      } else {
        return [...prev, postId];
      }
    });
  };

  const enterSelectionMode = (postId) => {
    setSelectionMode(true);
    setSelectedPosts([postId]);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedPosts.length} post(s)? This action cannot be undone.`)) {
      return;
    }

    console.log('🗑️ Starting bulk delete for posts:', selectedPosts);

    try {
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const postId of selectedPosts) {
        try {
          const results = await Promise.allSettled([
            axios.delete(`${BACKEND_URL}/api/posts/${postId}`),
            axios.delete(`${BACKEND_URL}/api/scheduled-posts/${postId}`),
            axios.delete(`${BACKEND_URL}/api/ai-content/posts/${postId}`)
          ]);

          const anySuccess = results.some(r => r.status === 'fulfilled');

          if (anySuccess) {
            successCount++;
          } else {
            failCount++;
            errors.push(`Post ${postId}: Failed to delete from all collections`);
          }
        } catch (error) {
          failCount++;
          errors.push(`Post ${postId}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        alert(`Successfully deleted ${successCount} post(s)${failCount > 0 ? `. Failed to delete ${failCount} post(s).` : ''}`);
      } else {
        alert(`Failed to delete all ${failCount} post(s). Check console for details.`);
      }

      setSelectedPosts([]);
      setSelectionMode(false);
      await fetchAllPosts();
    } catch (error) {
      console.error('❌ Error in bulk delete:', error);
      alert('Failed to delete posts. Please try again.');
    }
  };

  const fetchAllPosts = async () => {
    try {
      setLoading(true);
      let allFetchedPosts = [];
      
      try {
        const publishedResponse = await axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}`);
        const publishedPosts = publishedResponse.data.map(p => ({ ...p, type: 'published', source: p.source || 'manual' }));
        allFetchedPosts.push(...publishedPosts);
      } catch (error) {
        console.error('Error fetching published posts:', error);
      }
      
      try {
        const scheduledResponse = await axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&include_cancelled=true`);
        const scheduledPosts = scheduledResponse.data.map(p => {
          // Extract image from draft_preview assets
          let imageUrl = p.image_url;
          if (!imageUrl && p.draft_preview?.assets) {
            const imageAsset = p.draft_preview.assets.find(asset => asset.type === 'image');
            if (imageAsset) {
              imageUrl = imageAsset.url || imageAsset.s3_key;
            }
          }
          // Also check if image is in content
          if (!imageUrl && p.draft_preview?.content?.image_url) {
            imageUrl = p.draft_preview.content.image_url;
          }
          
          return {
            ...p,
            type: p.status === 'published' ? 'published' : p.status === 'failed' ? 'failed' : p.status === 'cancelled' ? 'cancelled' : 'scheduled',
            source: 'manual',
            content: p.draft_preview?.content?.body || '',
            image_url: imageUrl || p.image_url // Use extracted image or fallback to existing image_url
          };
        });
        allFetchedPosts.push(...scheduledPosts);
      } catch (error) {
        console.error('Error fetching scheduled posts:', error);
      }
      
      try {
        const aiApprovedResponse = await axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&include_posted=true`);
        const aiApproved = aiApprovedResponse.data.map(p => ({ 
          ...p, 
          type: p.status === 'posted' ? 'published' : p.status === 'failed' ? 'failed' : 'scheduled',
          source: 'ai',
          image_url: p.image_url || null // AI posts already have image_url field
        }));
        allFetchedPosts.push(...aiApproved);
      } catch (error) {
        console.error('Error fetching AI approved posts:', error);
      }
      
      try {
        const aiReviewResponse = await axios.get(`${BACKEND_URL}/api/ai-content/review-queue?org_id=${orgId}`);
        const aiReview = aiReviewResponse.data.map(p => ({ ...p, type: 'pending', source: 'ai' }));
        allFetchedPosts.push(...aiReview);
      } catch (error) {
        console.error('Error fetching AI review queue:', error);
      }
      
      setAllPosts(allFetchedPosts);
    } catch (error) {
      console.error('Error in fetchAllPosts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10 text-primary">
            <Send className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="mb-6 text-muted-foreground text-sm">Please select an organization to view posts.</p>
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

  const filteredPosts = allPosts
    .filter(post => {
      if (activeTab !== 'all' && post.type !== activeTab) return false;
      if (searchQuery && !post.content?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.posted_at || a.scheduled_for || a.publish_time || a.created_at);
      const dateB = new Date(b.posted_at || b.scheduled_for || b.publish_time || b.created_at);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const counts = {
    all: allPosts.length,
    published: allPosts.filter(p => p.type === 'published').length,
    scheduled: allPosts.filter(p => p.type === 'scheduled').length,
    failed: allPosts.filter(p => p.type === 'failed').length,
    cancelled: allPosts.filter(p => p.type === 'cancelled').length,
    pending: allPosts.filter(p => p.type === 'pending').length
  };

  const tabs = [
    { id: 'all', label: 'All Posts' },
    { id: 'published', label: 'Published' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'pending', label: 'Pending' },
    { id: 'failed', label: 'Failed' },
    { id: 'cancelled', label: 'Cancelled' }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-serif italic text-foreground mb-2">Posts</h1>
            <p className="text-sm text-muted-foreground font-light">
              Manage and track your content across all channels
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={importFromLinkedIn} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full px-4 h-9 text-xs border-none flex items-center gap-2"
            >
              <Linkedin className="w-3.5 h-3.5" />
              Import
            </Button>
            <Button 
              onClick={fetchAllPosts}
              className="bg-accent/50 hover:bg-accent text-foreground rounded-full h-9 w-9 p-0 border border-border"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search & Filter */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 outline-none transition-all"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-input border border-border rounded-full px-4 py-2 text-sm text-muted-foreground focus:border-primary/50 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <div className="flex bg-secondary rounded-full p-1 border border-border">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mt-6 no-scrollbar border-b border-border pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all
                ${activeTab === tab.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
              `}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selection Bar */}
      {(selectionMode || selectedPosts.length > 0) && (
        <div className="px-6 py-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-primary">
              {selectedPosts.length} selected
            </span>
            <button
              onClick={() => {
                if (selectedPosts.length === filteredPosts.length) {
                  setSelectedPosts([]);
                } else {
                  setSelectedPosts(filteredPosts.map(p => p.id));
                }
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {selectedPosts.length === filteredPosts.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleBulkDelete}
              className="h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-2" /> Delete Selected
            </Button>
            <Button
              onClick={() => {
                setSelectedPosts([]);
                setSelectionMode(false);
              }}
              variant="ghost"
              className="h-8 text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No Posts Found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto font-light">
              {searchQuery ? 'Try adjusting your search terms' : 'Start creating content to see posts here'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <div
          key={post.id} 
                className={`
                  group relative bg-card border rounded-xl p-4 transition-all hover:shadow-xl
                  ${selectedPosts.includes(post.id) 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border hover:border-primary/50'}
                `}
              >
                <div className="flex gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <div
                      onClick={() => togglePostSelection(post.id)}
                      className={`
                        w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-colors
                        ${selectedPosts.includes(post.id)
                          ? 'bg-primary border-primary'
                          : 'border-border hover:border-primary bg-transparent'}
                      `}
                    >
                      {selectedPosts.includes(post.id) && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
        </div>
      </div>

                  {/* Image Thumbnail */}
                  {post.image_url && (
                    <div className="w-24 h-24 rounded-lg bg-muted flex-shrink-0 overflow-hidden border border-border">
                      <img
                        src={post.image_url}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
        </div>
      )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`
                          px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                          ${post.type === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            post.type === 'scheduled' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            post.type === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}
                        `}>
                          {post.type}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDate(post.posted_at || post.scheduled_for || post.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {post.platform_url && (
                        <a 
                          href={post.platform_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg"
                            title="View on LinkedIn"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
          </div>

                    <p className="text-sm text-foreground/80 line-clamp-2 mb-3 font-light leading-relaxed">
                      {post.content || 'No content'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {post.source === 'ai' ? <Zap className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                        {post.source === 'ai' ? 'AI Generated' : 'Manual'}
                      </span>
                      {post.likes_count !== undefined && (
                        <>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {post.likes_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> {post.comments_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {post.views_count || 0}
                          </span>
                        </>
        )}
      </div>
    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={`
                  group relative bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1
                  ${selectedPosts.includes(post.id) 
                    ? 'border-primary/50' 
                    : 'border-border hover:border-primary/50'}
                `}
              >
                {/* Selection Overlay */}
                <div 
                  className="absolute top-3 left-3 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePostSelection(post.id);
                  }}
                >
                  <div className={`
                    w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-colors
                    ${selectedPosts.includes(post.id)
                      ? 'bg-primary border-primary'
                      : 'bg-background/40 border-border hover:border-primary/60 backdrop-blur-sm'}
                  `}>
                    {selectedPosts.includes(post.id) && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                </div>

                {/* Image */}
                <div className="h-48 bg-muted/20 relative">
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <div className="text-muted-foreground/20">
                        <FileText className="w-12 h-12" />
          </div>
        </div>
      )}
                  <div className="absolute top-3 right-3">
                    <span className={`
                      px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md
                      ${post.type === 'published' ? 'bg-emerald-500/20 text-emerald-400' :
                        post.type === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        post.type === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'}
                    `}>
                      {post.type}
        </span>
      </div>
      </div>

                <div className="p-5">
                  <p className="text-sm text-foreground/80 line-clamp-3 mb-4 font-light leading-relaxed min-h-[4.5em]">
                    {post.content || 'No content'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatDate(post.posted_at || post.scheduled_for || post.created_at)}
                    </span>
            {post.platform_url && (
              <a 
                href={post.platform_url}
                target="_blank"
                rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
              >
                        <ExternalLink className="w-4 h-4" />
              </a>
            )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostsView;
