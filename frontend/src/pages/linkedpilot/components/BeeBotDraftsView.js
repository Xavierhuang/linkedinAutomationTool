import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Send, Copy, Check, Download, ArrowLeft, Plus, MoreVertical, 
  FileText, Image as ImageIcon, Calendar, Trash2, Menu, X, Paperclip, ChevronUp, History, Edit, Linkedin, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import TextOverlayModal from './TextOverlayModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BeeBotDraftsView = ({ orgId }) => {
  const navigate = useNavigate();
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start with drafts closed
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [generateWithImage, setGenerateWithImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageModel, setImageModel] = useState('gemini-stock');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    scheduled_for: '',
    scheduled_time: '10:00'
  });
  const [linkedinAuthors, setLinkedinAuthors] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinConnecting, setLinkedinConnecting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels (about 8-9 lines)
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [inputMessage]);
  // Text overlay editing
  const [showTextOverlayModal, setShowTextOverlayModal] = useState(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState(null);
  const [selectedMessageForTextOverlay, setSelectedMessageForTextOverlay] = useState(null);
  const [imageOverlays, setImageOverlays] = useState({}); // Store overlay elements by image URL
  
  // Load overlay data from messages when component mounts or messages change
  useEffect(() => {
    const overlaysFromMessages = {};
    messages.forEach(msg => {
      if (msg.image && msg.textOverlays) {
        overlaysFromMessages[msg.image] = msg.textOverlays;
      }
    });
    if (Object.keys(overlaysFromMessages).length > 0) {
      setImageOverlays(prev => ({ ...prev, ...overlaysFromMessages }));
    }
  }, [messages.length]); // Only run when messages array length changes
  
  // Prompt editing UI
  const [showPromptEditPanel, setShowPromptEditPanel] = useState(false);
  const [promptEditState, setPromptEditState] = useState({
    textPrompt: '',
    imagePrompt: ''
  });
  const [selectedMessageForEdit, setSelectedMessageForEdit] = useState(null);

  useEffect(() => {
    if (orgId && user) {
      fetchDrafts();
      checkLinkedInConnection();
      fetchLinkedInAuthors();
    }
  }, [orgId, user]);

  const checkLinkedInConnection = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
      setLinkedinConnected(response.data.linkedin_connected);
    } catch (error) {
      console.error('Error checking LinkedIn connection:', error);
      setLinkedinConnected(false);
    }
  };

  const handleConnectLinkedIn = async () => {
    setLinkedinConnecting(true);
    try {
      // Connect at user level (no org_id needed)
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/auth/start?user_id=${user.id}`);
      const authUrl = response.data.auth_url;
      
      // Check if it's a full URL (real LinkedIn) or relative path (mock)
      if (authUrl.startsWith('http')) {
        // Real LinkedIn OAuth - Open in popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          authUrl,
          'LinkedIn Authorization',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for callback message
        const messageListener = (event) => {
          console.log('[LinkedIn OAuth] Message received:', event.data);
          if (event.data.type === 'linkedin-oauth-success') {
            console.log('[LinkedIn OAuth] Success message received');
            popup?.close();
            window.removeEventListener('message', messageListener);
            // Check connection status and update UI
            setTimeout(async () => {
              await checkLinkedInConnection();
              if (orgId) {
                await fetchLinkedInAuthors();
              }
              setLinkedinConnecting(false);
              alert('✅ LinkedIn connected successfully!');
            }, 500);
          } else if (event.data.type === 'linkedin-oauth-error') {
            console.log('[LinkedIn OAuth] Error message received:', event.data.error);
            popup?.close();
            window.removeEventListener('message', messageListener);
            // Don't show error yet - check actual connection status first
            setTimeout(async () => {
              await checkLinkedInConnection();
              setLinkedinConnecting(false);
              // Only show error if still not connected
              const status = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
              if (!status.data.linkedin_connected) {
                alert('❌ LinkedIn connection failed. Please try again.');
              } else {
                if (orgId) {
                  await fetchLinkedInAuthors();
                }
                alert('✅ LinkedIn connected successfully!');
              }
            }, 1000);
          }
        };

        window.addEventListener('message', messageListener);

        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          alert('Popup blocked! Please allow popups for this site and try again.');
          setLinkedinConnecting(false);
          window.removeEventListener('message', messageListener);
          return;
        }

        // Monitor popup close and check connection status
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            console.log('[LinkedIn OAuth] Popup closed');
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
            // Check if LinkedIn was actually connected (popup may have closed before message was sent)
            setTimeout(async () => {
              console.log('[LinkedIn OAuth] Checking connection status after popup close...');
              await checkLinkedInConnection();
              if (orgId) {
                await fetchLinkedInAuthors();
              }
              setLinkedinConnecting(false);
              console.log('[LinkedIn OAuth] Connection check complete');
            }, 1500);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error starting LinkedIn auth:', error);
      alert('Failed to initiate LinkedIn connection. Please try again.');
      setLinkedinConnecting(false);
    }
  };

  const fetchLinkedInAuthors = async () => {
    if (!orgId || !user?.id) {
      console.warn('Cannot fetch LinkedIn authors: missing orgId or user.id');
      return;
    }
    try {
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/managed-organizations?org_id=${orgId}&user_id=${user.id}`);
      if (response.data && response.data.personal && response.data.personal.id) {
        setLinkedinAuthors(response.data);
        // Set default to personal profile
        setSelectedAuthor({
          id: response.data.personal.id,
          name: response.data.personal.name || 'Personal Profile',
          type: 'personal'
        });
        setLinkedinConnected(true); // If we got authors, LinkedIn is connected
      } else {
        console.warn('Invalid response structure from managed-organizations:', response.data);
        setLinkedinConnected(false);
      }
    } catch (error) {
      console.error('Error fetching LinkedIn authors:', error);
      setLinkedinConnected(false);
      // Don't set linkedinAuthors to null - keep previous state if it exists
      setLinkedinAuthors(prev => prev || null);
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
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
        // Generate BOTH optimized text AND image together with animated progress
        const waitTime = imageModel === 'ai_horde' ? '1-5 minutes' : '30-60 seconds';
        
        // Add loading message with cycling text animation
        const loadingSteps = [
          'Crafting your post content...',
          'Analyzing your topic...',
          'Finding perfect stock photo...',
          'Finalizing your content...'
        ];
        
        let currentStep = 0;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: loadingSteps[0],
          timestamp: new Date(),
          isLoading: true,
          isGeneratingImage: true,
          loadingStep: 0,
          loadingSteps: loadingSteps
        }]);
        
        // Cycle through loading messages
        const loadingInterval = setInterval(() => {
          currentStep = (currentStep + 1) % loadingSteps.length;
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].isLoading) {
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: loadingSteps[currentStep],
                loadingStep: currentStep
              };
            }
            return updated;
          });
        }, 2500); // Change text every 2.5 seconds

        try {
          // Step 1: Generate optimized text content
          const textResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate`, {
            org_id: orgId,
            topic: currentInput,
            tone: 'professional',
            type: 'text',
            created_by: user.id
          });

          // Step 2: Generate image with Gemini → Stock fallback system
          const imageResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
                prompt: textResponse.data.content,
                style: 'professional',
                user_id: user.id,
            org_id: orgId,
            model: imageModel
          });

          // WebSocket handles all progress updates automatically
          // Step 3: Combine text + image in one message
          setMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant',
            content: textResponse.data.content,
            timestamp: new Date(),
            image: imageResponse.data.url,
            imageData: imageResponse.data,
            hashtags: textResponse.data.hashtags,
            isPost: true,
            textPrompt: textResponse.data.generation_prompt,  // Store for editing
            imagePrompt: imageResponse.data.prompt,  // Store image prompt
            postData: {
              content: textResponse.data.content,
              hashtags: textResponse.data.hashtags,
              image: imageResponse.data.url
            }
          }));

          // Reset the toggle after successful generation
          setGenerateWithImage(false);
          clearInterval(loadingInterval); // Stop the loading animation
        } catch (error) {
          clearInterval(loadingInterval); // Stop the loading animation on error
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
          postData: response.data,
          textPrompt: response.data.generation_prompt  // Store for editing
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

  const handleSaveDraft = async (postData, image = null, textOverlays = []) => {
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
        assets = [{ 
          type: 'image', 
          url: image,
          textOverlays: textOverlays // Store overlay data with asset
        }];
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

  const handleScheduleClick = (postData, image = null, textOverlays = []) => {
    setSelectedPost({ postData, image, textOverlays });
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
        assets: selectedPost.image ? [{ 
          type: 'image', 
          url: selectedPost.image,
          textOverlays: selectedPost.textOverlays || []
        }] : [],
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

  const handlePostNowClick = (postData, image = null, textOverlays = []) => {
    // Show preview modal instead of posting immediately
    setPreviewData({
      postData,
      image,
      textOverlays,
      action: 'post_now'
    });
    setShowPreviewModal(true);
  };

  const handlePostNow = async (postData, image = null, textOverlays = []) => {
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
        assets: image ? [{ 
          type: 'image', 
          url: image,
          textOverlays: textOverlays
        }] : [],
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
    
    // Extract image and text overlays from draft assets if they exist
    const draftImage = draft.assets && draft.assets.length > 0 && draft.assets[0].type === 'image' 
      ? draft.assets[0].url 
      : null;
    const draftTextOverlays = draft.assets && draft.assets.length > 0 && draft.assets[0].type === 'image' 
      ? draft.assets[0].textOverlays || []
      : [];
    
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
        image: draftImage,
        textOverlays: draftTextOverlays, // Load saved overlays
        postData: { 
          content: draft.content.body, 
          hashtags: draft.content.hashtags,
          image: draftImage
        }
      }
    ]);
    
    // Also load overlays into imageOverlays state
    if (draftImage && draftTextOverlays.length > 0) {
      setImageOverlays(prev => ({
        ...prev,
        [draftImage]: draftTextOverlays
      }));
    }
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
    <div className="h-full flex flex-col md:flex-row relative" style={{ backgroundColor: '#FFFFFF', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Overlay - show when drafts sidebar is open on mobile or desktop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Drafts Sidebar - Bottom sheet on mobile, off-canvas left sidebar on desktop */}
      <div 
        className={`
          ${sidebarOpen ? 'translate-y-0 md:translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:-translate-x-full'}
          transition-all duration-300 ease-in-out
          fixed
          bottom-0 md:bottom-0 md:top-0 left-0 md:left-0 right-0 md:right-auto
          z-50
          border-t md:border-t-0 md:border-r
          flex flex-col
          rounded-t-3xl md:rounded-none
          h-[80vh] md:h-full
          w-full md:w-96
        `}
        style={{ 
          borderColor: '#E5E7EB',
          backgroundColor: '#FAFAFA',
          overflow: 'hidden',
          boxShadow: sidebarOpen ? '0 -4px 20px rgba(0, 0, 0, 0.1)' : 'none'
        }}
      >
        {/* Mobile Bottom Sheet Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div 
            className="w-12 h-1 rounded-full bg-gray-300 cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        {/* Sidebar Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" style={{ color: '#6366F1' }} />
            <h2 className="font-semibold" style={{ color: '#1A1A1A', fontSize: '16px' }}>Saved Drafts</h2>
            {savedDrafts.length > 0 && (
              <span 
                className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                  backgroundColor: '#EEF2FF',
                  color: '#6366F1'
                }}
              >
                {savedDrafts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSelectedDraft(null);
              setMessages([{
                role: 'assistant',
                content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create.',
                timestamp: new Date()
              }]);
                setSidebarOpen(false);
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
              title="New Draft"
          >
            <Plus className="w-4 h-4 text-white" />
          </Button>
            <Button
              onClick={() => setSidebarOpen(false)}
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
              title="Close"
            >
              <X className="w-4 h-4" style={{ color: '#6B7280' }} />
            </Button>
          </div>
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
      <div className="flex-1 flex flex-col relative overflow-hidden" style={{ minHeight: 0, position: 'relative' }}>
        {/* Mobile Header with Drafts Button */}
        <div className="md:hidden flex items-center justify-between p-3 border-b bg-white z-30" style={{ borderColor: '#E5E7EB' }}>
          <h1 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>
            BeeBot Assistant
          </h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
              backgroundColor: sidebarOpen ? '#6366F1' : '#FFFFFF',
              border: '1px solid',
              borderColor: sidebarOpen ? '#6366F1' : '#E5E7EB',
              color: sidebarOpen ? '#FFFFFF' : '#6B7280'
            }}
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">Drafts</span>
            {savedDrafts.length > 0 && (
              <span 
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: sidebarOpen ? '#FFFFFF' : '#6366F1',
                  color: sidebarOpen ? '#6366F1' : '#FFFFFF'
                }}
              >
                {savedDrafts.length}
              </span>
            )}
          </button>
        </div>
        {/* Header - Hidden on mobile (we have mobile header above) */}
        <div className="hidden md:flex border-b px-4 lg:px-6 py-4 items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
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
          
          {/* View Drafts Button */}
          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:shadow-md"
            style={{
              backgroundColor: sidebarOpen ? '#6366F1' : '#FFFFFF',
              border: '1px solid',
              borderColor: sidebarOpen ? '#6366F1' : '#E5E7EB',
              color: sidebarOpen ? '#FFFFFF' : '#1A1A1A'
            }}
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">View Drafts</span>
            {savedDrafts.length > 0 && (
              <span 
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: sidebarOpen ? '#FFFFFF' : '#6366F1',
                  color: sidebarOpen ? '#6366F1' : '#FFFFFF'
                }}
              >
                {savedDrafts.length}
              </span>
            )}
          </Button>
        </div>

        {/* LinkedIn Connection Alert */}
        {orgId && !linkedinConnected && (
          <div className="mx-4 md:mx-6 mt-4 mb-2 p-4 rounded-lg border-2" style={{ 
            backgroundColor: '#FEF3C7', 
            borderColor: '#FCD34D' 
          }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#D97706' }} />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1" style={{ color: '#92400E' }}>
                  LinkedIn Not Connected
                </h3>
                <p className="text-xs mb-3" style={{ color: '#78350F' }}>
                  Connect your LinkedIn account to publish posts directly from here. You can still create content, but you won't be able to post it until you connect LinkedIn.
                </p>
                <Button
                  onClick={handleConnectLinkedIn}
                  disabled={linkedinConnecting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: linkedinConnecting ? '#9CA3AF' : '#2563EB',
                    color: '#FFFFFF'
                  }}
                  onMouseEnter={(e) => {
                    if (!linkedinConnecting) {
                      e.currentTarget.style.backgroundColor = '#1D4ED8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!linkedinConnecting) {
                      e.currentTarget.style.backgroundColor = '#2563EB';
                    }
                  }}
                >
                  <Linkedin className="w-4 h-4" />
                  {linkedinConnecting ? 'Connecting...' : 'Connect LinkedIn Account'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* LinkedIn Author Selector */}
        {linkedinAuthors && (() => {
          const isCompactState = messages.length === 1 && messages[0].role === 'assistant' && !loading && !messages[0].isPost && !messages[0].image && !messages[0].isLoading;
          if (isCompactState) return null;
          return (
            <div className="px-6 py-3 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center gap-3">
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#6B7280' }}>
                Post as:
              </label>
              <select
                value={selectedAuthor ? `${selectedAuthor.type}:${selectedAuthor.id}` : ''}
                onChange={(e) => {
                  if (!linkedinAuthors) return;
                  const [type, id] = e.target.value.split(':');
                  if (type === 'personal' && linkedinAuthors.personal) {
                    setSelectedAuthor({
                      id: linkedinAuthors.personal.id,
                      name: linkedinAuthors.personal.name || 'Personal Profile',
                      type: 'personal'
                    });
                  } else if (linkedinAuthors.organizations) {
                    const org = linkedinAuthors.organizations.find(o => o.id === id);
                    if (org) {
                      setSelectedAuthor({
                        id: org.id,
                        name: org.name || org.localizedName || 'Organization',
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
                disabled={!linkedinAuthors}
              >
                {linkedinAuthors && linkedinAuthors.personal && (
                  <option value={`personal:${linkedinAuthors.personal.id}`}>
                    👤 {linkedinAuthors.personal.name || 'Personal Profile'} (Personal)
                  </option>
                )}
                {linkedinAuthors && linkedinAuthors.organizations?.length > 0 && (
                  <optgroup label="Companies">
                    {linkedinAuthors.organizations.map(org => (
                      <option key={org.id} value={`organization:${org.id}`}>
                        🏢 {org.name || org.localizedName || 'Organization'}
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
          );
        })()}

        {/* Messages - Responsive Padding */}
        <div className={`flex-1 overflow-y-auto ${messages.length === 1 && messages[0].role === 'assistant' && !loading && !messages[0].isPost && !messages[0].image && !messages[0].isLoading ? '' : 'p-3 md:p-6'}`} style={{ backgroundColor: '#FFFFFF', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Show compact welcome state when only initial message exists */}
          {messages.length === 1 && messages[0].role === 'assistant' && !loading && !messages[0].isPost && !messages[0].image && !messages[0].isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full" style={{ paddingBottom: '200px' }}>
              <p className="text-gray-600 text-center mb-6" style={{ fontSize: '16px', fontWeight: 400 }}>
                Ready when you are.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 w-full">
              {messages.map((message, index) => (
              <div key={index}>
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div 
                      className="max-w-[90%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2.5 md:py-3"
                      style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}
                    >
                      <p style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start" style={{ position: 'relative' }}>
                    <div className="max-w-[95%] md:max-w-[90%]">
                      <div 
                        className="rounded-2xl px-3 md:px-4 py-2.5 md:py-3"
                        style={{
                          backgroundColor: message.isError ? '#FEF2F2' : '#F8F9FA',
                          border: '1px solid',
                          borderColor: message.isError ? '#FECACA' : '#E5E7EB'
                        }}
                      >
                        {message.isLoading && message.isGeneratingImage ? (
                          <div className="space-y-4" style={{ minWidth: '320px' }}>
                            {/* Animated loading text */}
                            <div 
                              key={message.loadingStep || 0}
                              className="text-center"
                              style={{
                                animation: 'fadeInOut 2.5s ease-in-out',
                                fontSize: '15px',
                                fontWeight: '600',
                                color: '#6366F1',
                                letterSpacing: '0.3px'
                              }}
                            >
                              {message.content}
                            </div>
                            
                            {/* Modern animated progress bar */}
                            <div className="w-full h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: '#E5E7EB' }}>
                              <div 
                                className="h-full rounded-full absolute inset-0"
                                style={{ 
                                  background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #6366F1 100%)',
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s linear infinite'
                                }}
                              ></div>
                            </div>
                            <style>{`
                              @keyframes shimmer {
                                0% { background-position: 200% 0; }
                                100% { background-position: -200% 0; }
                              }
                              @keyframes fadeInOut {
                                0% { opacity: 0; transform: translateY(5px); }
                                20% { opacity: 1; transform: translateY(0); }
                                80% { opacity: 1; transform: translateY(0); }
                                100% { opacity: 0; transform: translateY(-5px); }
                              }
                            `}</style>
                          </div>
                        ) : message.isLoading ? (
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
                                  onClick={() => {
                                    setSelectedImageForEdit(message.image);
                                    setSelectedMessageForTextOverlay(message);
                                    setShowTextOverlayModal(true);
                                  }}
                                  data-has-overlays={message.textOverlays?.length > 0 || imageOverlays[message.image]?.length > 0 ? 'true' : 'false'}
                                  className="w-full rounded-lg cursor-pointer"
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
                              <>
                                {/* Floating Edit Icon */}
                                <button
                                  onClick={() => {
                                    setSelectedMessageForEdit(message);
                                    setPromptEditState({
                                      textPrompt: message.textPrompt || '',
                                      imagePrompt: message.imagePrompt || ''
                                    });
                                    setShowPromptEditPanel(true);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: '#6366F1',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#4F46E5';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#6366F1';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                  title="Edit Prompts"
                                >
                                  <Edit style={{ width: '16px', height: '16px', color: '#FFFFFF' }} />
                                </button>
                                
                              <div 
                                className="flex flex-wrap gap-2 mt-4 pt-3" 
                                style={{ borderTop: '1px solid #F3F4F6' }}
                              >
                                <Button
                                  onClick={() => handleCopy(message.content, index)}
                                  style={{
                                    flex: '1 1 calc(50% - 4px)',
                                    minWidth: '120px',
                                    backgroundColor: '#F3F4F6',
                                    color: '#1A1A1A',
                                    fontSize: '13px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 8px'
                                  }}
                                >
                                  {copiedIndex === index ? (
                                    <>
                                      <Check className="w-3 h-3 mr-1" />
                                      <span className="hidden sm:inline">Copied</span>
                                      <span className="sm:hidden">✓</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 mr-1" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handleSaveDraft(
                                    message.postData || { content: message.content }, 
                                    message.image,
                                    message.textOverlays || imageOverlays[message.image] || []
                                  )}
                                  style={{
                                    flex: '1 1 calc(50% - 4px)',
                                    minWidth: '120px',
                                    backgroundColor: '#6366F1',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 8px'
                                  }}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Save Draft</span>
                                  <span className="sm:hidden">Save</span>
                                </Button>
                                <Button
                                  onClick={() => handleScheduleClick(
                                    message.postData || { content: message.content }, 
                                    message.image,
                                    message.textOverlays || imageOverlays[message.image] || []
                                  )}
                                  style={{
                                    flex: '1 1 calc(50% - 4px)',
                                    minWidth: '120px',
                                    backgroundColor: '#10B981',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 8px'
                                  }}
                                >
                                  <Calendar className="w-3 h-3 mr-1" />
                                  <span>Schedule</span>
                                </Button>
                                <Button
                                  onClick={() => handlePostNowClick(
                                    message.postData || { content: message.content }, 
                                    message.image,
                                    message.textOverlays || imageOverlays[message.image] || []
                                  )}
                                  style={{
                                    flex: '1 1 calc(50% - 4px)',
                                    minWidth: '120px',
                                    backgroundColor: '#0A66C2',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 8px'
                                  }}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Post Now</span>
                                  <span className="sm:hidden">Post</span>
                                </Button>
                              </div>
                              </>
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
          )}
        </div>

        {/* Input with Model Selection & Upload Icons - Responsive */}
        {(() => {
          const isCompactState = messages.length === 1 && messages[0].role === 'assistant' && !loading && !messages[0].isPost && !messages[0].image && !messages[0].isLoading;
          return (
            <div className={`${isCompactState ? 'absolute bottom-1/2 left-0 right-0 translate-y-1/2' : 'border-t'} p-3 md:p-4`} style={{ borderColor: '#E5E7EB', backgroundColor: isCompactState ? 'transparent' : '#FFFFFF', marginTop: isCompactState ? '60px' : '0' }}>
              <div className={`${isCompactState ? 'max-w-2xl' : 'max-w-4xl'} mx-auto`}>
                {/* Model Selection Dropdown - Hide in compact state */}
                {!isCompactState && (
                  <div className="mb-2 md:mb-3 flex items-center gap-2 flex-wrap">
              <label className="text-xs font-semibold text-gray-600">Image Model:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 cursor-pointer focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                <option value="gemini-stock">Gemini 2.5 Flash → Stock (Default)</option>
                <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash Only</option>
                <option value="stock">Stock Photo Only (Free & Fast)</option>
                <option value="dall-e-3">DALL-E 3 (AI Generated - HD)</option>
                <option value="dall-e-2">DALL-E 2 (AI Generated - Faster)</option>
                <option value="gpt-image-1" disabled>GPT Image 1 (Requires Org Verification)</option>
                <option value="ai_horde">AI Horde (Free, Slow)</option>
              </select>
              {imageModel === 'gemini-stock' && (
                <span className="text-xs text-indigo-600 font-medium">Gemini 2.5 Flash first, Stock as fallback</span>
              )}
              {imageModel === 'google/gemini-2.5-flash-image' && (
                <span className="text-xs text-indigo-600 font-medium">Gemini 2.5 Flash only</span>
              )}
              {imageModel === 'stock' && (
                <span className="text-xs text-blue-600">Free stock photos</span>
              )}
              {imageModel === 'dall-e-3' && (
                <span className="text-xs text-green-600">Most photorealistic, HD quality</span>
              )}
              {imageModel === 'dall-e-2' && (
                <span className="text-xs text-blue-600">Fast generation</span>
              )}
              {imageModel === 'ai_horde' && (
                <span className="text-xs text-gray-500">May take 30s-5min</span>
              )}
                </div>
              )}
            
            <div 
              className={`flex gap-2 ${isCompactState ? 'p-3 md:p-4' : 'p-2 md:p-3'} rounded-xl md:rounded-2xl transition-all`}
              style={{ 
                backgroundColor: isCompactState ? '#FFFFFF' : '#F8F9FA',
                border: '1px solid #E5E7EB',
                alignItems: 'flex-end',
                boxShadow: isCompactState ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading && inputMessage.trim()) {
                      handleSendMessage();
                    }
                  }
                }}
                placeholder={isCompactState ? "What do you want to post on LinkedIn?" : "Message AI assistant..."}
                disabled={loading}
                rows={1}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#1A1A1A',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  resize: 'none',
                  overflow: 'hidden',
                  minHeight: '24px',
                  maxHeight: '200px',
                  lineHeight: '1.5',
                  padding: '6px 0',
                  boxSizing: 'border-box'
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
          );
        })()}
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
                  {selectedAuthor && selectedAuthor.type === 'organization' ? '🏢' : '👤'} {selectedAuthor?.name || 'Personal Profile'}
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
                    handlePostNow(previewData.postData, previewData.image, previewData.textOverlays || []);
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
      
      {/* Text Overlay Editing Modal */}
      <TextOverlayModal
        isOpen={showTextOverlayModal}
        onClose={() => setShowTextOverlayModal(false)}
        imageUrl={selectedImageForEdit}
        initialElements={selectedMessageForTextOverlay?.textOverlays || imageOverlays[selectedImageForEdit] || []}
        campaignData={selectedMessageForTextOverlay}
        onApply={(newImageUrl, elements) => {
          const oldImageUrl = selectedImageForEdit;
          setSelectedImageForEdit(newImageUrl);
          
          // Update messages to include overlay data and new image URL
          setMessages(prev => prev.map(msg => {
            if (msg.image === oldImageUrl) {
              return {
                ...msg, 
                image: newImageUrl,
                textOverlays: elements || [] // Store overlay data with message
              };
            }
            return msg;
          }));
          
          // Store overlay data for new image, remove old key
          setImageOverlays(prev => {
            const newOverlays = {...prev};
            delete newOverlays[oldImageUrl];
            newOverlays[newImageUrl] = elements || [];
            return newOverlays;
          });
          
          console.log('[TEXT_OVERLAY] Saved overlays:', elements);
          console.log('[TEXT_OVERLAY] Overlay count:', elements?.length || 0);
        }}
      />
      
      {/* Prompt Editing Side Panel */}
      {showPromptEditPanel && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '450px',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E5E7EB',
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F9FAFB'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0
            }}>
              Edit Prompts
            </h2>
            <button
              onClick={() => setShowPromptEditPanel(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X style={{ width: '18px', height: '18px', color: '#6B7280' }} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {/* Text Prompt */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px'
              }}>
                Text Generation Prompt
              </label>
              <textarea
                value={promptEditState.textPrompt}
                onChange={(e) => setPromptEditState({...promptEditState, textPrompt: e.target.value})}
                placeholder="Enter prompt for text generation..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'monospace',
                  lineHeight: '1.6'
                }}
              />
            </div>

            {/* Image Prompt */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: '8px'
              }}>
                Image Generation Prompt
              </label>
              <textarea
                value={promptEditState.imagePrompt}
                onChange={(e) => setPromptEditState({...promptEditState, imagePrompt: e.target.value})}
                placeholder="Enter prompt for image generation..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '14px',
                  color: '#1A1A1A',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'monospace',
                  lineHeight: '1.6'
                }}
              />
            </div>

            {/* Info */}
            <div style={{
              padding: '16px',
              backgroundColor: '#EEF2FF',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#4338CA',
                lineHeight: '1.6',
                margin: 0
              }}>
                💡 <strong>Tip:</strong> Edit the prompts to fine-tune AI content generation. Changes will be saved to prompt history.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={() => setShowPromptEditPanel(false)}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#6B7280',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                // TODO: Implement save and regenerate logic
                alert('Prompt editing saved! Regenerating content...');
                setShowPromptEditPanel(false);
              }}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: '#6366F1',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Save & Regenerate
            </button>
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
