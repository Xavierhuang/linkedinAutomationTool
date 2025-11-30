import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  Trash2, 
  Loader2, 
  Calendar, 
  Clock, 
  Target, 
  Save, 
  X, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ReviewQueueView = ({ orgId }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [saveStatus, setSaveStatus] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchReviewQueue();
    }
  }, [orgId]);

  const fetchReviewQueue = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/ai-content/review-queue?org_id=${orgId}`);
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching review queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (postId) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  const handleEditClick = (post, e) => {
    e.stopPropagation();
    setEditingPost(post);
    setEditedContent(post.content);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    
    setSaveStatus(prev => ({ ...prev, [editingPost.id]: 'saving' }));
    try {
      await axios.put(`${BACKEND_URL}/api/ai-content/posts/${editingPost.id}`, { content: editedContent });
      setPosts(posts.map(p => p.id === editingPost.id ? { ...p, content: editedContent, updated_at: new Date().toISOString() } : p));
      setShowEditModal(false);
      setEditingPost(null);
      setSaveStatus(prev => ({ ...prev, [editingPost.id]: 'success' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [editingPost.id]: null })), 2000);
      alert('Post updated successfully!');
    } catch (error) {
      console.error('Error saving post content:', error);
      setSaveStatus(prev => ({ ...prev, [editingPost.id]: 'error' }));
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleApprove = async (postId, e) => {
    e.stopPropagation();
    try {
      await axios.post(`${BACKEND_URL}/api/ai-content/posts/${postId}/approve`);
      fetchReviewQueue();
    } catch (error) {
      console.error('Error approving post:', error);
      alert('Failed to approve post.');
    }
  };

  const handleReject = async (postId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to reject this post?')) return;
    try {
      await axios.post(`${BACKEND_URL}/api/ai-content/posts/${postId}/reject`);
      fetchReviewQueue();
    } catch (error) {
      console.error('Error rejecting post:', error);
      alert('Failed to reject post.');
    }
  };

  const handleDelete = async (postId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this post?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/ai-content/posts/${postId}`);
      fetchReviewQueue();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post.');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return { month: 'N/A', day: '00', year: '0000' };
    const date = new Date(isoString);
    return {
      month: date.toLocaleString('en', { month: 'short' }),
      day: date.getDate().toString().padStart(2, '0'),
      year: date.getFullYear(),
    };
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground mb-6 text-sm">Please select an organization to manage your review queue.</p>
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
      <div className="px-6 py-4 border-b border-border bg-background">
        <div>
          <h1 className="text-3xl font-serif italic text-foreground mb-2">Review Queue</h1>
          <p className="text-sm text-muted-foreground font-light">
            Review and approve AI-generated content before posting.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">All Caught Up</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-light">
              No posts pending review. Check back later or create a new campaign.
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard/campaigns'}
              className="bg-accent/50 hover:bg-accent text-foreground rounded-full px-6 border border-border"
            >
              Go to Campaigns
            </Button>
          </div>
        ) : (
          <div className="relative max-w-3xl mx-auto">
            {/* Timeline Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

            <div className="space-y-12 relative">
              {posts.map((post, index) => {
                const date = formatDate(post.created_at);
                const isExpanded = expandedPostId === post.id;

                return (
                  <div key={post.id} className="relative grid grid-cols-[60px_1fr] md:grid-cols-[1fr_60px_1fr] gap-6 md:gap-0 items-start group">
                    {/* Left Side (Date/Card depending on layout) */}
                    <div className="hidden md:block text-right pr-8 pt-2">
                      {index % 2 === 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="text-3xl font-serif italic text-muted-foreground/40 group-hover:text-primary transition-colors">
                            {date.day}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                            {date.month} {date.year}
                          </span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleCardClick(post.id)}
                          className={`
                            bg-card border rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl text-left
                            ${isExpanded ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'}
                          `}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-serif italic text-lg text-foreground truncate max-w-[200px]">
                              {post.campaign_name || 'Campaign Post'}
                            </h3>
                            <div className="flex gap-2">
                              {post.content_type && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground uppercase tracking-wide">
                                  {post.content_type}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 line-clamp-3 font-light leading-relaxed mb-4">
                            {post.content}
                          </p>
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={(e) => handleReject(post.id, e)}
                              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => handleEditClick(post, e)}
                              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => handleApprove(post.id, e)}
                              className="p-2 bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground transition-colors shadow-[0_0_15px_rgba(136,217,231,0.2)]"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Center Dot */}
                    <div className="relative flex justify-center pt-3">
                      <div className="w-3 h-3 rounded-full bg-background border-2 border-primary shadow-[0_0_10px_rgba(136,217,231,0.5)] z-10" />
                    </div>

                    {/* Right Side */}
                    <div className="pl-0 md:pl-8 pt-2">
                      <div className="md:hidden mb-4 pl-2">
                        <span className="text-2xl font-serif italic text-primary mr-2">
                          {date.day}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                          {date.month} {date.year}
                        </span>
                      </div>

                      {index % 2 !== 0 ? (
                        <div className="hidden md:flex flex-col items-start">
                          <span className="text-3xl font-serif italic text-muted-foreground/40 group-hover:text-primary transition-colors">
                            {date.day}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                            {date.month} {date.year}
                          </span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleCardClick(post.id)}
                          className={`
                            bg-card border rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl
                            ${isExpanded ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'}
                          `}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-serif italic text-lg text-foreground truncate max-w-[200px]">
                              {post.campaign_name || 'Campaign Post'}
                            </h3>
                            <div className="flex gap-2">
                              {post.content_type && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground uppercase tracking-wide">
                                  {post.content_type}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 line-clamp-3 font-light leading-relaxed mb-4">
                            {post.content}
                          </p>
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={(e) => handleReject(post.id, e)}
                              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => handleEditClick(post, e)}
                              className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => handleApprove(post.id, e)}
                              className="p-2 bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground transition-colors shadow-[0_0_15px_rgba(136,217,231,0.2)]"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingPost && (
        <div className="fixed inset-0 bg-background/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-xl font-serif italic text-foreground mb-6">Edit Post Content</h2>
            
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px] bg-input border border-border text-foreground mb-6 resize-none focus:border-primary/50 font-light leading-relaxed"
            />

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPost(null);
                }}
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saveStatus[editingPost.id] === 'saving' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQueueView;
