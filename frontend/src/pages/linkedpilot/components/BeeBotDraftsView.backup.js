import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Send, Copy, Check, Download, ArrowLeft, Plus, MoreVertical, 
  FileText, Image as ImageIcon, Calendar, Trash2, Menu, X, Paperclip, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BeeBotDraftsView = ({ orgId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create.',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [generateWithImage, setGenerateWithImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageModel, setImageModel] = useState('dall-e-3');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    scheduled_for: '',
    scheduled_time: '10:00'
  });
  const [linkedinAuthors, setLinkedinAuthors] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (orgId) {
      fetchDrafts();
      fetchLinkedInAuthors();
    }
  }, [orgId]);

  const fetchLinkedInAuthors = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/managed-organizations?org_id=${orgId}`);
      setLinkedinAuthors(response.data);
      // Set default to personal profile
      setSelectedAuthor({
        id: response.data.personal.id,
        name: response.data.personal.name,
        type: 'personal'
      });
    } catch (error) {
      console.error('Error fetching LinkedIn authors:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDrafts = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/drafts?org_id=${orgId}`);
      setSavedDrafts(response.data);
    } catch (error) {
      console.error('Error fetching drafts:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setLoading(true);

    try {
      if (currentInput.toLowerCase().includes('carousel') || currentInput.toLowerCase().includes('slide deck') || currentInput.toLowerCase().includes('multiple images')) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '🎠 Generating carousel with 5 slides... This will take 2-3 minutes (generating content + 5 images).',
          timestamp: new Date(),
          isLoading: true
        }]);

        const carouselResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-carousel`, {
          org_id: orgId,
          topic: currentInput.replace(/carousel|slide deck|multiple images/gi, '').trim(),
          tone: 'professional',
          type: 'carousel',
          created_by: user.id
        });

        // Build caption with all slides
        const fullContent = `${carouselResponse.data.caption}\n\n📸 ${carouselResponse.data.slides.length} Slides:\n${carouselResponse.data.slides.map((s, i) => `\n${i+1}. ${s.title}\n   ${s.content}`).join('\n')}`;
        
        setMessages(prev => prev.slice(0, -1).concat({
          role: 'assistant',
          content: fullContent,
          timestamp: new Date(),
          isPost: true,
          isCarousel: true,
          postData: {
            content: carouselResponse.data.caption,
            hashtags: carouselResponse.data.hashtags,
            slides: carouselResponse.data.slides
          },
          carouselData: carouselResponse.data
        }));
      } else if (generateWithImage) {
        // Generate BOTH optimized text AND image together
        const waitTime = imageModel === 'ai_horde' ? '1-5 minutes' : '30-60 seconds';
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Generating optimized post with image using ${imageModel}... This may take ${waitTime}.`,
          timestamp: new Date(),
          isLoading: true
        }]);

        try {
          // Step 1: Generate optimized text content
          const textResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate`, {
            org_id: orgId,
            topic: currentInput,
            tone: 'professional',
            type: 'text',
            created_by: user.id
          });

          // Step 2: Generate image with selected model
          const imageResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
            prompt: currentInput,
            style: 'professional',
            user_id: user.id,
            model: imageModel
          });

          // Step 3: Combine text + image in one message
          setMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant',
            content: textResponse.data.content,
            timestamp: new Date(),
            image: imageResponse.data.url,
            imageData: imageResponse.data,
            hashtags: textResponse.data.hashtags,
            isPost: true,
            postData: {
              content: textResponse.data.content,
              hashtags: textResponse.data.hashtags,
              image: imageResponse.data.url
            }
          }));

          // Reset the toggle after successful generation
          setGenerateWithImage(false);
        } catch (error) {
          setMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant',
            content: `Failed to generate post with image: ${error.response?.data?.detail || error.message}. Try selecting a different model or add your API key in Settings.`,
            timestamp: new Date(),
            isError: true
          }));
          setGenerateWithImage(false);
        }
      } else {
        const response = await axios.post(`${BACKEND_URL}/api/drafts/generate`, {
          org_id: orgId,
          topic: currentInput,
          tone: 'professional',
          type: 'text',
          created_by: user.id
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.content,
          timestamp: new Date(),
          hashtags: response.data.hashtags,
          isPost: true,
          postData: response.data
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('org_id', orgId);
    
    try {
      setLoading(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/drafts/upload-image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      setUploadedImage(response.data.url);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Image uploaded successfully: ${response.data.filename}`,
        timestamp: new Date(),
        image: response.data.url
      }]);
    } catch (error) {
      console.error('Image upload failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Failed to upload image: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    alert('PDF carousel upload - coming soon!');
  };

  const handleCopy = async (content, index) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveDraft = async (postData, image = null) => {
    try {
      // Handle carousel (multiple slides with images)
      let assets = [];
      let mode = 'text';
      
      if (postData.slides && postData.slides.length > 0) {
        // Carousel mode
        mode = 'carousel';
        assets = postData.slides.map(slide => ({
          type: 'image',
          url: slide.image_url,
          title: slide.title,
          content: slide.content
        }));
      } else if (image) {
        // Single image mode
        mode = 'image';
        assets = [{ type: 'image', url: image }];
      }
      
      const draftData = {
        id: `draft_${Date.now()}`,
        org_id: orgId,
        author_id: user.id,
        mode: mode,
        content: {
          body: postData.content,
          hashtags: postData.hashtags || []
        },
        assets: assets,
        status: 'draft',
        linkedin_author_type: selectedAuthor?.type || 'personal',
        linkedin_author_id: selectedAuthor?.id
      };

      await axios.post(`${BACKEND_URL}/api/drafts`, draftData);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Draft saved successfully!',
        timestamp: new Date()
      }]);
      
      fetchDrafts();
    } catch (error) {
      console.error('Error saving draft:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to save draft.',
        timestamp: new Date(),
        isError: true
      }]);
    }
  };

  const handleScheduleClick = (postData, image = null) => {
    setSelectedPost({ postData, image });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    setScheduleData({
      scheduled_for: dateString,
      scheduled_time: '10:00'
    });
    setShowScheduleModal(true);
  };

  const handleConfirmSchedule = async () => {
    if (!selectedPost || !scheduleData.scheduled_for || !scheduleData.scheduled_time) {
      alert('Please select both date and time');
      return;
    }

    try {
      // Step 1: Save as draft first
      const draftData = {
        id: `draft_${Date.now()}`,
        org_id: orgId,
        author_id: user.id,
        mode: selectedPost.image ? 'image' : 'text',
        content: {
          body: selectedPost.postData.content,
          hashtags: selectedPost.postData.hashtags || []
        },
        assets: selectedPost.image ? [{ type: 'image', url: selectedPost.image }] : [],
        status: 'draft',
        linkedin_author_type: selectedAuthor?.type || 'personal',
        linkedin_author_id: selectedAuthor?.id
      };

      const draftResponse = await axios.post(`${BACKEND_URL}/api/drafts`, draftData);
      const draftId = draftResponse.data.id;

      // Step 2: Schedule the draft
      const scheduledDateTime = `${scheduleData.scheduled_for}T${scheduleData.scheduled_time}:00`;
      
      const schedulePostData = {
        id: `scheduled_${Date.now()}`,
        draft_id: draftId,
        org_id: orgId,
        publish_time: scheduledDateTime,
        timezone: 'UTC',
        status: 'scheduled'
      };

      await axios.post(`${BACKEND_URL}/api/scheduled-posts`, schedulePostData);
      
      setShowScheduleModal(false);
      setSelectedPost(null);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Post scheduled successfully! Check the Calendar view.',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error scheduling post:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to schedule post. Error: ' + (error.response?.data?.detail || error.message),
        timestamp: new Date()
      }]);
    }
  };

  const handlePostNowClick = (postData, image = null) => {
    // Show preview modal instead of posting immediately
    setPreviewData({
      postData,
      image,
      action: 'post_now'
    });
    setShowPreviewModal(true);
  };

  const handlePostNow = async (postData, image = null) => {
    console.log('🚀 POST NOW clicked!');
    console.log('Post data:', postData);
    console.log('Image:', image);
    console.log('Org ID:', orgId);
    console.log('User:', user);
    
    try {
      // Step 1: Save as draft first
      console.log('Step 1: Creating draft...');
      const draftData = {
        id: `draft_${Date.now()}`,
        org_id: orgId,
        author_id: user.id,
        mode: image ? 'image' : 'text',
        content: {
          body: postData.content,
          hashtags: postData.hashtags || []
        },
        assets: image ? [{ type: 'image', url: image }] : [],
        status: 'draft',
        linkedin_author_type: selectedAuthor?.type || 'personal',
        linkedin_author_id: selectedAuthor?.id
      };

      console.log('Draft data:', draftData);
      const draftResponse = await axios.post(`${BACKEND_URL}/api/drafts`, draftData);
      const draftId = draftResponse.data.id;
      console.log('✅ Draft created:', draftId);

      // Step 2: Create a scheduled post for immediate publishing
      console.log('Step 2: Creating scheduled post...');
      const schedulePostData = {
        id: `scheduled_${Date.now()}`,
        draft_id: draftId,
        org_id: orgId,
        publish_time: new Date().toISOString(),
        timezone: 'UTC',
        status: 'queued'
      };

      console.log('Schedule data:', schedulePostData);
      const scheduleResponse = await axios.post(`${BACKEND_URL}/api/scheduled-posts`, schedulePostData);
      const scheduledPostId = scheduleResponse.data.id;
      console.log('✅ Scheduled post created:', scheduledPostId);

      // Step 3: Publish immediately
      console.log('Step 3: Publishing to LinkedIn...');
      console.log('Calling:', `${BACKEND_URL}/api/scheduled-posts/${scheduledPostId}/publish-now`);
      const publishResponse = await axios.post(`${BACKEND_URL}/api/scheduled-posts/${scheduledPostId}/publish-now`);
      console.log('✅ Publish response:', publishResponse.data);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Post published to LinkedIn successfully!',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('❌ Error posting now:', error);
      console.error('Error details:', error.response?.data);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to post to LinkedIn. ' + (error.response?.data?.detail || 'Please make sure your LinkedIn account is connected in Settings.'),
        timestamp: new Date()
      }]);
    }
  };

  const handleLoadDraft = (draft) => {
    setSelectedDraft(draft);
    
    // Extract image from draft assets if it exists
    const draftImage = draft.assets && draft.assets.length > 0 && draft.assets[0].type === 'image' 
      ? draft.assets[0].url 
      : null;
    
    setMessages([
      {
        role: 'assistant',
        content: 'Hi! I\'m your AI content assistant.',
        timestamp: new Date()
      },
      {
        role: 'assistant',
        content: draft.content.body,
        timestamp: new Date(draft.created_at),
        hashtags: draft.content.hashtags,
        isPost: true,
        image: draftImage,  // ✅ Add image from assets
        postData: { 
          content: draft.content.body, 
          hashtags: draft.content.hashtags,
          image: draftImage  // ✅ Add image to postData
        }
      }
    ]);
  };

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Delete this draft?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/drafts/${draftId}`);
      fetchDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" 
               style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}>
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
            No Organization Selected
          </h3>
          <p className="mb-6" style={{ color: '#6B7280', fontSize: '14px' }}>
            Please select an organization to start creating posts.
          </p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            style={{ 
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '10px 20px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ backgroundColor: '#FFFFFF', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Drafts Sidebar */}
      <div 
        className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-200 border-r flex flex-col`}
        style={{ 
          borderColor: '#E5E7EB',
          backgroundColor: '#FAFAFA',
          overflow: 'hidden'
        }}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowLeft className="w-4 h-4" style={{ color: '#6B7280' }} />
            </Button>
            <h2 className="font-semibold" style={{ color: '#1A1A1A', fontSize: '16px' }}>Drafts</h2>
          </div>
          <Button
            onClick={() => {
              setSelectedDraft(null);
              setMessages([{
                role: 'assistant',
                content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create.',
                timestamp: new Date()
              }]);
            }}
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none'
            }}
          >
            <Plus className="w-4 h-4 text-white" />
          </Button>
        </div>

        {/* Drafts List */}
        <div className="flex-1 overflow-y-auto p-3">
          {savedDrafts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p style={{ color: '#9CA3AF', fontSize: '14px' }}>No drafts yet</p>
              <p style={{ color: '#D1D5DB', fontSize: '12px', marginTop: '4px' }}>Create your first draft</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedDrafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => handleLoadDraft(draft)}
                  className="p-3 rounded-lg cursor-pointer transition-all group"
                  style={{
                    backgroundColor: selectedDraft?.id === draft.id ? '#F3F4F6' : '#FFFFFF',
                    border: '1px solid',
                    borderColor: selectedDraft?.id === draft.id ? '#E5E7EB' : '#E5E7EB'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {draft.mode === 'image' ? (
                        <ImageIcon className="w-4 h-4" style={{ color: '#6366F1' }} />
                      ) : (
                        <FileText className="w-4 h-4" style={{ color: '#6B7280' }} />
                      )}
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {new Date(draft.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDraft(draft.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                    </button>
                  </div>
                  <p 
                    className="line-clamp-2"
                    style={{ 
                      fontSize: '14px',
                      color: '#1A1A1A',
                      lineHeight: '1.5'
                    }}
                  >
                    {draft.content.body}
                  </p>
                  {draft.content.hashtags && draft.content.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {draft.content.hashtags.slice(0, 2).map((tag, idx) => (
                        <span 
                          key={idx}
                          style={{
                            fontSize: '11px',
                            color: '#6366F1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {draft.content.hashtags.length > 2 && (
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          +{draft.content.hashtags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <Menu className="w-4 h-4" style={{ color: '#6B7280' }} />
              </Button>
            )}
            {sidebarOpen && (
              <Button
                onClick={() => setSidebarOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <X className="w-4 h-4" style={{ color: '#6B7280' }} />
              </Button>
            )}
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}>
              <span className="text-white font-semibold" style={{ fontSize: '14px' }}>AI</span>
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: '#1A1A1A', fontSize: '15px' }}>
                AI Content Assistant
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '12px' }}>Powered by GPT-4o</p>
            </div>
          </div>
        </div>

        {/* LinkedIn Author Selector */}
        {linkedinAuthors && (
          <div className="px-6 py-3 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center gap-3">
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#6B7280' }}>
                Post as:
              </label>
              <select
                value={selectedAuthor ? `${selectedAuthor.type}:${selectedAuthor.id}` : ''}
                onChange={(e) => {
                  const [type, id] = e.target.value.split(':');
                  if (type === 'personal') {
                    setSelectedAuthor({
                      id: linkedinAuthors.personal.id,
                      name: linkedinAuthors.personal.name,
                      type: 'personal'
                    });
                  } else {
                    const org = linkedinAuthors.organizations.find(o => o.id === id);
                    if (org) {
                      setSelectedAuthor({
                        id: org.id,
                        name: org.name,
                        type: 'organization'
                      });
                    }
                  }
                }}
                style={{
                  fontSize: '13px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#1F2937',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                <option value={`personal:${linkedinAuthors.personal.id}`}>
                  👤 {linkedinAuthors.personal.name} (Personal)
                </option>
                {linkedinAuthors.organizations?.length > 0 && (
                  <optgroup label="Companies">
                    {linkedinAuthors.organizations.map(org => (
                      <option key={org.id} value={`organization:${org.id}`}>
                        🏢 {org.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {selectedAuthor?.type === 'organization' ? 'Posting to company page' : 'Posting to personal profile'}
              </span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <div key={index}>
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div 
                      className="max-w-[80%] rounded-2xl px-4 py-3"
                      style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}
                    >
                      <p style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[90%]">
                      <div 
                        className="rounded-2xl px-4 py-3"
                        style={{
                          backgroundColor: message.isError ? '#FEF2F2' : '#F8F9FA',
                          border: '1px solid',
                          borderColor: message.isError ? '#FECACA' : '#E5E7EB'
                        }}
                      >
                        {message.isLoading ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                              style={{ borderColor: '#6366F1' }}
                            ></div>
                            <p style={{ fontSize: '14px', color: '#6B7280' }}>{message.content}</p>
                          </div>
                        ) : (
                          <>
                            <MessageContent content={message.content} isPost={message.isPost} />
                            
                            {message.image && (
                              <div className="mt-3">
                                <img 
                                  src={message.image} 
                                  alt="Generated" 
                                  className="w-full rounded-lg"
                                  style={{ border: '1px solid #E5E7EB' }}
                                />
                              </div>
                            )}
                            
                            {message.hashtags && message.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                                {message.hashtags.map((tag, idx) => (
                                  <span key={idx} style={{ fontSize: '14px', color: '#6366F1' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {(message.isPost || message.image) && (
                              <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                                <Button
                                  onClick={() => handleCopy(message.content, index)}
                                  style={{
                                    flex: 1,
                                    backgroundColor: '#F3F4F6',
                                    color: '#1A1A1A',
                                    fontSize: '14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    fontWeight: 500
                                  }}
                                >
                                  {copiedIndex === index ? (
                                    <>
                                      <Check className="w-3 h-3 mr-1" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handleSaveDraft(message.postData || { content: message.content }, message.image)}
                                  style={{
                                    flex: 1,
                                    backgroundColor: '#6366F1',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    fontWeight: 500
                                  }}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Save Draft
                                </Button>
                                <Button
                                  onClick={() => handleScheduleClick(message.postData || { content: message.content }, message.image)}
                                  style={{
                                    flex: 1,
                                    backgroundColor: '#10B981',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    fontWeight: 500
                                  }}
                                >
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Schedule
                                </Button>
                                <Button
                                  onClick={() => handlePostNowClick(message.postData || { content: message.content }, message.image)}
                                  style={{
                                    flex: 1,
                                    backgroundColor: '#0A66C2',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    fontWeight: 500
                                  }}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Post Now
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', paddingLeft: '8px' }}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && !messages[messages.length - 1]?.isLoading && (
              <div className="flex justify-start">
                <div 
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                      style={{ borderColor: '#6366F1' }}
                    ></div>
                    <p style={{ fontSize: '14px', color: '#6B7280' }}>Thinking...</p>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input with Model Selection & Upload Icons */}
        <div className="border-t p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
          <div className="max-w-4xl mx-auto">
            {/* Model Selection Dropdown */}
            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">Image Model:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 cursor-pointer focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                <option value="dall-e-3">DALL-E 3 (Best Quality)</option>
                <option value="dall-e-2">DALL-E 2 (Faster)</option>
                <option value="ai_horde">AI Horde (Free, Slow)</option>
                <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash (Paid)</option>
              </select>
              {imageModel === 'ai_horde' && (
                <span className="text-xs text-gray-500">⚠️ May take 30s-5min</span>
              )}
              {imageModel === 'dall-e-3' && (
                <span className="text-xs text-green-600">✓ Best, no text</span>
              )}
              {imageModel === 'dall-e-2' && (
                <span className="text-xs text-blue-600">✓ Fast</span>
              )}
            </div>
            
            <div 
              className="flex gap-2 p-3 rounded-2xl transition-all"
              style={{ 
                backgroundColor: '#F8F9FA',
                border: '1px solid #E5E7EB'
              }}
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message AI assistant..."
                disabled={loading}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#1A1A1A',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              
              {/* Upload & Generation Icons */}
              <div className="flex items-center gap-2 relative">
                {/* Paperclip - Upload Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUploadMenu(!showUploadMenu)}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    title="Upload files"
                  >
                    <Paperclip className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  {/* Upload Dropdown Menu */}
                  {showUploadMenu && (
                    <div 
                      className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border"
                      style={{ 
                        borderColor: '#E5E7EB',
                        minWidth: '160px',
                        zIndex: 50
                      }}
                      onMouseLeave={() => setShowUploadMenu(false)}
                    >
                      <button
                        onClick={() => {
                          document.getElementById('image-upload').click();
                          setShowUploadMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                        style={{ color: '#1A1A1A' }}
                      >
                        <ImageIcon className="w-4 h-4" />
                        Upload Image
                      </button>
                      <button
                        onClick={() => {
                          document.getElementById('pdf-upload').click();
                          setShowUploadMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm border-t"
                        style={{ color: '#1A1A1A', borderColor: '#E5E7EB' }}
                      >
                        <FileText className="w-4 h-4" />
                        Upload PDF
                      </button>
                    </div>
                  )}
                  
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handlePdfUpload}
                  />
                </div>
                
                {/* Generate Text + Image */}
                <button
                  onClick={() => setGenerateWithImage(!generateWithImage)}
                  disabled={loading}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                    generateWithImage 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'hover:bg-gray-200 text-gray-600'
                  }`}
                  title={`Generate post ${generateWithImage ? 'WITH text + image' : 'text only'}`}
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
              </div>
              
              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={loading || !inputMessage.trim()}
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  minWidth: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedPost && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '450px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar style={{ width: '20px', height: '20px', color: '#10B981' }} />
              Schedule Post
            </h2>
            
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Post Preview:</p>
              {selectedPost.image && (
                <img 
                  src={selectedPost.image} 
                  alt="Preview" 
                  style={{ width: '100%', height: '96px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }}
                />
              )}
              <p style={{ 
                fontSize: '14px', 
                color: '#6B7280', 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical'
              }}>
                {selectedPost.postData.content}
              </p>
            </div>

            <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                  Select Date
                </label>
                <input
                  type="date"
                  value={scheduleData.scheduled_for}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_for: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    padding: '0 12px',
                    fontSize: '14px',
                    color: '#1A1A1A',
                    backgroundColor: '#FFFFFF'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                  Select Time
                </label>
                <input
                  type="time"
                  value={scheduleData.scheduled_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    padding: '0 12px',
                    fontSize: '14px',
                    color: '#1A1A1A',
                    backgroundColor: '#FFFFFF'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPost(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#E5E7EB',
                  color: '#1F2937',
                  height: '40px',
                  borderRadius: '8px',
                  fontWeight: 500
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSchedule}
                style={{
                  flex: 1,
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  height: '40px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Calendar style={{ width: '16px', height: '16px' }} />
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview/Edit Modal */}
      {showPreviewModal && previewData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937' }}>
                Preview & Edit Post
              </h2>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X style={{ width: '24px', height: '24px', color: '#6B7280' }} />
              </button>
            </div>

            {selectedAuthor && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>Posting as:</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
                  {selectedAuthor.type === 'organization' ? '🏢' : '👤'} {selectedAuthor.name}
                </span>
              </div>
            )}

            {previewData.image && (
              <div style={{ marginBottom: '20px' }}>
                <img 
                  src={previewData.image} 
                  alt="Post image" 
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    maxHeight: '300px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px', display: 'block' }}>
                Post Content:
              </label>
              <textarea
                value={previewData.postData.content}
                onChange={(e) => setPreviewData({
                  ...previewData,
                  postData: {
                    ...previewData.postData,
                    content: e.target.value
                  }
                })}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '12px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  color: '#1F2937'
                }}
              />
            </div>

            {previewData.postData.hashtags && previewData.postData.hashtags.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px', display: 'block' }}>
                  Hashtags:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {previewData.postData.hashtags.map((tag, idx) => (
                    <span key={idx} style={{
                      fontSize: '13px',
                      padding: '4px 12px',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      borderRadius: '12px',
                      fontWeight: '500'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#E5E7EB',
                  color: '#1F2937',
                  height: '40px',
                  borderRadius: '8px',
                  fontWeight: 500
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowPreviewModal(false);
                  if (previewData.action === 'post_now') {
                    handlePostNow(previewData.postData, previewData.image);
                  }
                  setPreviewData(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#0A66C2',
                  color: '#FFFFFF',
                  height: '40px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Send style={{ width: '16px', height: '16px' }} />
                Post to LinkedIn
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MessageContent = ({ content, isPost }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = content.length > 500;
  const displayContent = shouldTruncate && !isExpanded 
    ? content.slice(0, 500) + '...' 
    : content;

  return (
    <div>
      <p style={{ fontSize: '14px', color: '#1A1A1A', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
        {displayContent}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            fontSize: '14px',
            color: '#1A1A1A',
            fontWeight: 600,
            marginTop: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isExpanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default BeeBotDraftsView;
