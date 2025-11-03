import React, { useState, useEffect } from 'react';
import { Send, Calendar, CheckCircle, ExternalLink, TrendingUp, XCircle, Clock, AlertCircle, RefreshCw, Eye, Heart, MessageCircle, Share2, Grid3x3, List, Search, ChevronDown, MoreVertical, Trash2, Edit, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PostsView = ({ orgId }) => {
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list' - default to list
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

      // Delete each selected post
      for (const postId of selectedPosts) {
        console.log(`\n📝 Attempting to delete post: ${postId}`);
        
        try {
          // Try deleting from all possible collections
          const results = await Promise.allSettled([
            axios.delete(`${BACKEND_URL}/api/posts/${postId}`).catch(e => {
              console.log(`  ❌ Posts collection: ${e.response?.status} - ${e.response?.data?.detail || e.message}`);
              throw e;
            }),
            axios.delete(`${BACKEND_URL}/api/scheduled-posts/${postId}`).catch(e => {
              console.log(`  ❌ Scheduled posts collection: ${e.response?.status} - ${e.response?.data?.detail || e.message}`);
              throw e;
            }),
            axios.delete(`${BACKEND_URL}/api/ai-content/posts/${postId}`).catch(e => {
              console.log(`  ❌ AI content collection: ${e.response?.status} - ${e.response?.data?.detail || e.message}`);
              throw e;
            })
          ]);

          console.log('  Results:', results.map(r => r.status));

          // Check if at least one deletion succeeded (status 200-299)
          const anySuccess = results.some(r => {
            if (r.status === 'fulfilled') {
              console.log(`  ✅ Deleted successfully from one collection`);
              return true;
            }
            return false;
          });

          if (anySuccess) {
            successCount++;
            console.log(`  ✅ Post ${postId} deleted successfully`);
          } else {
            failCount++;
            const errorDetails = results.map(r => r.reason?.message || 'Unknown error').join(', ');
            errors.push(`Post ${postId}: ${errorDetails}`);
            console.error(`  ❌ Failed to delete post ${postId} from all collections`);
          }
        } catch (error) {
          failCount++;
          errors.push(`Post ${postId}: ${error.message}`);
          console.error(`  ❌ Error deleting post ${postId}:`, error);
        }
      }

      console.log(`\n📊 Deletion Summary: ${successCount} succeeded, ${failCount} failed`);

      if (successCount > 0) {
        alert(`Successfully deleted ${successCount} post(s)${failCount > 0 ? `. Failed to delete ${failCount} post(s).` : ''}`);
      } else {
        console.error('All deletions failed:', errors);
        alert(`Failed to delete all ${failCount} post(s). Check console for details:\n${errors.slice(0, 3).join('\n')}`);
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
        const scheduledPosts = scheduledResponse.data.map(p => ({ 
          ...p, 
          type: p.status === 'published' ? 'published' : p.status === 'failed' ? 'failed' : p.status === 'cancelled' ? 'cancelled' : 'scheduled',
          source: 'manual',
          content: p.draft_preview?.content?.body || ''
        }));
        allFetchedPosts.push(...scheduledPosts);
      } catch (error) {
        console.error('Error fetching scheduled posts:', error);
      }
      
      try {
        const aiApprovedResponse = await axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&include_posted=true`);
        const aiApproved = aiApprovedResponse.data.map(p => ({ 
          ...p, 
          type: p.status === 'posted' ? 'published' : p.status === 'failed' ? 'failed' : 'scheduled',
          source: 'ai'
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
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F5F5F5' }}>
            <Send className="w-8 h-8" style={{ color: '#9CA3AF' }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>No Organization Selected</h3>
          <p className="mb-6" style={{ color: '#6B7280', fontSize: '14px' }}>Please select an organization to view posts.</p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            style={{ backgroundColor: '#7FDBCB', color: '#FFFFFF' }}
            className="hover:opacity-90"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  // Filter and sort posts
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

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#FAFAFA' }}>
      {/* Header - Responsive */}
      <div className="px-4 md:px-6 py-4 md:py-6" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 m-0">Posts</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              onClick={importFromLinkedIn} 
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold px-3 md:px-4 py-2.5 md:py-2 rounded-md flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Import from LinkedIn</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button 
              onClick={fetchAllPosts}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-900 px-3 md:px-4 py-2.5 md:py-2 rounded-md"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Selection Bar (when in selection mode or items are selected) */}
      {(selectionMode || selectedPosts.length > 0) && filteredPosts && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#EFF6FF',
          borderBottom: '1px solid #BFDBFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '56px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E40AF' }}>
              {selectedPosts.length} of {filteredPosts.length} selected
            </span>
            <button
              onClick={() => {
                if (selectedPosts.length === filteredPosts.length) {
                  setSelectedPosts([]);
                } else {
                  setSelectedPosts(filteredPosts.map(p => p.id));
                }
              }}
              style={{
                fontSize: '13px',
                color: '#2563EB',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: 600,
                padding: '4px 8px'
              }}
              className="hover:bg-blue-100 rounded"
            >
              {selectedPosts.length === filteredPosts.length ? '✓ Deselect All' : 'Select All'}
            </button>
            <button
              onClick={() => {
                setSelectedPosts([]);
                setSelectionMode(false);
              }}
              style={{
                fontSize: '13px',
                color: '#6B7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: 500,
                padding: '4px 8px'
              }}
              className="hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
          {selectedPosts.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                onClick={() => handleBulkDelete()}
                className="bg-red-600 hover:bg-red-700 text-white"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '6px'
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
                Delete {selectedPosts.length} Post{selectedPosts.length > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar - Responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4">
        {/* Row 1: Tabs - Horizontal scroll on mobile */}
        <div className="flex gap-4 md:gap-6 mb-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitScrollbarDisplay: 'none' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 text-xs md:text-sm font-medium whitespace-nowrap pb-2 border-b-2 transition-all hover:text-gray-900 flex-shrink-0"
              style={{
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? '#2563EB' : '#6B7280',
                borderBottomColor: activeTab === tab.id ? '#2563EB' : 'transparent',
                background: 'none'
              }}
            >
              <span>{tab.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                backgroundColor: activeTab === tab.id ? '#DBEAFE' : '#F3F4F6',
                color: activeTab === tab.id ? '#1E40AF' : '#6B7280'
              }}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Row 2: Controls - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Left side: Sort and Search */}
          <div className="flex items-center gap-2 md:gap-3 flex-1">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 md:px-3 py-1.5 md:py-2 bg-gray-50 border border-gray-200 rounded-md text-xs md:text-sm font-medium text-gray-900 cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 md:pl-10 pr-2 md:pr-3 py-1.5 md:py-2 bg-gray-50 border border-gray-200 rounded-md text-xs md:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Right side: View Toggle */}
          <div className="flex gap-1 justify-end sm:justify-start">
            <button
              onClick={() => setViewMode('list')}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded border transition hover:bg-gray-100"
              style={{
                backgroundColor: viewMode === 'list' ? '#DBEAFE' : '#FAFAFA',
                borderColor: viewMode === 'list' ? '#2563EB' : '#E5E7EB'
              }}
            >
              <List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#2563EB' : '#6B7280' }} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded border transition hover:bg-gray-100"
              style={{
                backgroundColor: viewMode === 'grid' ? '#DBEAFE' : '#FAFAFA',
                borderColor: viewMode === 'grid' ? '#2563EB' : '#E5E7EB'
              }}
            >
              <Grid3x3 className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#2563EB' : '#6B7280' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Content - Responsive Padding */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading posts...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F5F5F5' }}>
              <Send className="w-8 h-8" style={{ color: '#9CA3AF' }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>No posts found</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>
              {searchQuery ? 'Try a different search term' : 'Create drafts and schedule posts to see them here'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView 
            posts={filteredPosts} 
            selectionMode={selectionMode}
            selectedPosts={selectedPosts}
            onToggleSelect={togglePostSelection}
          />
        ) : (
          <ListView 
            posts={filteredPosts}
            selectionMode={selectionMode}
            selectedPosts={selectedPosts}
            onToggleSelect={togglePostSelection}
            onEnterSelectionMode={enterSelectionMode}
          />
        )}
      </div>
    </div>
  );
};

// Grid View Component - Responsive
const GridView = ({ posts, selectionMode, selectedPosts, onToggleSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {posts.map(post => (
        <PostCard 
          key={post.id} 
          post={post}
          selectionMode={selectionMode}
          isSelected={selectedPosts.includes(post.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
};

// List View Component - Responsive
const ListView = ({ posts, selectionMode, selectedPosts, onToggleSelect, onEnterSelectionMode }) => {
  return (
    <div className="bg-white rounded-lg overflow-x-auto" style={{ minWidth: '100%' }}>
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectionMode ? '40px 35% 15% 15% 20% 10%' : '40% 15% 15% 20% 10%',
        backgroundColor: '#FFFFFF',
        borderBottom: '2px solid #E5E7EB',
        padding: '12px 16px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        minWidth: '700px'
      }}>
        {selectionMode && <div></div>}
        <div>CONTENT</div>
        <div>STATUS</div>
        <div>SOURCE</div>
        <div>METRICS</div>
        <div>ACTION</div>
      </div>

      {/* Table Rows */}
      {posts.map(post => (
        <PostRow 
          key={post.id} 
          post={post}
          selectionMode={selectionMode}
          isSelected={selectedPosts.includes(post.id)}
          onToggleSelect={onToggleSelect}
          onEnterSelectionMode={onEnterSelectionMode}
        />
      ))}
    </div>
  );
};

// Post Card Component (Grid)
const PostCard = ({ post, selectionMode, isSelected, onToggleSelect }) => {
  const [showActions, setShowActions] = useState(false);
  const badge = getStatusBadge(post.type);
  const date = post.posted_at || post.scheduled_for || post.publish_time || post.created_at;

  return (
    <div 
      onClick={() => selectionMode && onToggleSelect(post.id)}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: isSelected ? '2px solid #2563EB' : '1px solid #F0F0F0',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
      className="hover:shadow-md cursor-pointer"
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          zIndex: 10
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            border: isSelected ? '2px solid #2563EB' : '2px solid #D1D5DB',
            backgroundColor: isSelected ? '#2563EB' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            {isSelected && <Check style={{ width: '14px', height: '14px', color: '#FFFFFF' }} />}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid #F0F0F0' }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: badge.bg,
            color: badge.text,
            border: `1px solid ${badge.border}`
          }}>
            {badge.label}
          </span>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>
            {post.source === 'ai' ? 'AI' : 'Manual'}
          </span>
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
          <Calendar style={{ width: '12px', height: '12px' }} />
          <span>{date ? new Date(date).toLocaleDateString() : 'N/A'}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px', minHeight: '120px' }}>
        <p style={{ 
          fontSize: '12px', 
          color: '#1A1A1A', 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {post.content || 'No content available'}
        </p>
      </div>

      {/* Metrics */}
      {post.type === 'published' && (
        <div style={{ 
          padding: '12px',
          borderTop: '1px solid #F0F0F0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          <div className="flex items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
            <Eye style={{ width: '12px', height: '12px' }} />
            <span>{post.impressions || 0}</span>
          </div>
          <div className="flex items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
            <Heart style={{ width: '12px', height: '12px' }} />
            <span>{post.reactions || 0}</span>
          </div>
          <div className="flex items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
            <MessageCircle style={{ width: '12px', height: '12px' }} />
            <span>{post.comments || 0}</span>
          </div>
          <div className="flex items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
            <Share2 style={{ width: '12px', height: '12px' }} />
            <span>{post.shares || 0}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid #F0F0F0' }}>
        {post.platform_url ? (
          <a 
            href={post.platform_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 hover:underline"
            style={{ fontSize: '12px', fontWeight: 500, color: '#2563EB' }}
          >
            <ExternalLink style={{ width: '14px', height: '14px' }} />
            View on LinkedIn
          </a>
        ) : (
          <div className="text-center" style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {post.type === 'scheduled' && (date ? new Date(date).toLocaleTimeString() : 'Scheduled')}
            {post.type === 'pending' && 'Awaiting Review'}
            {post.type === 'failed' && 'Posting Failed'}
          </div>
        )}
      </div>
    </div>
  );
};

// Post Row Component (List)
const PostRow = ({ post, selectionMode, isSelected, onToggleSelect, onEnterSelectionMode }) => {
  const [showActions, setShowActions] = useState(false);
  const badge = getStatusBadge(post.type);
  const date = post.posted_at || post.scheduled_for || post.publish_time || post.created_at;

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: selectionMode ? '40px 35% 15% 15% 20% 10%' : '40% 15% 15% 20% 10%',
        padding: '16px',
        borderBottom: '1px solid #F0F0F0',
        fontSize: '14px',
        color: '#1A1A1A',
        alignItems: 'center',
        transition: 'background-color 0.15s ease',
        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
        minWidth: '700px'
      }}
      className="hover:bg-gray-50"
    >
      {/* Selection Checkbox - Only show when in selection mode */}
      {selectionMode && (
        <div>
          <div 
            onClick={() => onToggleSelect(post.id)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: isSelected ? '2px solid #2563EB' : '2px solid #D1D5DB',
              backgroundColor: isSelected ? '#2563EB' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {isSelected && <Check style={{ width: '14px', height: '14px', color: '#FFFFFF' }} />}
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        <p style={{ 
          fontSize: '14px',
          fontWeight: 500,
          color: '#1A1A1A',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {post.content?.substring(0, 60) || 'No content'}...
        </p>
        <p style={{ fontSize: '12px', color: '#6B7280' }}>
          {date ? new Date(date).toLocaleDateString() : 'N/A'}
        </p>
      </div>

      {/* Status */}
      <div>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: badge.bg,
          color: badge.text,
          border: `1px solid ${badge.border}`,
          display: 'inline-block'
        }}>
          {badge.label}
        </span>
      </div>

      {/* Source */}
      <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
        {post.source === 'ai' ? 'AI Generated' : 'Manual'}
      </div>

      {/* Metrics */}
      <div>
        {post.type === 'published' ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" style={{ fontSize: '12px', color: '#6B7280' }}>
              <Eye style={{ width: '14px', height: '14px' }} />
              <span>{post.impressions || 0}</span>
            </div>
            <div className="flex items-center gap-1" style={{ fontSize: '12px', color: '#6B7280' }}>
              <Heart style={{ width: '14px', height: '14px' }} />
              <span>{post.reactions || 0}</span>
            </div>
            <div className="flex items-center gap-1" style={{ fontSize: '12px', color: '#6B7280' }}>
              <MessageCircle style={{ width: '14px', height: '14px' }} />
              <span>{post.comments || 0}</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>—</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowActions(!showActions)}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          className="hover:bg-gray-100"
        >
          <MoreVertical style={{ width: '20px', height: '20px', color: '#9CA3AF' }} />
        </button>

        {showActions && (
          <div style={{
            position: 'fixed',
            right: '24px',
            marginTop: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            minWidth: '180px'
          }}>
            <button 
              onClick={() => {
                onEnterSelectionMode(post.id);
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" 
              style={{ color: '#1A1A1A' }}
            >
              <Check style={{ width: '14px', height: '14px' }} />
              Select
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" style={{ color: '#1A1A1A' }}>
              <Edit style={{ width: '14px', height: '14px' }} />
              Edit
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" style={{ color: '#1A1A1A' }}>
              <Copy style={{ width: '14px', height: '14px' }} />
              Duplicate
            </button>
            {post.platform_url && (
              <a 
                href={post.platform_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                style={{ color: '#1A1A1A' }}
              >
                <ExternalLink style={{ width: '14px', height: '14px' }} />
                View on LinkedIn
              </a>
            )}
            <button 
              onClick={async () => {
                setShowActions(false);
                if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
                  try {
                    // Try deleting from all possible collections
                    await Promise.allSettled([
                      axios.delete(`${BACKEND_URL}/api/posts/${post.id}`),
                      axios.delete(`${BACKEND_URL}/api/scheduled-posts/${post.id}`),
                      axios.delete(`${BACKEND_URL}/api/ai-content/posts/${post.id}`)
                    ]);
                    
                    // Refresh the posts list
                    window.location.reload();
                  } catch (error) {
                    console.error('Error deleting post:', error);
                    alert('Failed to delete post. Please try again.');
                  }
                }
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-red-50" 
              style={{ color: '#EF4444' }}
            >
              <Trash2 style={{ width: '14px', height: '14px' }} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function for status badges
const getStatusBadge = (type) => {
  const badges = {
    published: { 
      bg: '#D1FAE5', 
      text: '#065F46', 
      border: '#A7F3D0', 
      label: 'Published' 
    },
    scheduled: { 
      bg: '#FEF3C7', 
      text: '#92400E', 
      border: '#FDE68A', 
      label: 'Scheduled' 
    },
    pending: { 
      bg: '#E0E7FF', 
      text: '#3730A3', 
      border: '#C7D2FE', 
      label: 'Pending' 
    },
    failed: { 
      bg: '#FEE2E2', 
      text: '#991B1B', 
      border: '#FECACA', 
      label: 'Failed' 
    },
    cancelled: { 
      bg: '#F3E8FF', 
      text: '#6B21A8', 
      border: '#E9D5FF', 
      label: 'Cancelled' 
    }
  };
  return badges[type] || badges.pending;
};

export default PostsView;
