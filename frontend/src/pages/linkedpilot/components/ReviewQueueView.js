import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, Edit2, Trash2, Loader2, Calendar, Clock, Target, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ReviewQueueView = ({ orgId }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null); // Changed to store full post object
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
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#F5F6FA' }}>
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>No Organization Selected</h3>
          <p className="mb-6" style={{ color: '#6B7280', fontSize: '14px' }}>Please select an organization to manage your review queue.</p>
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
    <div className="h-full flex flex-col" style={{ backgroundColor: '#F5F6FA' }}>
      {/* Header - Responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Review Queue</h1>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Review and approve AI-generated content before posting.</p>
          </div>
        </div>
      </div>

      {/* Timeline Content - Responsive Padding */}
      <div className="flex-1 overflow-auto py-8 md:py-16 px-4 md:px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' }}>
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Posts Pending Review</h3>
            <p className="text-gray-600 text-sm mb-6" style={{ maxWidth: '500px', margin: '0 auto 24px' }}>
              All AI-generated content has been reviewed or there are no active campaigns generating content.
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard/campaigns'}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Go to Campaigns
            </Button>
          </div>
        ) : (
          <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
            {/* Timeline Line */}
            <div style={{
              position: 'absolute',
              width: '2px',
              backgroundColor: '#E5E7EB',
              top: 0,
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 0
            }} />

            {/* Timeline Items */}
            {posts.map((post, index) => {
              const isLeft = index % 2 === 0;
              const date = formatDate(post.created_at);
              const isExpanded = expandedPostId === post.id;
              const isEditing = editingPost?.id === post.id;

              return (
                <div
                  key={post.id}
                  className="mb-6 md:mb-20"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '12px',
                    alignItems: 'start',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {/* Date - Simplified on mobile */}
                  <div className="flex flex-col items-center md:items-start" style={{
                    padding: '8px',
                    minWidth: '60px'
                  }}>
                    <span className="text-xs md:text-sm font-semibold text-gray-900 block mb-1">
                      {date.month}
                    </span>
                    <span className="text-xl md:text-3xl font-bold text-gray-900 block leading-tight">
                      {date.day}
                    </span>
                    <span className="text-xs text-gray-500 block mt-1">
                      {date.year}
                    </span>
                  </div>

                  {/* Card */}
                  <div 
                    onClick={() => handleCardClick(post.id)}
                    className="flex-1 p-4 md:p-5 rounded-lg md:rounded-xl"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.backgroundColor = '#FAFBFC';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 style={{ 
                          fontSize: '16px', 
                          fontWeight: 700, 
                          color: '#1A1A1A',
                          marginBottom: '8px',
                          lineHeight: 1.2
                        }}>
                          {post.campaign_name || 'Campaign Post'}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {post.content_pillar && (
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              backgroundColor: '#F3F4F6',
                              color: '#111827',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: '6px'
                            }}>
                              {post.content_pillar}
                            </span>
                          )}
                          {post.content_type && (
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              backgroundColor: '#F3F4F6',
                              color: '#6B7280',
                              fontSize: '12px',
                              fontWeight: 500,
                              borderRadius: '6px'
                            }}>
                              {post.content_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCardClick(post.id); }}
                        style={{ color: '#6B7280' }}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Preview (collapsed) */}
                    {!isExpanded && (
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#6B7280',
                        lineHeight: 1.6,
                        marginTop: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {post.content}
                      </p>
                    )}

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ marginTop: '16px' }}>
                        <p style={{ 
                          fontSize: '14px', 
                          color: '#1A1A1A',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          marginBottom: '16px'
                        }}>
                          {post.content}
                        </p>

                        {/* Action Buttons - Responsive */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
                          <Button
                            onClick={(e) => handleApprove(post.id, e)}
                            style={{ backgroundColor: '#10B981' }}
                            className="flex-1 hover:opacity-90 text-white text-sm md:text-sm flex items-center justify-center gap-2 h-11 md:h-10"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={(e) => handleEditClick(post, e)}
                            variant="outline"
                            className="flex-1 text-sm md:text-sm flex items-center justify-center gap-2 h-11 md:h-10"
                            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button
                            onClick={(e) => handleReject(post.id, e)}
                            variant="outline"
                            className="text-sm flex items-center justify-center gap-2 h-11 md:h-10"
                            style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                          <Button
                            onClick={(e) => handleDelete(post.id, e)}
                            variant="outline"
                            className="text-sm flex items-center justify-center gap-2 h-11 md:h-10 px-3"
                            style={{ borderColor: '#E5E7EB', color: '#EF4444' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal - Responsive */}
      {showEditModal && editingPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-none md:rounded-xl shadow-2xl w-full md:max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Edit Post</h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">{editingPost.campaign_name || 'Campaign Post'}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Post Content</label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-64 md:h-96 p-3 md:p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                  placeholder="Enter your post content..."
                  style={{ 
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: '#1A1A1A'
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Character count: {editedContent.length}
                </p>
              </div>

              {/* Post Metadata - Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {editingPost.content_pillar && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Content Pillar</div>
                    <div className="font-semibold text-gray-900">{editingPost.content_pillar}</div>
                  </div>
                )}
                {editingPost.content_type && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Content Type</div>
                    <div className="font-semibold text-gray-900 capitalize">{editingPost.content_type}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer - Responsive */}
            <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 bg-gray-50">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-3 md:py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saveStatus[editingPost.id] === 'saving'}
                className="px-6 py-3 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saveStatus[editingPost.id] === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQueueView;


