import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Linkedin, Loader2, X, Clock, Send, CheckCircle, ExternalLink, List, Calendar as CalendarIcon, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { getUserTimezone, convertUTCToUserTime, getTimeInUserTimezone } from '@/utils/timezone';
import TextOverlayModal from './TextOverlayModalKonva';
import designTokens from '@/designTokens';
import { CalendarPostCard } from '@/components/ui/CalendarPostCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CalendarView = ({ orgId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [draggedPost, setDraggedPost] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [isMobile, setIsMobile] = useState(false);
  const campaignsCacheRef = useRef({}); // Cache campaigns per org
  
  // Onboarding post generation state
  const [onboardingGenerating, setOnboardingGenerating] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState({ current: 0, total: 3 });
  const onboardingGeneratedRef = useRef(false); // Prevent duplicate generation
  const scheduledPostsRef = useRef([]); // Ref to track current scheduledPosts

  const cardBackground = 'hsl(var(--card))';
  const layerOneBackground = 'hsl(var(--layer-1))';
  const layerTwoBackground = 'hsl(var(--layer-2))';
  const inputBackground = 'hsl(var(--input))';
  const borderColorValue = 'hsl(var(--border))';
  const textPrimaryColor = 'hsl(var(--foreground))';
  const textSecondaryColor = 'hsl(var(--muted-foreground))';
  const accentColor = 'hsl(var(--primary))';
  const accentForeground = 'hsl(var(--primary-foreground))';

  const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  const timeSlotHeight = 200; // Taller to show more card details
  
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  
  // Text overlay editing
  const [showTextOverlayModal, setShowTextOverlayModal] = useState(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState(null);
  const [imageOverlays, setImageOverlays] = useState({}); // Store overlay elements by image URL

  // Detect mobile and tablet viewport
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      // Auto-switch to list view on mobile only
      if (mobile && viewMode === 'calendar') {
        setViewMode('list');
      }
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Fetch user's timezone on mount
  useEffect(() => {
    const fetchTimezone = async () => {
      if (user) {
        const tz = await getUserTimezone(user.id);
        setUserTimezone(tz);
        console.log('🌍 User timezone:', tz);
      }
    };
    fetchTimezone();
  }, [user]);

  // Ensure calendar always starts from today when component mounts or orgId changes
  // Use useRef to track previous orgId and only reset when it actually changes
  const prevOrgIdRef = useRef(orgId);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (orgId && prevOrgIdRef.current !== orgId) {
      // Only reset when orgId actually changes (not on every render)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today in local timezone
      setCurrentWeek(today);
      prevOrgIdRef.current = orgId;
      // Clear posts immediately when switching orgs for better UX
      setScheduledPosts([]);
      scheduledPostsRef.current = [];
      console.log('📅 Calendar reset to today:', today.toLocaleDateString());
      // Fetch will be triggered by the currentWeek change in the next effect
    } else if (orgId && !prevOrgIdRef.current) {
      // First time orgId is set
      prevOrgIdRef.current = orgId;
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId && !isFetchingRef.current) {
      isFetchingRef.current = true;
      fetchScheduledPosts().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [orgId, currentWeek]);

  // Check for onboarding when query parameter changes or component mounts
  useEffect(() => {
    const checkOnboarding = () => {
      if (!orgId || onboardingGeneratedRef.current) {
        console.log('[CALENDAR_ONBOARDING] Skipping check:', { hasOrgId: !!orgId, alreadyGenerated: onboardingGeneratedRef.current });
        return;
      }
      
      const onboardingDataStr = localStorage.getItem('onboarding_post_generation');
      const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';
      
      console.log('[CALENDAR_ONBOARDING] useEffect check:', {
        hasOrgId: !!orgId,
        orgId: orgId,
        hasOnboardingData: !!onboardingDataStr,
        isOnboarding,
        locationSearch: location.search,
        onboardingGeneratedRef: onboardingGeneratedRef.current
      });
      
      if (onboardingDataStr && isOnboarding) {
        try {
          const onboardingData = JSON.parse(onboardingDataStr);
          console.log('[CALENDAR_ONBOARDING] Parsed data:', {
            storedOrgId: onboardingData.orgId,
            currentOrgId: orgId,
            orgIdMatch: onboardingData.orgId === orgId,
            topicsCount: onboardingData.topics?.length,
            hasTopics: !!onboardingData.topics
          });
          
          if (onboardingData.orgId === orgId && onboardingData.topics && onboardingData.topics.length === 3) {
            console.log('🚀 Starting onboarding post generation in calendar (from useEffect)...');
            onboardingGeneratedRef.current = true;
            
            // Create and add loading posts immediately
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const timeSlots = onboardingData.campaign?.posting_schedule?.time_slots || ['09:00'];
            const loadingPosts = [];
            
            for (let i = 0; i < 3; i++) {
              const postDate = new Date(today);
              postDate.setDate(today.getDate() + i);
              const timeSlot = timeSlots[i % timeSlots.length] || '09:00';
              const [hours, minutes] = timeSlot.split(':').map(Number);
              const publishDate = new Date(postDate);
              publishDate.setHours(hours, minutes || 0, 0, 0);
              
              loadingPosts.push({
                id: `loading_${i}_${Date.now()}`,
                draft_id: null,
                scheduled_for: publishDate.toISOString(),
                content: 'Generating post...',
                body: 'Generating post...',
                image_url: null,
                is_loading: true,
                loading_progress: i + 1,
                loading_total: 3,
                topic: onboardingData.topics[i]?.topic || `Post ${i + 1}`
              });
            }
            
            console.log('[CALENDAR_ONBOARDING] Created loading posts:', loadingPosts.length);
            
            // Add loading posts to state immediately
            setScheduledPosts(prev => {
              const updated = [...prev, ...loadingPosts];
              scheduledPostsRef.current = updated; // Update ref
              console.log('[CALENDAR_ONBOARDING] Added loading posts, total:', updated.length);
              return updated;
            });
            
            // Start generation
            generateOnboardingPosts(onboardingData);
          } else {
            console.warn('[CALENDAR_ONBOARDING] Conditions not met:', {
              orgIdMatch: onboardingData.orgId === orgId,
              hasTopics: !!onboardingData.topics,
              topicsLength: onboardingData.topics?.length
            });
          }
        } catch (e) {
          console.error('[CALENDAR_ONBOARDING] Failed to parse:', e);
        }
      }
    };
    
    // Check immediately and also after a short delay to catch redirects
    checkOnboarding();
    const timeout = setTimeout(checkOnboarding, 1000);
    
    return () => clearTimeout(timeout);
  }, [orgId, location.search]);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      // Include past dates to show posted posts, and future dates for scheduled posts
      const rangeStart = getDateRangeStart(currentWeek);
      const weekEnd = getWeekEnd(currentWeek);
      
      // Ensure dates are properly formatted for backend query
      const rangeStartStr = rangeStart.toISOString();
      const rangeEndStr = weekEnd.toISOString();
      
      // Log the date range being queried
      console.log('📅 Calendar fetching posts:', {
        orgId,
        rangeStart: rangeStartStr,
        rangeEnd: rangeEndStr,
        currentWeek: currentWeek.toISOString(),
        daysInRange: Math.round((weekEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)),
        today: new Date().toISOString()
      });
      
      // Fetch scheduled posts (including posted ones), approved AI content, and posted posts
      // Use date range filtering for AI posts to improve performance
      const [scheduledRes, aiPostsRes, postedRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&range_start=${rangeStartStr}&range_end=${rangeEndStr}`),
        axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}&range_start=${rangeStartStr}&range_end=${rangeEndStr}`),
        axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}&range_start=${rangeStartStr}&range_end=${rangeEndStr}`)
      ]);

      // AI posts are now filtered by backend, but we still need to handle edge cases
      const filteredAiPosts = aiPostsRes.data;
      
      console.log('📅 Calendar fetch results:', {
        scheduledPosts: scheduledRes.data.length,
        aiPosts: aiPostsRes.data.length,
        postedPosts: postedRes.data.length,
        scheduledPostIds: scheduledRes.data.map(p => ({ id: p.id, publish_time: p.publish_time, status: p.status }))
      });

      // Create a map of posted posts by scheduled_post_id and ai_post_id for quick lookup
      const postedMap = {};
      postedRes.data.forEach(post => {
        if (post.scheduled_post_id) {
          postedMap[post.scheduled_post_id] = post;
        }
        // Also map by AI post ID if available
        if (post.ai_post_id) {
          postedMap[post.ai_post_id] = post;
        }
      });

      const combined = [
        // Map scheduled posts (normalize publish_time -> scheduled_for, extract content from draft)
        ...scheduledRes.data.map(p => {
          const postedInfo = postedMap[p.id];
          
          // Debug: Log image URL extraction for onboarding posts
          const imageUrl = p.draft_preview?.assets?.[0]?.url || p.draft_preview?.content?.image_url || null;
          if (imageUrl) {
            console.log(`[CALENDAR] Post ${p.id} has image URL:`, {
              postId: p.id,
              hasDraftPreview: !!p.draft_preview,
              assetsCount: p.draft_preview?.assets?.length || 0,
              imageUrlPreview: imageUrl.substring(0, 50) + '...',
              imageUrlType: imageUrl.startsWith('data:') ? 'base64' : 'url'
            });
          } else {
            console.warn(`[CALENDAR] Post ${p.id} missing image URL:`, {
              postId: p.id,
              hasDraftPreview: !!p.draft_preview,
              assetsCount: p.draft_preview?.assets?.length || 0,
              draftPreviewKeys: p.draft_preview ? Object.keys(p.draft_preview) : [],
              assets: p.draft_preview?.assets || []
            });
          }
          
          return {
            ...p,
            source: 'scheduled',
            scheduled_for: p.publish_time, // Map publish_time to scheduled_for
            content: p.draft_preview?.content?.body || p.content || '',
            image_url: imageUrl,
            is_posted: p.status === 'posted' || !!postedInfo,
            platform_url: postedInfo?.platform_url || null,
            posted_at: postedInfo?.posted_at || null,
            // Extract LinkedIn author info from draft_preview
            profile_type: p.draft_preview?.linkedin_author_type || 'personal',
            linkedin_author_id: p.draft_preview?.linkedin_author_id || null,
            campaign_id: p.campaign_id || p.draft_preview?.campaign_id || null
          };
        }),
        // AI posts already have scheduled_for and content (filtered by date range)
        ...filteredAiPosts.map(p => {
          const postedInfo = postedMap[p.id]; // Check if this AI post was posted
          return {
            ...p,
            source: 'ai',
            scheduled_for: p.scheduled_for || null,
            is_posted: p.status === 'posted' || p.status === 'POSTED' || !!postedInfo, // Check status or posted map
            platform_url: postedInfo?.platform_url || null,
            posted_at: postedInfo?.posted_at || p.posted_at || null
          };
        })
      ];

      // Fetch campaigns and enrich posts with author names
      // Use cache to avoid refetching campaigns for the same org
      const uniqueCampaignIds = [...new Set(combined.filter(p => p.campaign_id).map(p => p.campaign_id))];
      let campaigns = campaignsCacheRef.current[orgId] || {};
      
      // Only fetch campaigns if we don't have them cached or if we need new ones
      if (uniqueCampaignIds.length > 0 && (!campaignsCacheRef.current[orgId] || 
          uniqueCampaignIds.some(id => !campaigns[id]))) {
        try {
          const campaignsRes = await axios.get(`${BACKEND_URL}/api/campaigns?org_id=${orgId}`);
          campaigns = {};
          campaignsRes.data.forEach(campaign => {
            campaigns[campaign.id] = campaign;
          });
          // Cache campaigns for this org
          campaignsCacheRef.current[orgId] = campaigns;
        } catch (error) {
          console.error('Error fetching campaigns:', error);
        }
      }

      // Enrich posts with author_name from campaigns (if not already present)
      const enrichedPosts = combined.map(p => {
        if (p.campaign_id && campaigns[p.campaign_id]) {
          const campaign = campaigns[p.campaign_id];
          return {
            ...p,
            // Prioritize post's own author_name, fallback to campaign
            author_name: p.author_name || campaign.author_name || null,
            profile_type: p.profile_type || campaign.profile_type || 'personal'
          };
        }
        return p;
      });

      setScheduledPosts(enrichedPosts);
      scheduledPostsRef.current = enrichedPosts; // Update ref
      
      // Check for onboarding post generation after initial fetch
      if (orgId && !onboardingGeneratedRef.current) {
        const onboardingDataStr = localStorage.getItem('onboarding_post_generation');
        const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';
        
        console.log('[CALENDAR_ONBOARDING] Checking onboarding:', {
          hasOrgId: !!orgId,
          orgId: orgId,
          hasOnboardingData: !!onboardingDataStr,
          isOnboarding,
          onboardingGeneratedRef: onboardingGeneratedRef.current,
          locationSearch: location.search,
          onboardingDataStr: onboardingDataStr ? onboardingDataStr.substring(0, 200) + '...' : null
        });
        
        if (onboardingDataStr && isOnboarding) {
          console.log('[CALENDAR_ONBOARDING] Conditions met, parsing data...');
          try {
            const onboardingData = JSON.parse(onboardingDataStr);
            console.log('[CALENDAR_ONBOARDING] Parsed onboarding data:', {
              orgId: onboardingData.orgId,
              currentOrgId: orgId,
              orgIdMatch: onboardingData.orgId === orgId,
              topicsCount: onboardingData.topics?.length,
              hasTopics: !!onboardingData.topics,
              topics: onboardingData.topics
            });
            
            if (onboardingData.orgId === orgId && onboardingData.topics && onboardingData.topics.length === 3) {
              console.log('🚀 Starting onboarding post generation in calendar...');
              onboardingGeneratedRef.current = true;
              
              // Create and add loading posts immediately
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const timeSlots = onboardingData.campaign?.posting_schedule?.time_slots || ['09:00'];
              const loadingPosts = [];
              
              for (let i = 0; i < 3; i++) {
                const postDate = new Date(today);
                postDate.setDate(today.getDate() + i);
                const timeSlot = timeSlots[i % timeSlots.length] || '09:00';
                const [hours, minutes] = timeSlot.split(':').map(Number);
                const publishDate = new Date(postDate);
                publishDate.setHours(hours, minutes || 0, 0, 0);
                
                loadingPosts.push({
                  id: `loading_${i}_${Date.now()}`,
                  draft_id: null,
                  scheduled_for: publishDate.toISOString(),
                  content: 'Generating post...',
                  body: 'Generating post...',
                  image_url: null,
                  is_loading: true,
                  loading_progress: i + 1,
                  loading_total: 3,
                  topic: onboardingData.topics[i]?.topic || `Post ${i + 1}`
                });
              }
              
              console.log('[CALENDAR_ONBOARDING] Created loading posts:', loadingPosts.map(p => ({
                id: p.id,
                scheduled_for: p.scheduled_for,
                is_loading: p.is_loading
              })));
              
              // Add loading posts to state immediately
              setScheduledPosts(prev => {
                const updated = [...prev, ...loadingPosts];
                scheduledPostsRef.current = updated; // Update ref
                console.log('[CALENDAR_ONBOARDING] Updated scheduledPosts:', {
                  prevCount: prev.length,
                  loadingCount: loadingPosts.length,
                  totalCount: updated.length
                });
                return updated;
              });
              
              // Start generation
              generateOnboardingPosts(onboardingData);
            } else {
              console.warn('[CALENDAR_ONBOARDING] Conditions not met:', {
                orgIdMatch: onboardingData.orgId === orgId,
                hasTopics: !!onboardingData.topics,
                topicsLength: onboardingData.topics?.length
              });
            }
          } catch (e) {
            console.error('[CALENDAR_ONBOARDING] Failed to parse onboarding data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate onboarding posts directly in calendar
  const generateOnboardingPosts = async (onboardingData) => {
    if (onboardingGenerating) {
      console.warn('Onboarding posts already generating');
      return;
    }
    
    setOnboardingGenerating(true);
    setOnboardingProgress({ current: 0, total: 3 });
    
    try {
      const { orgId, campaignId, campaign, brandContext, campaignContext, topics, userId } = onboardingData;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Loading posts should already be added in fetchScheduledPosts or useEffect
      // Find them from scheduledPosts state using ref to get current value
      const currentPosts = scheduledPostsRef.current.length > 0 ? scheduledPostsRef.current : scheduledPosts;
      const existingLoadingPosts = currentPosts.filter(p => p.is_loading).sort((a, b) => {
        // Sort by scheduled_for to match order
        return new Date(a.scheduled_for) - new Date(b.scheduled_for);
      });
      
      console.log('[CALENDAR_ONBOARDING] Starting post generation, current scheduledPosts count:', currentPosts.length);
      console.log('[CALENDAR_ONBOARDING] Found loading posts:', existingLoadingPosts.length);
      
      // Track used post types for template rotation
      const usedPostTypes = [];
      
      for (let i = 0; i < 3; i++) {
        setOnboardingProgress({ current: i + 1, total: 3 });
        
        const topic = topics[i];
        if (!topic) continue;
        
        const postDate = new Date(today);
        postDate.setDate(today.getDate() + i);
        
        // Find the loading post for this index
        const loadingPost = existingLoadingPosts[i];
        const loadingPostId = loadingPost?.id || `loading_${i}_${Date.now()}`;
        
        // Update loading post with progress
        setScheduledPosts(prev => {
          const updated = prev.map(p => 
            p.id === loadingPostId 
              ? { ...p, content: `Generating post ${i + 1}/3...`, body: `Generating post ${i + 1}/3...` }
              : p
          );
          scheduledPostsRef.current = updated;
          return updated;
        });
        
        // Generate post
        const enrichedTopic = `${topic.topic}\n\nBrand Context: ${brandContext.brand_voice} voice, focusing on ${brandContext.content_pillars.slice(0, 2).join(' and ')}. Key messages: ${brandContext.key_messages.slice(0, 2).join(', ')}. Campaign: ${campaignContext.campaign_name} - ${campaignContext.campaign_focus}.`;
        const excludedTypes = [...usedPostTypes];
        
        const brandContextWithTopic = {
          ...brandContext,
          topic: topic.topic,
          enriched_topic: enrichedTopic
        };
        
        setScheduledPosts(prev => {
          const updated = prev.map(p => 
            p.id === loadingPostId 
              ? { ...p, content: 'Creating post content...', body: 'Creating post content...' }
              : p
          );
          scheduledPostsRef.current = updated;
          return updated;
        });
        
        const postResponse = await axios.post(`${BACKEND_URL}/api/brand/generate-post`, {
          org_id: orgId || null,
          campaign_id: campaignId,
          brand_context: brandContextWithTopic,
          excluded_types: excludedTypes,
          user_id: userId
        });
        
        const postData = postResponse.data;
        if (postData?.post_type && !usedPostTypes.includes(postData.post_type)) {
          usedPostTypes.push(postData.post_type);
        }
        
        // Save draft
        const draftToSave = {
          author_id: userId,
          mode: 'text',
          content: { body: postData.content, hashtags: [] },
          assets: []
        };
        if (orgId) draftToSave.org_id = orgId;
        if (campaignId) draftToSave.campaign_id = campaignId;
        
        setScheduledPosts(prev => {
          const updated = prev.map(p => 
            p.id === loadingPostId 
              ? { ...p, content: 'Saving draft...', body: 'Saving draft...' }
              : p
          );
          scheduledPostsRef.current = updated;
          return updated;
        });
        
        const savedDraft = (await axios.post(`${BACKEND_URL}/api/drafts`, draftToSave)).data;
        
        // Generate image
        setScheduledPosts(prev => {
          const updated = prev.map(p => 
            p.id === loadingPostId 
              ? { ...p, content: 'Generating image...', body: 'Generating image...' }
              : p
          );
          scheduledPostsRef.current = updated;
          return updated;
        });
        
        const imageResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
          prompt: postData.content,
          topic: topic.topic,
          style: campaign?.image_style || 'professional',
          user_id: userId,
          org_id: orgId || null,
          campaign_id: campaignId || null,
          model: 'gemini-3-pro-image-preview',
          skip_optimization: true
        }, { timeout: 220000 });
        
        const imageUrl = imageResponse.data?.url;
        if (imageUrl) {
          // Update draft with image
          const currentDraft = (await axios.get(`${BACKEND_URL}/api/drafts/${savedDraft.id}`)).data;
          await axios.put(`${BACKEND_URL}/api/drafts/${savedDraft.id}`, {
            ...currentDraft,
            assets: [{ type: 'image', url: imageUrl, prompt: topic.topic, generated_at: new Date().toISOString() }]
          });
        }
        
        // Schedule post
        const timeSlots = campaign?.posting_schedule?.time_slots || ['09:00'];
        const timeSlot = timeSlots[i % timeSlots.length] || '09:00';
        const [hours, minutes] = timeSlot.split(':').map(Number);
        const publishDate = new Date(postDate);
        publishDate.setHours(hours, minutes || 0, 0, 0);
        
        setScheduledPosts(prev => {
          const updated = prev.map(p => 
            p.id === loadingPostId 
              ? { ...p, content: 'Scheduling post...', body: 'Scheduling post...' }
              : p
          );
          scheduledPostsRef.current = updated;
          return updated;
        });
        
        await axios.post(`${BACKEND_URL}/api/scheduled-posts`, {
          id: `scheduled_${Date.now()}_${i}`,
          draft_id: savedDraft.id,
          org_id: orgId || null,
          publish_time: publishDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          status: 'scheduled',
          require_approval: false
        });
        
        // Remove loading post and refresh to show real post
        setScheduledPosts(prev => {
          const updated = prev.filter(p => p.id !== loadingPostId);
          scheduledPostsRef.current = updated;
          return updated;
        });
        await fetchScheduledPosts();
      }
      
      // Clear onboarding data
      localStorage.removeItem('onboarding_post_generation');
      console.log('✅ Onboarding posts generated successfully');
      
    } catch (error) {
      console.error('❌ Failed to generate onboarding posts:', error);
      // Remove loading posts on error
      setScheduledPosts(prev => {
        const updated = prev.filter(p => !p.is_loading);
        scheduledPostsRef.current = updated;
        return updated;
      });
      alert('Failed to generate posts. Please try again.');
    } finally {
      setOnboardingGenerating(false);
      setOnboardingProgress({ current: 0, total: 3 });
    }
  };

  const getWeekStart = (date) => {
    // Always start from today (the date passed in), not Monday
    const d = new Date(date);
    // Create date in local timezone to avoid timezone shifts
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // Set to start of day in local timezone (not UTC) to avoid date shifts
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const getWeekEnd = (date) => {
    const start = getWeekStart(date);
    // Show 14 days from start date (2 weeks) to catch onboarding posts that span weeks
    // Also include past dates (7 days back) to show posted posts
    // Add 13 days forward (0-13 = 14 days total) and set to end of day in local timezone
    const weekEnd = new Date(start.getTime() + 13 * 24 * 60 * 60 * 1000);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  };

  const getDateRangeStart = (date) => {
    // Include past dates (7 days back) to show posted posts
    const start = getWeekStart(date);
    const rangeStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    rangeStart.setHours(0, 0, 0, 0);
    return rangeStart;
  };

  // Memoize week days calculation to prevent unnecessary recalculations
  const weekDays = useMemo(() => {
    const days = [];
    // Start from today (currentWeek), not Monday
    const start = getWeekStart(currentWeek);
    for (let i = 0; i < 7; i++) {
      // Create new date in local timezone to avoid timezone shifts
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      day.setHours(0, 0, 0, 0); // Ensure it's at start of day
      days.push(day);
    }
    console.log('📅 Week days generated:', days.map(d => d.toLocaleDateString()));
    return days;
  }, [currentWeek]);

  const navigateWeek = (direction) => {
    // Navigate by 7 days (one week view)
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const navigateToToday = () => {
    // Reset to today - create fresh date and set to start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentWeek(today);
    console.log('📅 Navigated to today:', today.toLocaleDateString());
  };

  const isToday = (date) => {
    const today = new Date();
    // Compare dates in local timezone to avoid timezone shifts
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  const getPostsForSlot = (day, timeSlot) => {
    return scheduledPosts.filter(post => {
      if (!post.scheduled_for) return false;
      
      // Ensure the scheduled_for is treated as UTC
      let dateStr = post.scheduled_for;
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        dateStr = dateStr + 'Z';
      }
      
      const postDate = new Date(dateStr);
      const postTime = `${postDate.getHours().toString().padStart(2, '0')}:00`;
      return postDate.toDateString() === day.toDateString() && postTime === timeSlot;
    });
  };

  const handleDragStart = (e, post) => {
    // Don't allow dragging posted posts
    if (post.is_posted) {
      e.preventDefault();
      return;
    }
    setDraggedPost(post);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', post.id); // Important for proper drag behavior
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedPost(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (e, day, timeSlot) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ day: day.toISOString(), timeSlot });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e, day, timeSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);

    if (!draggedPost) return;

    const [hours] = timeSlot.split(':');
    const newDate = new Date(day);
    newDate.setHours(parseInt(hours), 0, 0, 0);

    // Check if already in this slot
    const oldDate = new Date(draggedPost.scheduled_for);
    if (oldDate.toISOString() === newDate.toISOString()) {
      setDraggedPost(null);
      return; // Same slot, no need to update
    }

    try {
      // Update the post's scheduled time
      if (draggedPost.source === 'ai') {
        await axios.patch(`${BACKEND_URL}/api/ai-content/posts/${draggedPost.id}/schedule`, {
          scheduled_for: newDate.toISOString()
        });
      } else {
        // For regular scheduled posts, use PATCH and publish_time
        await axios.patch(`${BACKEND_URL}/api/scheduled-posts/${draggedPost.id}`, null, {
          params: {
            publish_time: newDate.toISOString()
          }
        });
      }

      // Update local state - properly replace the old post
      setScheduledPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === draggedPost.id ? { 
            ...p, 
            scheduled_for: newDate.toISOString(),
            publish_time: newDate.toISOString()
          } : p
        )
      );
    } catch (error) {
      console.error('Error updating post schedule:', error);
      alert('Failed to reschedule post. Please try again.');
    }

    setDraggedPost(null);
  };

  const handleDeletePost = async (e, post) => {
    e.stopPropagation();
    
    if (!window.confirm('Delete this scheduled post? This will permanently remove it and free up the time slot.')) {
      return;
    }

    // Check if this is a temporary ID (client-side generated, not saved to DB yet)
    const isTemporaryId = post.id && (post.id.startsWith('scheduled_') || post.id.startsWith('temp_'));
    
    if (isTemporaryId) {
      // Just remove from local state if it's a temporary post
      setScheduledPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
      return;
    }

    try {
      // Determine which endpoint to use based on post source
      let deletePromise;
      
      if (post.source === 'ai') {
        // Delete AI-generated post
        deletePromise = axios.delete(`${BACKEND_URL}/api/ai-content/posts/${post.id}`);
      } else if (post.source === 'scheduled' || !post.source) {
        // Delete scheduled post (default for calendar posts)
        deletePromise = axios.delete(`${BACKEND_URL}/api/scheduled-posts/${post.id}`);
      } else {
        // Fallback: try scheduled posts endpoint
        deletePromise = axios.delete(`${BACKEND_URL}/api/scheduled-posts/${post.id}`);
      }

      await deletePromise;

      // Remove from local state immediately for better UX
      setScheduledPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
      
      // Refresh scheduled posts to ensure consistency
      fetchScheduledPosts();
    } catch (error) {
      // If 404, the post might have already been deleted or doesn't exist
      // Still remove from local state to keep UI in sync
      if (error.response?.status === 404) {
        console.warn('Post not found (may have been already deleted):', post.id);
        setScheduledPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
      } else {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
      }
    }
  };

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState(null);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [selectedPendingPost, setSelectedPendingPost] = useState(null);
  const [customTime, setCustomTime] = useState('');

  const handleSlotClick = async (day, timeSlot) => {
    if (draggedPost) return; // Don't trigger during drag
    
    const [hours, minutes] = timeSlot.split(':');
    const scheduledDate = new Date(day);
    scheduledDate.setHours(parseInt(hours), parseInt(minutes || 0), 0, 0);

    // Fetch pending posts
    try {
      const response = await axios.get(`${BACKEND_URL}/api/ai-content/review-queue?org_id=${orgId}`);
      setPendingPosts(response.data);
      setScheduleSlot({ day, timeSlot, scheduledDate });
      setCustomTime(timeSlot);
      setShowScheduleModal(true);
    } catch (error) {
      console.error('Error fetching pending posts:', error);
      alert('Failed to load pending posts');
    }
  };

  const handleSchedulePendingPost = async () => {
    if (!selectedPendingPost || !customTime) {
      alert('Please select a post and time');
      return;
    }

    try {
      const [hours, minutes] = customTime.split(':');
      
      // Create date in local timezone
      const year = scheduleSlot.day.getFullYear();
      const month = scheduleSlot.day.getMonth();
      const dayOfMonth = scheduleSlot.day.getDate();
      
      // Create a date string in local time and let browser parse it as local
      const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}T${customTime}:00`;
      const scheduledDate = new Date(localDateStr);
      
      console.log('Scheduling post:', {
        localTime: `${localDateStr}`,
        utcTime: scheduledDate.toISOString(),
        timezone: userTimezone
      });

      // Approve and schedule the post
      await axios.post(`${BACKEND_URL}/api/ai-content/posts/${selectedPendingPost}/approve`);
      await axios.patch(`${BACKEND_URL}/api/ai-content/posts/${selectedPendingPost}/schedule`, {
        scheduled_for: scheduledDate.toISOString()
      });

      alert('Post approved and scheduled!');
      setShowScheduleModal(false);
      fetchScheduledPosts(); // Refresh calendar
    } catch (error) {
      console.error('Error scheduling post:', error);
      alert('Failed to schedule post');
    }
  };

  const handleCardClick = (e, post) => {
    e.stopPropagation();
    if (draggedPost) return; // Don't open modal during drag
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleSavePost = async (updatedContent) => {
    try {
      // Get the updated schedule time from inputs
      const dateInput = document.getElementById('post-date-editor');
      const timeInput = document.getElementById('post-time-editor');
      
      let updatedScheduleTime = null;
      if (dateInput && timeInput && dateInput.value && timeInput.value) {
        // Parse date and time components
        const [year, month, day] = dateInput.value.split('-').map(Number);
        const [hours, minutes] = timeInput.value.split(':').map(Number);
        
        // Create date in LOCAL timezone using Date constructor
        const scheduledDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        updatedScheduleTime = scheduledDate.toISOString();
        
        console.log('Rescheduling:', {
          dateInput: dateInput.value,
          timeInput: timeInput.value,
          parsedComponents: { year, month, day, hours, minutes },
          localDate: scheduledDate.toString(),
          utcISO: updatedScheduleTime,
          timezone: userTimezone
        });
      }

      // Update content
      if (selectedPost.source === 'ai') {
        await axios.put(`${BACKEND_URL}/api/ai-content/posts/${selectedPost.id}`, {
          content: updatedContent
        });
      } else {
        // For scheduled posts, we'd need to update the draft
        await axios.put(`${BACKEND_URL}/api/drafts/${selectedPost.draft_id}`, {
          content: { body: updatedContent }
        });
      }

      // Update schedule time if changed
      if (updatedScheduleTime && updatedScheduleTime !== selectedPost.scheduled_for) {
        if (selectedPost.source === 'ai') {
          await axios.patch(`${BACKEND_URL}/api/ai-content/posts/${selectedPost.id}/schedule`, {
            scheduled_for: updatedScheduleTime
          });
        } else {
          await axios.patch(`${BACKEND_URL}/api/scheduled-posts/${selectedPost.id}`, null, {
            params: {
              publish_time: updatedScheduleTime
            }
          });
        }
        console.log(`✓ Post rescheduled to ${new Date(updatedScheduleTime).toLocaleString()}`);
      }
      
      // Update local state
      setScheduledPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === selectedPost.id 
            ? { ...p, content: updatedContent, scheduled_for: updatedScheduleTime || p.scheduled_for } 
            : p
        )
      );
      
      alert('Post updated successfully!');
      setShowPostModal(false);
      setSelectedPost(null);
      fetchScheduledPosts(); // Refresh to get accurate data
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    }
  };

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  
  // Debug: Verify first day is today
  if (weekDays.length > 0) {
    const firstDay = weekDays[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const isFirstDayToday = firstDay.getFullYear() === today.getFullYear() &&
                           firstDay.getMonth() === today.getMonth() &&
                           firstDay.getDate() === today.getDate();
    if (!isFirstDayToday) {
      console.warn('⚠️ First day is not today!', {
        firstDay: firstDay.toLocaleDateString(),
        firstDayTime: firstDay.getTime(),
        today: today.toLocaleDateString(),
        todayTime: today.getTime(),
        currentWeek: currentWeek.toLocaleDateString(),
        currentWeekTime: currentWeek.getTime()
      });
    } else {
      console.log('✅ First day is today:', firstDay.toLocaleDateString());
    }
  }

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground mb-6">Please select an organization to view the calendar.</p>
          <Button 
            onClick={() => navigate('/dashboard/organizations')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
          <h1 className="text-4xl font-serif italic text-foreground mb-2">Calendar</h1>
          <p className="text-muted-foreground">
            {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
              </div>
        <div className="flex items-center gap-3">
          <button
            onClick={navigateToToday}
            className="px-4 py-2 text-sm font-medium bg-secondary hover:bg-accent rounded-full border border-border text-foreground transition-colors"
          >
            Today
          </button>
          <div className="flex items-center bg-secondary rounded-full p-1 border border-border">
              <button
                onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              </button>
          </div>
          <div className="flex items-center bg-secondary rounded-full p-1 border border-border">
                <button
                  onClick={() => setViewMode('calendar')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
            >
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
            >
                  List
                </button>
              </div>
            <Button
              onClick={() => navigate('/dashboard/drafts')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6 border-none"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Post
            </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 bg-card border border-border rounded-[24px] overflow-hidden flex flex-col shadow-2xl">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex-1 overflow-y-auto p-8 calendar-scrollbar">
            {weekDays.map((day, dayIdx) => {
              const dayPosts = scheduledPosts.filter(post => {
                if (!post || !post.scheduled_for) return false;
                try {
                  let dateStr = post.scheduled_for;
                  if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
                    dateStr = dateStr + 'Z';
                  }
                  const postDate = new Date(dateStr);
                  if (isNaN(postDate.getTime())) return false;
                  return postDate.toDateString() === day.toDateString();
                } catch (error) {
                  console.error('Error filtering post by date:', error, post);
                  return false;
                }
              }).sort((a, b) => {
                try {
                  const dateA = new Date(a.scheduled_for);
                  const dateB = new Date(b.scheduled_for);
                  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                  return dateA - dateB;
                } catch (error) {
                  return 0;
                }
              });

              const today = isToday(day);

              return (
                <div key={dayIdx} className="mb-10 last:mb-0">
                  <div className={`flex items-center gap-4 mb-6 pb-4 border-b ${today ? 'border-primary' : 'border-border'}`}>
                    <div className={`text-4xl font-serif italic ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.getDate()}
                    </div>
                    <div>
                      <div className={`text-lg font-medium ${today ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {day.toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div className="text-sm text-muted-foreground/60">
                        {day.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    {today && (
                      <span className="ml-auto px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20 tracking-wide">
                        TODAY
                      </span>
                    )}
                  </div>

                  {dayPosts.length === 0 ? (
                    <div className="text-center py-12 bg-muted rounded-2xl border border-border border-dashed text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-light tracking-wide">NO POSTS SCHEDULED</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dayPosts.map((post) => (
                          <div
                            key={post.id}
                            onClick={(e) => handleCardClick(e, post)}
                          className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                                  <Linkedin className="w-4 h-4 text-primary-foreground" />
                                  </div>
                                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                    {userTimezone && post.scheduled_for ? getTimeInUserTimezone(post.scheduled_for, userTimezone) : '--:--'}
                                  </span>
                                </div>
                                {post.is_posted && (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 tracking-wider">
                                  <CheckCircle className="w-3 h-3" />
                                  PUBLISHED
                                </span>
                                )}
                              </div>

                            <div className="flex gap-6">
                              {post.image_url && (
                                <div className="w-32 h-32 bg-muted rounded-xl overflow-hidden flex-shrink-0 border border-border">
                                  <img
                                    src={post.image_url}
                                    alt=""
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                <p className="text-base text-foreground line-clamp-3 mb-4 font-light leading-relaxed">
                                  {post.content?.substring(0, 160) || post.body?.substring(0, 160) || 'Untitled Post'}...
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                {post.campaign_id && (
                                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                    {post.profile_type === 'company' || post.profile_type === 'organization'
                                        ? <><span className="text-lg">🏢</span> {post.author_name || 'Company'}</>
                                        : <><span className="text-lg">👤</span> Personal</>}
                                    </span>
                                )}
                                <button
                                  onClick={(e) => handleDeletePost(e, post)}
                                    className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 calendar-scrollbar">
            <div className="grid grid-cols-7 gap-2 w-full" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {weekDays.map((day, dayIdx) => {
              const today = isToday(day);
                // Get all posts for this day, sorted by time
                const dayPosts = scheduledPosts.filter(post => {
                  if (!post || !post.scheduled_for) return false;
                  try {
                    let dateStr = post.scheduled_for;
                    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
                      dateStr = dateStr + 'Z';
                    }
                    const postDate = new Date(dateStr);
                    if (isNaN(postDate.getTime())) return false;
                    return postDate.toDateString() === day.toDateString();
                  } catch (error) {
                    console.error('Error filtering post by date:', error, post);
                    return false;
                  }
                }).sort((a, b) => {
                  try {
                    const dateA = new Date(a.scheduled_for);
                    const dateB = new Date(b.scheduled_for);
                    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                    return dateA - dateB;
                  } catch (error) {
                    return 0;
                  }
                });

              return (
                  <div key={dayIdx} className="flex flex-col">
                    {/* Day Header */}
                    <div 
                      className={`sticky top-0 z-10 mb-3 pb-3 border-b rounded-xl px-2 py-1.5 ${today ? 'bg-primary/5 border-primary' : 'bg-card border-border'}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className={`text-[10px] font-medium uppercase tracking-wider ${
                          today ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span 
                            className={`text-xl font-serif italic ${today ? 'text-primary' : 'text-foreground'}`}
                          >
                            {day.getDate()}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {day.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>
                  {today && (
                          <span 
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-fit tracking-wider bg-primary text-primary-foreground"
                          >
                        TODAY
                      </span>
                    )}
                  </div>
                </div>

                    {/* Posts Stack */}
                    <div className="flex flex-col gap-2">
                      {dayPosts.length === 0 ? (
                        <div 
                          className="text-center py-8 rounded-xl border border-dashed bg-muted text-muted-foreground border-border"
                        >
                          <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                          <p className="text-xs font-light tracking-wide">
                            NO POSTS
                          </p>
              </div>
                      ) : (
                        dayPosts.map((post) => {
                          if (!post || !post.id) return null;
                          
                          try {
                            const postDate = new Date(post.scheduled_for);
                            const timeString = userTimezone && post.scheduled_for 
                              ? getTimeInUserTimezone(post.scheduled_for, userTimezone)
                              : postDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                            return (
                              <div
                                key={post.id}
                                draggable={!post.is_posted}
                                onDragStart={(e) => handleDragStart(e, post)}
                                onDragEnd={handleDragEnd}
                                className="w-full"
                              >
                                <CalendarPostCard
                                  post={post}
                                  timeString={timeString}
                                  onCardClick={(e) => handleCardClick(e, post)}
                                  onDelete={(e) => handleDeletePost(e, post)}
                                  onEdit={(e) => handleCardClick(e, post)}
                                  isDragging={draggedPost?.id === post.id}
                                />
                              </div>
                            );
                          } catch (error) {
                            console.error('Error rendering post card:', error, post);
                            return null;
                          }
                        })
                      )}
                                  </div>
                  </div>
                );
              })}
            </div>
          </div>
                                  )}
                                </div>
                              
      {/* Post Edit Modal */}
      {showPostModal && selectedPost && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
          onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
        >
          <div 
            className="rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
            style={{
              backgroundColor: designTokens.colors.background.layer2,
              border: `1px solid ${designTokens.colors.border.default}`,
              borderRadius: designTokens.radius.xl,
              boxShadow: designTokens.shadow.floating
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column - Post Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div 
                className="px-8 py-6 border-b flex items-center justify-between"
                style={{ borderColor: designTokens.colors.border.subtle }}
              >
                <div>
                  <h2 className="text-2xl font-serif italic mb-1" style={{ color: designTokens.colors.text.primary }}>
                    Edit Post
                  </h2>
                  <p className="text-sm" style={{ color: designTokens.colors.text.secondary }}>
                    {selectedPost.scheduled_for ? (() => {
                      let dateStr = selectedPost.scheduled_for;
                      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                        dateStr = dateStr + 'Z';
                      }
                      return new Date(dateStr).toLocaleString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      });
                    })() : 'Not scheduled'}
                  </p>
                                </div>
                <button
                  onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
                  style={{ 
                    color: designTokens.colors.text.secondary,
                    borderRadius: designTokens.radius.full
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = designTokens.colors.background.input}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Left Column */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* Content Editor */}
                <div>
                  <label className="text-sm font-semibold mb-3 block uppercase tracking-wider" style={{ color: designTokens.colors.text.secondary }}>
                    Post Content
                  </label>
                  <textarea
                    id="post-content-editor"
                    defaultValue={selectedPost.content || selectedPost.body || ''}
                    className="w-full min-h-[300px] p-5 rounded-xl resize-none"
                    style={{
                      backgroundColor: designTokens.colors.background.input,
                      color: designTokens.colors.text.primary,
                      border: `1px solid ${designTokens.colors.border.default}`,
                      borderRadius: designTokens.radius.lg,
                      fontFamily: designTokens.typography.fontFamily.sans,
                      fontSize: designTokens.typography.fontSize.base,
                      lineHeight: '1.6'
                    }}
                    placeholder="Write your post content here..."
                  />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs" style={{ color: designTokens.colors.text.tertiary }}>
                      Character count: {(selectedPost.content || selectedPost.body || '').length}
                    </p>
                  </div>
                </div>

                {/* Schedule Time Editor */}
                <div 
                  className="p-6 rounded-xl border"
                  style={{
                    backgroundColor: designTokens.colors.background.layer1,
                    borderColor: designTokens.colors.border.default,
                    borderRadius: designTokens.radius.lg
                  }}
                >
                  <label className="text-sm font-semibold mb-4 block flex items-center gap-2 uppercase tracking-wider" style={{ color: designTokens.colors.text.secondary }}>
                    <Clock className="w-4 h-4" />
                    Reschedule Post
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs mb-2 block font-medium uppercase tracking-wide" style={{ color: designTokens.colors.text.tertiary }}>
                        Date
                      </label>
                      <input
                        type="date"
                        id="post-date-editor"
                        defaultValue={selectedPost.scheduled_for ? (() => {
                          let dateStr = selectedPost.scheduled_for;
                          if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                            dateStr = dateStr + 'Z';
                          }
                          const d = new Date(dateStr);
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        })() : ''}
                        className="w-full px-4 py-3 rounded-lg"
                        style={{
                          backgroundColor: designTokens.colors.background.input,
                          color: designTokens.colors.text.primary,
                          border: `1px solid ${designTokens.colors.border.default}`,
                          borderRadius: designTokens.radius.md
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-2 block font-medium uppercase tracking-wide" style={{ color: designTokens.colors.text.tertiary }}>
                        Time
                      </label>
                      <input
                        type="time"
                        id="post-time-editor"
                        defaultValue={selectedPost.scheduled_for ? (() => {
                          let dateStr = selectedPost.scheduled_for;
                          if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                            dateStr = dateStr + 'Z';
                          }
                          const d = new Date(dateStr);
                          const hours = String(d.getHours()).padStart(2, '0');
                          const minutes = String(d.getMinutes()).padStart(2, '0');
                          return `${hours}:${minutes}`;
                        })() : ''}
                        className="w-full px-4 py-3 rounded-lg"
                        style={{
                          backgroundColor: designTokens.colors.background.input,
                          color: designTokens.colors.text.primary,
                          border: `1px solid ${designTokens.colors.border.default}`,
                          borderRadius: designTokens.radius.md
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div 
                className="px-8 py-6 border-t flex items-center justify-between"
                style={{ borderColor: designTokens.colors.border.subtle }}
              >
                                <button
                  onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
                  className="px-6 py-2.5 rounded-full transition font-medium"
                  style={{
                    color: designTokens.colors.text.secondary,
                    borderRadius: designTokens.radius.full
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = designTokens.colors.background.input}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this post?')) {
                        handleDeletePost({stopPropagation: () => {}}, selectedPost);
                        setShowPostModal(false);
                        setSelectedPost(null);
                      }
                    }}
                    className="px-6 py-2.5 rounded-full transition font-medium"
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      borderRadius: designTokens.radius.full
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      const content = document.getElementById('post-content-editor')?.value || '';
                      handleSavePost(content);
                    }}
                    className="px-8 py-3 rounded-full transition font-medium"
                    style={{
                      backgroundColor: designTokens.colors.accent.lime,
                      color: designTokens.colors.text.inverse,
                      borderRadius: designTokens.radius.full
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = designTokens.colors.accent.limeHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = designTokens.colors.accent.lime;
                    }}
                  >
                    Save Changes
                                </button>
                              </div>
                            </div>
                          </div>

            {/* Right Column - Image Preview */}
            {selectedPost.image_url && (
              <div 
                className="w-full md:w-96 flex-shrink-0 border-l flex flex-col"
                style={{ 
                  borderColor: designTokens.colors.border.subtle,
                  backgroundColor: designTokens.colors.background.layer1
                }}
              >
                <div className="p-6 border-b" style={{ borderColor: designTokens.colors.border.subtle }}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: designTokens.colors.text.secondary }}>
                    Image Preview
                  </h3>
            </div>
                <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center relative group">
                  <div className="w-full relative">
                    <img
                      src={selectedPost.image_url}
                      alt="Post"
                      className="w-full h-auto object-contain rounded-xl cursor-pointer"
                      style={{
                        borderRadius: designTokens.radius.lg,
                        boxShadow: designTokens.shadow.card
                      }}
                      onClick={() => {
                        setSelectedImageForEdit(selectedPost.image_url);
                        setShowTextOverlayModal(true);
                      }}
                    />
                    {/* Edit Image Button - appears on hover */}
                    <button
                      onClick={() => {
                        setSelectedImageForEdit(selectedPost.image_url);
                        setShowTextOverlayModal(true);
                      }}
                      className="absolute bottom-3 right-3 bg-background/80 hover:bg-background/90 backdrop-blur-md text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 border border-border"
                      style={{
                        borderRadius: designTokens.radius.md
                      }}
                    >
                      <Edit className="w-3 h-3" />
                      Edit Image
                    </button>
                  </div>
        </div>
        </div>
        )}
      </div>
        </div>
      )}
      
      {/* Text Overlay Editing Modal */}
      <TextOverlayModal
        isOpen={showTextOverlayModal}
        onClose={() => setShowTextOverlayModal(false)}
        imageUrl={selectedImageForEdit}
        initialElements={imageOverlays[selectedImageForEdit] || []}
        onApply={(newImageUrl, elements) => {
          const oldImageUrl = selectedImageForEdit;
          setSelectedImageForEdit(newImageUrl);
          // Store overlay data for new image, remove old key
          setImageOverlays(prev => {
            const newOverlays = {...prev};
            delete newOverlays[oldImageUrl];
            newOverlays[newImageUrl] = elements || [];
            return newOverlays;
          });
        }}
      />
    </div>
  );
};

export default CalendarView;
