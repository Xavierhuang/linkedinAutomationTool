import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Send, Copy, Check, Download, ArrowLeft, Plus, MoreVertical, 
  FileText, Image as ImageIcon, Calendar, Trash2, Menu, X, Paperclip, ChevronUp, History, Edit, Linkedin, AlertCircle, User, Building2, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import TextOverlayModal from './TextOverlayModalKonva';
import { useThemeTokens } from '@/hooks/useThemeTokens';

import { FloatingChatInput } from './conversation/FloatingChatInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BeeBotDraftsView = ({ orgId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const tokens = useThemeTokens();
  
  // Safety check - ensure tokens is always defined
  if (!tokens) {
    return null; // Or return a loading state
  }
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create.',
      timestamp: new Date()
    }
  ]);
  const [hasProcessedInitialMessage, setHasProcessedInitialMessage] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start with drafts closed
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [generateWithImage, setGenerateWithImage] = useState(true);
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
      textareaRef.current.style.height = `${newHeight} px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [inputMessage]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

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

  // Handle initial message from CreateView
  useEffect(() => {
    if (location.state?.initialMessage && location.state?.startNewConversation && !hasProcessedInitialMessage && orgId && user) {
      const initialText = location.state.initialMessage;
      
      // Mark as processed to prevent re-processing
      setHasProcessedInitialMessage(true);
      
      // Clear location state to prevent re-processing on re-renders
      navigate(location.pathname, { replace: true, state: {} });
      
      // Reset messages to start a new conversation
      const initialMessages = [
        {
          role: 'assistant',
          content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create.',
          timestamp: new Date()
        }
      ];
      
      setMessages(initialMessages);
      
      // Automatically send the initial message after state is updated
      // Use setTimeout to ensure messages state is updated first
      setTimeout(() => {
        // Process the message using the helper function (it will add the user message)
        handleSendMessageWithText(initialText);
      }, 150);
    }
  }, [location.state, orgId, user, hasProcessedInitialMessage, navigate]);

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
          `width = ${width}, height = ${height}, left = ${left}, top = ${top}, toolbar = no, location = no, status = no, menubar = no, scrollbars = yes, resizable = yes`
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
              alert('LinkedIn connected successfully!');
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
                alert('LinkedIn connection failed. Please try again.');
              } else {
                if (orgId) {
                  await fetchLinkedInAuthors();
                }
                alert('LinkedIn connected successfully!');
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

  const handleSendMessageWithText = async (messageText) => {
    if (!messageText || !messageText.trim() || loading) return;

    const currentInput = messageText.trim();
    
    // Use functional update to get the latest messages state and process
    let messagesToUse;
    setMessages(prev => {
      const userMessage = {
        role: 'user',
        content: currentInput,
        timestamp: new Date()
      };
      messagesToUse = [...prev, userMessage];
      return messagesToUse;
    });

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    try {
      // Check for carousel command
      if (currentInput.toLowerCase().includes('carousel') || currentInput.toLowerCase().includes('slide deck')) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Generating carousel with 5 slides... This will take 2-3 minutes.',
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

        const fullContent = `${carouselResponse.data.caption} \n\n${carouselResponse.data.slides.length} Slides: \n${carouselResponse.data.slides.map((s, i) => `\n${i + 1}. ${s.title}\n   ${s.content}`).join('\n')} `;
        
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
      } else {
        // Add typing indicator
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isLoading: true
        }]);

        // Use conversational chat endpoint with the updated messages
        const response = await axios.post(`${BACKEND_URL}/api/drafts/chat`, {
          messages: messagesToUse.map(m => ({ role: m.role, content: m.content })),
          org_id: orgId,
          user_id: user.id,
          generate_with_image: generateWithImage  // Pass image generation flag
        });

        const data = response.data;

        // Remove loading indicator and add response
        if (data.type === 'question') {
        setMessages(prev => prev.slice(0, -1).concat({
          role: 'assistant',
            content: data.content,
            timestamp: new Date()
          }));
        } else if (data.type === 'draft') {
          // Extract hashtags if present in content
          const hashtagMatch = data.content.match(/#\w+/g);
          const hashtags = hashtagMatch || [];

          setMessages(prev => prev.slice(0, -1).concat({
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            isPost: true,
            hashtags: hashtags,
            image: data.image_url || null,  // Include generated image if available
            postData: {
              content: data.content,
              hashtags: hashtags,
              image: data.image_url || null
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => prev.slice(0, -1).concat({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;
    await handleSendMessageWithText(inputMessage);
    setInputMessage('');
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
        content: `Image uploaded successfully: ${response.data.filename} `,
        timestamp: new Date(),
        image: response.data.url
      }]);
    } catch (error) {
      console.error('Image upload failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Failed to upload image: ${error.response?.data?.detail || error.message} `,
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
        id: `draft_${Date.now()} `,
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
        content: 'Draft saved successfully!',
        timestamp: new Date()
      }]);
      
      fetchDrafts();
    } catch (error) {
      console.error('Error saving draft:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to save draft.',
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
        id: `draft_${Date.now()} `,
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
        id: `scheduled_${Date.now()} `,
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
        content: 'Post scheduled successfully! Check the Calendar view.',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error scheduling post:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to schedule post. Error: ' + (error.response?.data?.detail || error.message),
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
        id: `draft_${Date.now()} `,
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
        id: `scheduled_${Date.now()} `,
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
        content: 'Post published to LinkedIn successfully!',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('❌ Error posting now:', error);
      console.error('Error details:', error.response?.data);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to post to LinkedIn. ' + (error.response?.data?.detail || 'Please make sure your LinkedIn account is connected in Settings.'),
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
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10 text-primary">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">
            No Organization Selected
          </h3>
          <p className="mb-6 text-muted-foreground text-sm">
            Please select an organization to start creating posts.
          </p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const cardBg = 'hsl(var(--card))';
  const cardBorderColor = 'hsl(var(--border))';
  const cardText = 'hsl(var(--foreground))';

  return (
    <div className="h-full flex flex-col md:flex-row relative bg-background text-foreground font-sans">
      {/* Overlay - show when drafts sidebar is open on mobile or desktop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Drafts Sidebar */}
      <div 
        className={`
          ${sidebarOpen ? 'translate-y-0 md:translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:-translate-x-full'}
          transition-all duration-300 ease-in-out
          fixed
          bottom-0 md:bottom-0 md:top-0 left-0 md:left-0 right-0 md:right-auto
          z-50
          border-t md:border-t-0 md:border-r border-border
          flex flex-col
          rounded-t-3xl md:rounded-none
          h-[80vh] md:h-full
          w-full md:w-96
          bg-card
        `}
      >
        {/* Mobile Bottom Sheet Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div 
            style={{ backgroundColor: tokens.colors.text.tertiary + '33' }}
            className="w-12 h-1 rounded-full cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        {/* Sidebar Header */}
        <div style={{ borderBottom: `1px solid ${tokens.colors.border.default}` }} className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History style={{ color: tokens.colors.accent.lime }} className="w-5 h-5" />
            <h2 style={{ color: tokens.colors.text.primary, fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic' }} className="text-lg">Saved Drafts</h2>
            {savedDrafts.length > 0 && (
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: tokens.radius.full, 
                backgroundColor: tokens.colors.accent.lime + '1A', 
                color: tokens.colors.accent.lime, 
                border: `1px solid ${tokens.colors.accent.lime}33`
              }}>
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
                borderRadius: tokens.radius.full, 
                backgroundColor: tokens.colors.accent.lime, 
                color: tokens.colors.text.inverse,
                border: 'none'
              }}
              className="flex items-center justify-center"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
              title="New Draft"
          >
              <Plus className="w-4 h-4" />
          </Button>
            <Button
              onClick={() => setSidebarOpen(false)}
            style={{ 
              width: '32px', 
              height: '32px', 
              padding: 0, 
              backgroundColor: tokens.colors.background.input, 
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radius.full,
              color: tokens.colors.text.secondary
            }}
              className="flex items-center justify-center"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.background.layer1;
                e.currentTarget.style.color = tokens.colors.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                e.currentTarget.style.color = tokens.colors.text.secondary;
              }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Drafts List */}
        <div className="flex-1 overflow-y-auto p-3">
          {savedDrafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm">No drafts yet</p>
              <p className="text-xs mt-1">Create your first draft</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedDrafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => handleLoadDraft(draft)}
                  className={`
                    p-3 rounded-xl cursor-pointer transition-all group border
                    ${selectedDraft?.id === draft.id
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-muted border-border hover:bg-muted/70 hover:border-primary/30'}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {draft.mode === 'image' ? (
                        <ImageIcon style={{ color: tokens.colors.accent.lime }} className="w-4 h-4" />
                      ) : (
                        <FileText style={{ color: tokens.colors.text.secondary }} className="w-4 h-4" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(draft.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDraft(draft.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground leading-relaxed font-light">
                    {draft.content.body}
                  </p>
                  {draft.content.hashtags && draft.content.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {draft.content.hashtags.slice(0, 2).map((tag, idx) => (
                        <span 
                          key={idx}
                          className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20"
                        >
                          {tag}
                        </span>
                      ))}
                      {draft.content.hashtags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
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
      <div className="flex-1 flex flex-col relative overflow-hidden bg-card">
        {/* View Drafts Button - Top Right */}
        <div className="absolute top-4 right-4 z-40">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border text-sm font-medium shadow-lg
              ${sidebarOpen
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'}
            `}
          >
            <History className="w-4 h-4" />
            <span>{sidebarOpen ? 'Hide' : 'View'} Drafts</span>
            {savedDrafts.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 rounded-full ${sidebarOpen ? 'bg-primary/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                {savedDrafts.length}
              </span>
            )}
          </button>
        </div>

        {/* LinkedIn Connection Alert */}
        {orgId && !linkedinConnected && (
          <div 
            className="mx-4 md:mx-6 mt-4 p-4 rounded-xl flex items-start gap-3"
            style={{
              backgroundColor: `${tokens.colors.accent.lime}1A`,
              border: `1px solid ${tokens.colors.accent.lime}4D`,
              borderRadius: tokens.radius.xl
            }}
          >
            <AlertCircle 
              className="w-5 h-5 flex-shrink-0 mt-0.5" 
              style={{ color: tokens.colors.accent.lime }}
            />
              <div className="flex-1">
              <h3 
                className="font-medium text-sm mb-1"
                style={{ color: tokens.colors.text.primary }}
              >
                LinkedIn Not Connected
              </h3>
              <p 
                className="text-xs mb-3 leading-relaxed"
                style={{ color: tokens.colors.text.secondary }}
              >
                Connect your LinkedIn account to publish posts directly. You can create content now, but posting requires connection.
                </p>
                <Button
                  onClick={handleConnectLinkedIn}
                  disabled={linkedinConnecting}
                  className="border-none h-8 text-xs px-3 rounded-lg"
                  style={{
                    backgroundColor: tokens.colors.accent.lime,
                    color: tokens.colors.text.inverse
                  }}
                  onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = tokens.colors.accent.limeHover)}
                  onMouseLeave={(e) => !e.target.disabled && (e.target.style.backgroundColor = tokens.colors.accent.lime)}
                >
                  <Linkedin className="w-3 h-3 mr-2" />
                  {linkedinConnecting ? 'Connecting...' : 'Connect Account'}
                </Button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-h-0">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* Avatar - Assistant */}
              {message.role === 'assistant' && (
                <div 
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: tokens.colors.accent.lime }}
                >
                  <Bot style={{ color: tokens.colors.text.inverse }} className="w-4 h-4" />
                </div>
              )}

              <div
                className="
                  max-w-[85%] md:max-w-[70%] p-4 text-sm leading-relaxed relative bg-muted text-foreground border border-border
                "
                style={{
                  backgroundColor: message.role === 'user' 
                    ? tokens.colors.accent.lime 
                    : cardBg,
                  color: message.role === 'user' ? tokens.colors.text.inverse : cardText,
                  borderRadius: tokens.radius.xl,
                  boxShadow: tokens.shadow.subtle,
                  border: message.role === 'user' ? 'none' : `1px solid ${cardBorderColor}`,
                  position: 'relative'
                }}
              >
                {/* Tail pointer for assistant messages - pointing left toward avatar */}
                {message.role === 'assistant' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '20px',
                      width: '12px',
                      height: '12px',
                      backgroundColor: cardBg,
                      transform: 'rotate(45deg)'
                    }}
                  />
                )}
                {/* Tail pointer for user messages - pointing right */}
                {message.role === 'user' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      right: '16px',
                      width: 0,
                      height: 0,
                      borderStyle: 'solid',
                      borderWidth: '0 0 12px 12px',
                      borderColor: `transparent transparent ${tokens.colors.accent.lime} transparent`,
                      transform: 'rotate(-45deg)'
                    }}
                  />
                )}
                {/* Loading State */}
                {message.isLoading ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <div className="flex items-end gap-1">
                      <div 
                        className="w-2 h-2 rounded-full bg-foreground/70"
                        style={{
                          animation: 'bounce 0.8s ease-in-out infinite',
                          animationDelay: '0s'
                        }}
                      />
                      <div 
                        className="w-2 h-2 rounded-full bg-foreground/70"
                        style={{
                          animation: 'bounce 0.8s ease-in-out infinite',
                          animationDelay: '0.15s'
                        }}
                      />
                      <div 
                        className="w-2 h-2 rounded-full bg-foreground/70"
                        style={{
                          animation: 'bounce 0.8s ease-in-out infinite',
                          animationDelay: '0.3s'
                        }}
                      />
                    </div>
                  </div>
                        ) : (
                          <>
                    {/* Text Content */}
                    <div className="whitespace-pre-wrap font-light">{message.content}</div>
                            
                    {/* Image Attachment */}
                            {message.image && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-border group relative">
                                <img 
                                  src={message.image} 
                                  alt="Generated" 
                          className="w-full h-auto object-cover"
                        />
                        <button
                                  onClick={() => {
                                    setSelectedImageForEdit(message.image);
                                    setSelectedMessageForTextOverlay(message);
                                    setShowTextOverlayModal(true);
                                  }}
                          className="absolute bottom-3 right-3 bg-background/70 hover:bg-background px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 border border-border"
                        >
                          <Edit className="w-3 h-3" /> Edit Image
                        </button>
                              </div>
                            )}
                            
                    {/* Hashtags */}
                    {message.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                        {message.hashtags.map((tag, i) => (
                          <span key={i} style={{ color: tokens.colors.accent.lime, fontSize: '12px' }}>#{tag.replace(/^#/, '')}</span>
                                ))}
                              </div>
                            )}

                    {/* Actions (Assistant Only - Post Generated) */}
                    {message.role === 'assistant' && !message.isError && message.isPost && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                                <Button
                          size="sm"
                          variant="ghost"
                                  onClick={() => handleCopy(message.content, index)}
                          className="h-8 text-xs hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          {copiedIndex === index ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy
                                </Button>
                                <Button
                          size="sm"
                          variant="ghost"
                                  onClick={() => handleSaveDraft(
                                    message.postData || { content: message.content }, 
                                    message.image,
                            message.textOverlays
                          )}
                          className="h-8 text-xs hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Download className="w-3 h-3 mr-1" /> Save Draft
                                </Button>
                                <Button
                          size="sm"
                          variant="ghost"
                                  onClick={() => handleScheduleClick(
                                    message.postData || { content: message.content }, 
                                    message.image,
                            message.textOverlays
                          )}
                          className="h-8 text-xs hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Schedule
                                </Button>
                                <Button
                          size="sm"
                                  onClick={() => handlePostNowClick(
                                    message.postData || { content: message.content }, 
                                    message.image,
                            message.textOverlays
                          )}
                          className="h-8 text-xs border-none ml-auto"
                          style={{
                            backgroundColor: tokens.colors.accent.lime,
                            color: tokens.colors.text.inverse
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.accent.limeHover}
                          onMouseLeave={(e) => e.target.style.backgroundColor = tokens.colors.accent.lime}
                        >
                          <Send className="w-3 h-3 mr-1" /> Post Now
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

              {/* Avatar - User */}
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#88D9E7] to-[#5AB9D1] flex items-center justify-center shadow-lg">
                  <User className="w-4 h-4 text-black" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
            {/* Spacer to ensure page is always scrollable */}
            <div className="h-[200px]" />
        </div>

        {/* Floating Input Area */}
        <FloatingChatInput
          value={inputMessage}
          setValue={setInputMessage}
          onSubmit={handleSendMessage}
          inputDisabled={loading}
          placeholder="What do you want to post about?"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left Side: Post As & Model */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Author Selector */}
              {linkedinAuthors && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Post as</span>
                  <Select
                    value={selectedAuthor ? `${selectedAuthor.type}:${selectedAuthor.id}` : ''}
                    onValueChange={(value) => {
                      if (!linkedinAuthors) return;
                      const [type, id] = value.split(':');
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
                  >
                    <SelectTrigger className="w-[180px] h-8 bg-input border border-border text-xs text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Select author" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border text-foreground">
                      {linkedinAuthors.personal && (
                        <SelectItem value={`personal:${linkedinAuthors.personal.id}`} className="text-xs focus:bg-muted focus:text-foreground cursor-pointer">
                          {linkedinAuthors.personal.name || 'Personal Profile'}
                        </SelectItem>
                      )}
                      {linkedinAuthors.organizations?.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1">Companies</SelectLabel>
                          {linkedinAuthors.organizations.map(org => (
                            <SelectItem key={org.id} value={`organization:${org.id}`} className="text-xs focus:bg-muted focus:text-foreground cursor-pointer pl-4">
                              {org.name || org.localizedName || 'Organization'}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            
              {/* Divider */}
              <div className="w-px h-4 bg-border shrink-0" />

              {/* Model Selection */}
              <div className="relative flex-1 min-w-0 max-w-[220px]">
                <Select
                  value={imageModel}
                  onValueChange={setImageModel}
                >
                  <SelectTrigger className="w-full h-8 bg-transparent border-none text-xs text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 px-0 shadow-none justify-start gap-2">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border text-foreground min-w-[220px]">
                    <SelectItem value="gemini-stock" className="text-xs focus:bg-muted focus:text-foreground cursor-pointer">Gemini 2.5 Flash + Stock</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash-image" className="text-xs focus:bg-muted focus:text-foreground cursor-pointer">Gemini 2.5 Flash Only</SelectItem>
                    <SelectItem value="stock" className="text-xs focus:bg-muted focus:text-foreground cursor-pointer">Stock Photos Only</SelectItem>
                    <SelectItem value="ai_horde" className="text-xs focus:bg-muted focus:text-foreground cursor-pointer">AI Horde (Slow)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Side: Image Toggle */}
                      <button
              onClick={() => setGenerateWithImage(!generateWithImage)}
              className={`
                shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all border font-medium
                ${generateWithImage
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(136,217,231,0.2)]'
                  : 'bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80'}
              `}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {generateWithImage ? 'Image On' : 'Add Image'}
                      </button>
                    </div>
        </FloatingChatInput>
      </div>
                  
      {/* Hidden Inputs */}
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

      {/* Modals */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-background/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-serif italic text-foreground mb-6 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" /> Schedule Post
            </h2>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Date</label>
                <input
                  type="date"
                  value={scheduleData.scheduled_for}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_for: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleData.scheduled_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground outline-none focus:border-primary text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground border border-border h-10 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSchedule}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-10 rounded-lg font-medium"
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-background/80 z-[60] flex items-center justify-center p-4">
          <div style={{ backgroundColor: tokens.colors.background.layer2, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.xl }} className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div style={{ borderBottom: `1px solid ${tokens.colors.border.default}` }} className="p-6 flex justify-between items-center">
              <h2 style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>Preview Post</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{ color: tokens.colors.text.tertiary }}
                className="transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.tertiary}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Author info */}
            {selectedAuthor && (
                <div className="flex items-center gap-3 mb-6">
                  <div style={{ width: '40px', height: '40px', backgroundColor: tokens.colors.background.input, borderRadius: '50%' }} className="flex items-center justify-center">
                    {selectedAuthor.type === 'organization' ? <Building2 style={{ color: tokens.colors.text.secondary }} className="w-5 h-5" /> : <User style={{ color: tokens.colors.text.secondary }} className="w-5 h-5" />}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>{selectedAuthor.name}</p>
                    <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary }}>Posting Now</p>
                  </div>
              </div>
            )}

              {/* Content */}
              <p style={{ color: tokens.colors.text.primary, fontSize: '14px', lineHeight: 1.6, fontWeight: 300 }} className="leading-relaxed whitespace-pre-wrap mb-4">
                {previewData.postData.content}
              </p>

              {/* Hashtags */}
              {previewData.postData.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {previewData.postData.hashtags.map((tag, i) => (
                    <span key={i} style={{ color: tokens.colors.accent.lime, fontSize: '12px' }}>#{tag.replace(/^#/, '')}</span>
                  ))}
                </div>
              )}

              {/* Image */}
            {previewData.image && (
                <div className="rounded-xl overflow-hidden border border-border bg-muted">
                <img 
                  src={previewData.image} 
                    alt="Post"
                    className="w-full h-auto max-h-[400px] object-contain mx-auto"
                />
              </div>
            )}
            </div>

            <div style={{ padding: '24px', borderTop: `1px solid ${tokens.colors.border.default}`, backgroundColor: tokens.colors.background.layer1 }} className="flex gap-3 rounded-b-2xl">
              <Button
                onClick={() => setShowPreviewModal(false)}
                style={{ 
                  flex: 1, 
                  backgroundColor: tokens.colors.background.input, 
                  color: tokens.colors.text.primary,
                  border: `1px solid ${tokens.colors.border.default}`,
                  height: '40px',
                  borderRadius: tokens.radius.lg
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.input}
              >
                Edit
              </Button>
              <Button
                onClick={() => {
                  handlePostNow(previewData.postData, previewData.image, previewData.textOverlays);
                  setShowPreviewModal(false);
                }}
                style={{ 
                  flex: 1, 
                  backgroundColor: tokens.colors.accent.lime, 
                  color: tokens.colors.text.inverse,
                  border: 'none',
                  height: '40px',
                  borderRadius: tokens.radius.lg,
                  fontWeight: 500
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
              >
                <Linkedin className="w-4 h-4 mr-2" /> Post to LinkedIn
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <TextOverlayModal
        isOpen={showTextOverlayModal}
        onClose={() => setShowTextOverlayModal(false)}
        imageUrl={selectedImageForEdit}
        initialElements={selectedMessageForTextOverlay?.textOverlays || imageOverlays[selectedImageForEdit] || []}
        campaignData={selectedMessageForTextOverlay}
        onApply={(newImageUrl, elements) => {
          const oldImageUrl = selectedImageForEdit;
          setSelectedImageForEdit(newImageUrl);
          
          setMessages(prev => prev.map(msg => {
            if (msg.image === oldImageUrl) {
              return {
                ...msg, 
                image: newImageUrl,
                textOverlays: elements || []
              };
            }
            return msg;
          }));
          
          setImageOverlays(prev => {
            const newOverlays = { ...prev };
            delete newOverlays[oldImageUrl];
            newOverlays[newImageUrl] = elements || [];
            return newOverlays;
          });
        }}
      />
    </div>
  );
};

export default BeeBotDraftsView;
