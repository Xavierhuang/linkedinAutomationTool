import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Linkedin, Loader2, X, Clock, Send, CheckCircle, ExternalLink, List, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { getUserTimezone, convertUTCToUserTime, getTimeInUserTimezone } from '@/utils/timezone';
import TextOverlayModal from './TextOverlayModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CalendarView = ({ orgId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [draggedPost, setDraggedPost] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    if (orgId) {
      fetchScheduledPosts();
    }
  }, [orgId, currentWeek]);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = getWeekEnd(currentWeek);
      
      // Fetch scheduled posts (including posted ones), approved AI content, and posted posts
      const [scheduledRes, aiPostsRes, postedRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/scheduled-posts?org_id=${orgId}&range_start=${weekStart.toISOString()}&range_end=${weekEnd.toISOString()}`),
        axios.get(`${BACKEND_URL}/api/ai-content/approved-posts?org_id=${orgId}`),
        axios.get(`${BACKEND_URL}/api/posts?org_id=${orgId}&range_start=${weekStart.toISOString()}&range_end=${weekEnd.toISOString()}`)
      ]);

      // Create a map of posted posts by scheduled_post_id for quick lookup
      const postedMap = {};
      postedRes.data.forEach(post => {
        if (post.scheduled_post_id) {
          postedMap[post.scheduled_post_id] = post;
        }
      });

      const combined = [
        // Map scheduled posts (normalize publish_time -> scheduled_for, extract content from draft)
        ...scheduledRes.data.map(p => {
          const postedInfo = postedMap[p.id];
          return {
            ...p,
            source: 'scheduled',
            scheduled_for: p.publish_time, // Map publish_time to scheduled_for
            content: p.draft_preview?.content?.body || p.content || '',
            image_url: p.draft_preview?.assets?.[0]?.url || p.draft_preview?.content?.image_url || null,
            is_posted: p.status === 'posted' || !!postedInfo,
            platform_url: postedInfo?.platform_url || null,
            posted_at: postedInfo?.posted_at || null,
            // Extract LinkedIn author info from draft_preview
            profile_type: p.draft_preview?.linkedin_author_type || 'personal',
            linkedin_author_id: p.draft_preview?.linkedin_author_id || null,
            campaign_id: p.campaign_id || p.draft_preview?.campaign_id || null
          };
        }),
        // AI posts already have scheduled_for and content
        ...aiPostsRes.data.map(p => ({
          ...p,
          source: 'ai',
          scheduled_for: p.scheduled_for || null,
          is_posted: false // AI posts don't have posted status yet
        }))
      ];

      // Fetch campaigns and enrich posts with author names
      const uniqueCampaignIds = [...new Set(combined.filter(p => p.campaign_id).map(p => p.campaign_id))];
      const campaigns = {};
      
      if (uniqueCampaignIds.length > 0) {
        try {
          const campaignsRes = await axios.get(`${BACKEND_URL}/api/campaigns?org_id=${orgId}`);
          campaignsRes.data.forEach(campaign => {
            campaigns[campaign.id] = campaign;
          });
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

      console.log('📅 Calendar Data:', {
        weekRange: `${weekStart.toISOString()} to ${weekEnd.toISOString()}`,
        scheduledPosts: scheduledRes.data.length,
        aiPosts: aiPostsRes.data.length,
        postedPosts: postedRes.data.length,
        total: enrichedPosts.length,
        campaigns: uniqueCampaignIds.length,
        posts: enrichedPosts.map(p => ({
          id: p.id,
          scheduled_for: p.scheduled_for,
          is_posted: p.is_posted,
          campaign_id: p.campaign_id,
          profile_type: p.profile_type,
          author_name: p.author_name,
          content_preview: p.content?.substring(0, 30)
        }))
      });

      setScheduledPosts(enrichedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  };

  const getWeekEnd = (date) => {
    const start = getWeekStart(date);
    return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  };

  const getWeekDays = () => {
    const days = [];
    const start = getWeekStart(currentWeek);
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateWeek = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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
    
    if (!window.confirm('Delete this scheduled post?')) {
      return;
    }

    try {
      if (post.source === 'ai') {
        await axios.delete(`${BACKEND_URL}/api/ai-content/posts/${post.id}`);
      } else {
        await axios.delete(`${BACKEND_URL}/api/scheduled-posts/${post.id}`);
      }

      // Remove from local state
      setScheduledPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
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

  const weekDays = getWeekDays();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 text-sm mb-6">Please select an organization to view the calendar.</p>
          <Button 
            onClick={() => navigate('/dashboard/organizations')}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  // Calculate stats from scheduled posts
  const stats = {
    completed: scheduledPosts.filter(p => p.is_posted).length,
    total: scheduledPosts.length,
    inProgress: scheduledPosts.filter(p => !p.is_posted && new Date(p.scheduled_for) > new Date()).length,
    outOfSchedule: scheduledPosts.filter(p => !p.is_posted && new Date(p.scheduled_for) < new Date()).length
  };

  // Calculate posting frequency per day of the week (Mon-Fri) for live chart
  const getPostsPerDay = () => {
    const weekStart = getWeekStart(currentWeek);
    const postsPerDay = [0, 0, 0, 0, 0]; // Mon, Tue, Wed, Thu, Fri
    
    scheduledPosts.forEach(post => {
      const postDate = new Date(post.scheduled_for);
      const dayOfWeek = postDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Map to Mon-Fri (1-5) and convert to 0-4 index
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        postsPerDay[dayOfWeek - 1]++;
      }
    });
    
    return postsPerDay;
  };

  const postsPerDay = getPostsPerDay();
  const maxPosts = Math.max(...postsPerDay, 1); // Avoid division by zero

  return (
    <div className="h-full flex" style={{ 
      backgroundColor: '#E8E5F5', 
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden',
      width: '100%'
    }}>
      {/* Left Content Sidebar - Desktop Only (hide on mobile and tablet) */}
      {!isMobile && !isTablet && (
        <div style={{ 
          width: '240px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #F3F4F6',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
            {/* Welcome Section - Compact */}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ 
                  fontSize: '10px',
                  color: '#9CA3AF',
                  marginBottom: '2px'
                }}>Hello</p>
                <h2 style={{ 
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  margin: 0
                }}>{user?.email?.split('@')[0] || 'User'}</h2>
              </div>
              <div style={{ 
                width: '36px',
                height: '36px',
                borderRadius: '9999px',
                backgroundColor: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700
              }}>
                {(user?.email?.[0] || 'U').toUpperCase()}
              </div>
            </div>

            {/* Stats Cards - Compact */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                padding: '10px',
                backgroundColor: '#FEFEFE',
                borderRadius: '8px',
                border: '1px solid #F3F4F6',
                borderLeft: '2px solid #10B981'
              }}>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  lineHeight: 1
                }}>{stats.completed}</div>
                <div style={{ 
                  fontSize: '10px',
                  color: '#6B7280',
                  marginTop: '3px'
                }}>Completed</div>
              </div>
              <div style={{ 
                padding: '10px',
                backgroundColor: '#FEFEFE',
                borderRadius: '8px',
                border: '1px solid #F3F4F6',
                borderLeft: '2px solid #6366F1'
              }}>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  lineHeight: 1
                }}>{stats.total}</div>
                <div style={{ 
                  fontSize: '10px',
                  color: '#6B7280',
                  marginTop: '3px'
                }}>Total Post</div>
              </div>
              <div style={{ 
                padding: '10px',
                backgroundColor: '#FEFEFE',
                borderRadius: '8px',
                border: '1px solid #F3F4F6',
                borderLeft: '2px solid #F59E0B'
              }}>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  lineHeight: 1
                }}>{stats.inProgress}</div>
                <div style={{ 
                  fontSize: '10px',
                  color: '#6B7280',
                  marginTop: '3px'
                }}>In progress</div>
              </div>
              <div style={{ 
                padding: '10px',
                backgroundColor: '#FEFEFE',
                borderRadius: '8px',
                border: '1px solid #F3F4F6',
                borderLeft: '2px solid #EF4444'
              }}>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  lineHeight: 1
                }}>{stats.outOfSchedule}</div>
                <div style={{ 
                  fontSize: '10px',
                  color: '#6B7280',
                  marginTop: '3px'
                }}>Out of scheduled</div>
              </div>
            </div>

            {/* Mini Calendar - Compact */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div style={{ 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}>{currentWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button style={{ 
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    const newDate = new Date(currentWeek);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setCurrentWeek(newDate);
                  }}>
                    <ChevronLeft style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                  </button>
                  <button style={{ 
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    const newDate = new Date(currentWeek);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setCurrentWeek(newDate);
                  }}>
                    <ChevronRight style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                  </button>
                </div>
              </div>
              
              {/* Calendar Grid - Compact */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px'
              }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                  <div key={day} style={{ 
                    fontSize: '9px',
                    fontWeight: 600,
                    color: '#9CA3AF',
                    textAlign: 'center',
                    padding: '4px 0'
                  }}>{day}</div>
                ))}
                {(() => {
                  const year = currentWeek.getFullYear();
                  const month = currentWeek.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days = [];
                  const startDay = firstDay === 0 ? 6 : firstDay - 1;
                  
                  for (let i = 0; i < startDay; i++) {
                    days.push(<div key={`empty-${i}`} />);
                  }
                  
                  const today = new Date();
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const isToday = date.toDateString() === today.toDateString();
                    days.push(
                      <div key={day} style={{ 
                        aspectRatio: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? '#FFFFFF' : '#1A1A1A',
                        backgroundColor: isToday ? '#6366F1' : 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isToday) e.currentTarget.style.backgroundColor = '#F9FAFB';
                      }}
                      onMouseLeave={(e) => {
                        if (!isToday) e.currentTarget.style.backgroundColor = 'transparent';
                      }}>
                        {day}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>

            {/* Post Stats Line Graph - LIVE DATA */}
            <div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div style={{ 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}>Post Frequency</div>
                <div style={{ 
                  fontSize: '9px',
                  color: '#9CA3AF',
                  fontWeight: 600
                }}>This Week</div>
              </div>
              <div style={{ 
                height: '110px',
                position: 'relative',
                backgroundColor: '#F9FAFB',
                borderRadius: '6px',
                padding: '20px 16px 10px 16px'
              }}>
                {/* Line graph with viewBox */}
                <svg 
                  viewBox="0 0 400 70"
                  width="100%" 
                  height="70" 
                  style={{ display: 'block' }}
                  preserveAspectRatio="none"
                >
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((percent, idx) => {
                    const y = 70 - (percent / 100 * 70);
                    return (
                      <line
                        key={idx}
                        x1="0"
                        y1={y}
                        x2="400"
                        y2={y}
                        stroke="#E5E7EB"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  
                  {/* Create path for line */}
                  <path
                    d={(() => {
                      // Calculate positions in viewBox coordinates (0-400 for x, 0-70 for y)
                      const points = postsPerDay.map((count, i) => {
                        const x = (i / 4) * 400; // Spread across 400 units
                        const heightPercentage = maxPosts > 0 ? (count / maxPosts) : 0;
                        const y = 70 - (heightPercentage * 70); // Invert Y (SVG coords)
                        return { x, y };
                      });
                      
                      // Build SVG path with absolute coordinates
                      let pathData = `M ${points[0].x} ${points[0].y}`;
                      for (let i = 1; i < points.length; i++) {
                        pathData += ` L ${points[i].x} ${points[i].y}`;
                      }
                      return pathData;
                    })()}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ 
                      filter: 'drop-shadow(0px 2px 4px rgba(139, 92, 246, 0.3))'
                    }}
                  />
                  
                  {/* Data points */}
                  {postsPerDay.map((count, i) => {
                    const x = (i / 4) * 400;
                    const heightPercentage = maxPosts > 0 ? (count / maxPosts) : 0;
                    const y = 70 - (heightPercentage * 70);
                    
                    return (
                      <g key={i}>
                        {/* Point circle */}
                        <circle
                          cx={x}
                          cy={y}
                          r={count > 0 ? "5" : "3"}
                          fill={count > 0 ? "#8B5CF6" : "#E5E7EB"}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: 'pointer' }}
                        >
                          <title>{`${count} post${count !== 1 ? 's' : ''} on ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}`}</title>
                        </circle>
                        
                        {/* Value label */}
                        {count > 0 && (
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fill="#8B5CF6"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                
                {/* Day labels below */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  paddingLeft: '2px',
                  paddingRight: '2px'
                }}>
                  {['M', 'T', 'W', 'T', 'F'].map((day, i) => (
                    <div key={i} style={{ 
                      fontSize: '9px',
                      fontWeight: 600,
                      color: postsPerDay[i] > 0 ? '#8B5CF6' : '#6B7280',
                      textAlign: 'center',
                      minWidth: '20px'
                    }}>
                      {day}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Total posts this week */}
              <div style={{
                marginTop: '8px',
                fontSize: '10px',
                color: '#6B7280',
                textAlign: 'center'
              }}>
                <span style={{ fontWeight: 600, color: '#8B5CF6' }}>
                  {postsPerDay.reduce((a, b) => a + b, 0)}
                </span> posts this week
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col" style={{ minWidth: 0, overflow: 'hidden', height: '100vh' }}>
      {/* Header - Responsive */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        borderBottom: '1px solid #F3F4F6',
        padding: isMobile ? '12px 16px' : '12px 20px',
        flexShrink: 0
      }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          {/* Left: Date Range & Navigation */}
          <div className="flex items-center justify-between md:justify-start gap-3 md:gap-4">
            <h1 style={{ 
              fontSize: isMobile ? '16px' : '24px', 
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              lineHeight: 1.2
            }}>
              {isMobile 
                ? weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' - ' + weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              }
            </h1>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => navigateWeek(-1)}
                style={{
                  width: isMobile ? '32px' : '28px',
                  height: isMobile ? '32px' : '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              >
                <ChevronLeft style={{ width: '14px', height: '14px', color: '#6B7280' }} />
              </button>
              <button
                onClick={() => navigateWeek(1)}
                style={{
                  width: isMobile ? '32px' : '28px',
                  height: isMobile ? '32px' : '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              >
                <ChevronRight style={{ width: '14px', height: '14px', color: '#6B7280' }} />
              </button>
            </div>
          </div>

          {/* Right: View Toggle & Create Button */}
          <div className="flex items-center gap-2 md:gap-3" style={{ gap: isMobile ? '8px' : '12px' }}>
            {/* View Toggle - Hidden on mobile (auto list view) */}
            {!isMobile && (
              <div style={{ 
                display: 'flex', 
                backgroundColor: '#FEFEFE', 
                borderRadius: '8px', 
                padding: '4px',
                border: '1px solid #F3F4F6'
              }}>
                <button
                  onClick={() => setViewMode('calendar')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: viewMode === 'calendar' ? '#EEF2FF' : 'transparent',
                    color: viewMode === 'calendar' ? '#6366F1' : '#6B7280'
                  }}
                >
                  <CalendarIcon style={{ width: '16px', height: '16px' }} />
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: viewMode === 'list' ? '#EEF2FF' : 'transparent',
                    color: viewMode === 'list' ? '#6366F1' : '#6B7280'
                  }}
                >
                  <List style={{ width: '16px', height: '16px' }} />
                  List
                </button>
              </div>
            )}
            
            <Button
              onClick={() => navigate('/dashboard/drafts')}
              style={{
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: isMobile ? '36px' : '40px',
                padding: isMobile ? '0 12px' : '0 16px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area - Calendar or List View */}
      <div className="flex-1" style={{ backgroundColor: '#F8F9FB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 style={{ width: '32px', height: '32px', color: '#9CA3AF' }} className="animate-spin" />
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW - Mobile Friendly */
          <div className="max-w-7xl mx-auto" style={{ padding: '24px 16px', overflowY: 'auto', flex: 1 }}>
            {weekDays.map((day, dayIdx) => {
              const dayPosts = scheduledPosts.filter(post => {
                if (!post.scheduled_for) return false;
                let dateStr = post.scheduled_for;
                if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                  dateStr = dateStr + 'Z';
                }
                const postDate = new Date(dateStr);
                return postDate.toDateString() === day.toDateString();
              }).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));

              const today = isToday(day);

              return (
                <div key={dayIdx} style={{ marginBottom: '24px' }}>
                  {/* Day Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    marginBottom: '16px', 
                    paddingBottom: '8px',
                    borderBottom: `2px solid ${today ? '#6366F1' : '#E5E7EB'}`
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      fontWeight: 700,
                      color: today ? '#6366F1' : '#1A1A1A',
                      lineHeight: 1.2
                    }}>
                      {day.getDate()}
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 600,
                        color: today ? '#6366F1' : '#1A1A1A'
                      }}>
                        {day.toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div style={{ 
                        fontSize: '14px',
                        color: '#6B7280'
                      }}>
                        {day.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    {today && (
                      <div style={{
                        marginLeft: 'auto',
                        backgroundColor: '#6366F1',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        letterSpacing: '0.05em'
                      }}>
                        TODAY
                      </div>
                    )}
                  </div>

                  {/* Posts for this day */}
                  {dayPosts.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '32px 0',
                      color: '#9CA3AF'
                    }}>
                      <Clock style={{ 
                        width: '32px', 
                        height: '32px', 
                        margin: '0 auto 8px',
                        opacity: 0.5
                      }} />
                      <p style={{ fontSize: '14px' }}>No posts scheduled</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dayPosts.map((post) => {
                        return (
                          <div
                            key={post.id}
                            onClick={(e) => handleCardClick(e, post)}
                            style={{ 
                              backgroundColor: '#FFFFFF',
                              borderRadius: '12px',
                              border: '1px solid #E5E7EB',
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              transition: 'all 0.2s ease',
                              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = '#D1D5DB';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.borderColor = '#E5E7EB';
                            }}
                          >
                            <div style={{ padding: '12px' }}>
                              {/* Header: Platform Icon + Time */}
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ 
                                    width: '20px', 
                                    height: '20px', 
                                    backgroundColor: '#0A66C2',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <Linkedin style={{ width: '12px', height: '12px', color: '#FFFFFF' }} />
                                  </div>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    fontWeight: 500,
                                    color: '#9CA3AF',
                                    letterSpacing: '0.2px'
                                  }}>
                                    {userTimezone && post.scheduled_for ? getTimeInUserTimezone(post.scheduled_for, userTimezone) : '--:--'}
                                  </span>
                                </div>
                                {post.is_posted && (
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    backgroundColor: '#ECFDF5',
                                    color: '#065F46',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 600
                                  }}>
                                    <CheckCircle style={{ width: '10px', height: '10px' }} />
                                    Published
                                  </div>
                                )}
                              </div>

                              {/* Image Preview */}
                              {post.image_url && (
                                <div style={{ 
                                  marginBottom: '8px',
                                  backgroundColor: '#F9FAFB',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  height: '120px'
                                }}>
                                  <img
                                    src={post.image_url}
                                    alt=""
                                    style={{ 
                                      width: '100%', 
                                      height: '100%', 
                                      objectFit: 'cover'
                                    }}
                                  />
                                </div>
                              )}
                              
                              {/* Post Content */}
                              <p style={{ 
                                fontSize: '14px',
                                lineHeight: 1.5,
                                  fontWeight: 400,
                                color: '#1A1A1A',
                                marginBottom: '8px',
                                overflow: 'hidden',
                                  display: '-webkit-box',
                                WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical'
                              }}>
                                {post.content?.substring(0, 80) || post.body?.substring(0, 80) || 'Untitled Post'}...
                              </p>
                              
                              {/* Footer: Author Badge + Delete Button */}
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '8px',
                                marginTop: 'auto'
                              }}>
                                {post.campaign_id && (
                                  <div style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: '#6B7280'
                                  }}>
                                    {post.profile_type === 'company' || post.profile_type === 'organization'
                                      ? `🏢 ${post.author_name || 'Company'}`
                                      : '👤 Personal'}
                                  </div>
                                )}
                                <button
                                  onClick={(e) => handleDeletePost(e, post)}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: '#EF4444',
                                    borderRadius: '9999px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease',
                                    flexShrink: 0,
                                    marginLeft: 'auto'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                                  title="Delete post"
                                >
                                  <X style={{ width: '12px', height: '12px', color: '#FFFFFF' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* CALENDAR VIEW - Desktop & Tablet */
          <div style={{ 
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
          }}>
          <div className="grid" style={{ 
            gridTemplateColumns: isTablet ? '40px repeat(7, minmax(120px, 1fr))' : '50px repeat(7, 1fr)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            height: 'fit-content',
            width: '100%'
          }}>
            {/* Time Column Header */}
            <div style={{ 
              backgroundColor: '#FFFFFF', 
              borderBottom: '1px solid #F3F4F6',
              borderRight: '1px solid #F3F4F6',
              height: '60px'
            }} />

          {/* Day Headers */}
            {weekDays.map((day, idx) => {
              const today = isToday(day);
              return (
              <div
                key={idx}
                  style={{ 
                    backgroundColor: '#FFFFFF',
                    borderBottom: '1px solid #F3F4F6',
                    borderRight: '1px solid #F3F4F6',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    height: '60px'
                  }}
                >
                  {today && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#6366F1',
                      color: '#FFFFFF',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)'
                    }}>
                      Today
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'baseline', 
                    gap: '8px',
                    marginTop: today ? '16px' : '0'
                  }}>
                    <div style={{ 
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                    <div style={{ 
                      fontSize: '24px',
                      fontWeight: 700,
                      color: today ? '#6366F1' : '#1A1A1A',
                      lineHeight: 1
                    }}>
                    {day.getDate()}
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Time Slots */}
            {timeSlots.map((timeSlot, timeIdx) => (
              <React.Fragment key={timeIdx}>
              {/* Time Label */}
                <div style={{ 
                  backgroundColor: '#FFFFFF',
                  borderRight: '1px solid #F3F4F6',
                  borderBottom: '1px solid #F3F4F6',
                  padding: '4px 4px',
                  textAlign: 'right',
                  fontSize: '10px',
                  color: '#9CA3AF',
                  height: `${timeSlotHeight}px`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end'
                }}>
                  {timeSlot}
              </div>
              
              {/* Day Columns */}
                {weekDays.map((day, dayIdx) => {
                  const posts = getPostsForSlot(day, timeSlot);
                  const isOver = dragOverSlot?.day === day.toISOString() && dragOverSlot?.timeSlot === timeSlot;
                  const isEmpty = posts.length === 0;

                return (
                  <div
                      key={`${dayIdx}-${timeIdx}`}
                      style={{
                        height: `${timeSlotHeight}px`,
                        backgroundColor: isOver ? 'rgba(99, 102, 241, 0.1)' : '#FFFFFF',
                        borderRight: '1px solid #F3F4F6',
                        borderBottom: '1px solid #F3F4F6',
                        borderColor: isOver ? '#6366F1' : '#F3F4F6',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        cursor: isEmpty ? 'pointer' : 'default'
                      }}
                      onDragOver={(e) => handleDragOver(e, day, timeSlot)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, timeSlot)}
                      onClick={() => isEmpty && handleSlotClick(day, timeSlot)}
                      onMouseEnter={(e) => {
                        if (isEmpty) e.currentTarget.style.backgroundColor = '#F9FAFB';
                      }}
                      onMouseLeave={(e) => {
                        if (isEmpty && !isOver) e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      {posts.map((post) => {
                        return (
                          <div
                            key={post.id}
                            draggable={!post.is_posted}
                            onDragStart={(e) => handleDragStart(e, post)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handleCardClick(e, post)}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              right: '8px',
                              bottom: '8px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E5E7EB',
                              borderRadius: '12px',
                              boxShadow: draggedPost?.id === post.id ? '0 20px 25px rgba(0, 0, 0, 0.15)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
                              transform: draggedPost?.id === post.id ? 'scale(1.05)' : 'scale(1)',
                              opacity: draggedPost?.id === post.id ? 0.8 : 1,
                              zIndex: draggedPost?.id === post.id ? 1000 : 2,
                              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                              transition: 'all 0.2s ease',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              cursor: post.is_posted ? 'pointer' : 'grab'
                            }}
                          >
                            {/* Card Header with Platform & Time */}
                            <div style={{ 
                              padding: isTablet ? '5px 6px' : '6px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid #F3F4F6',
                              backgroundColor: '#F9FAFB',
                              flexShrink: 0
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: isTablet ? '4px' : '6px' }}>
                                <div style={{ 
                                  width: isTablet ? '16px' : '18px',
                                  height: isTablet ? '16px' : '18px',
                                  backgroundColor: '#0A66C2',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <Linkedin style={{ width: isTablet ? '10px' : '11px', height: isTablet ? '10px' : '11px', color: '#FFFFFF' }} />
                                    </div>
                                <span style={{ 
                                  fontSize: isTablet ? '9px' : '10px',
                                  fontWeight: 600,
                                  color: '#4B5563'
                                }}>
                                      {userTimezone && post.scheduled_for ? getTimeInUserTimezone(post.scheduled_for, userTimezone) : timeSlot}
                                    </span>
                                  </div>
                                  {post.is_posted && (
                                <div style={{ 
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  backgroundColor: '#ECFDF5',
                                  color: '#065F46',
                                  padding: isTablet ? '2px 4px' : '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: isTablet ? '8px' : '9px',
                                  fontWeight: 600
                                }}>
                                  <CheckCircle style={{ width: isTablet ? '8px' : '9px', height: isTablet ? '8px' : '9px' }} />
                                    </div>
                                  )}
                                </div>
                              
                            {/* Post Image */}
                              {post.image_url && (
                              <div style={{ 
                                width: '100%',
                                height: isTablet ? '70px' : '90px',
                                backgroundColor: '#F9FAFB',
                                overflow: 'hidden',
                                flexShrink: 0
                              }}>
                                <img
                                  src={post.image_url}
                                  alt=""
                                  onClick={async () => {
                                    // Open text overlay editor
                                    setSelectedImageForEdit(post.image_url);
                                    setShowTextOverlayModal(true);
                                  }}
                                  style={{ 
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    userSelect: 'none',
                                    cursor: 'pointer'
                                  }}
                                  draggable={false}
                                />
                                </div>
                              )}
                              
                            {/* Content Area */}
                            <div style={{ 
                              flex: 1,
                              padding: isTablet ? '8px' : '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              minHeight: 0
                            }}>
                              {/* Post Text */}
                              <p style={{
                                fontSize: isTablet ? '10px' : '11px',
                                lineHeight: 1.4,
                                  fontWeight: 400,
                                color: '#1F2937',
                                overflow: 'hidden',
                                marginBottom: isTablet ? '6px' : '8px',
                                  display: '-webkit-box',
                                WebkitLineClamp: isTablet ? 2 : 3,
                                WebkitBoxOrient: 'vertical',
                                userSelect: 'none'
                              }}>
                                {post.content?.substring(0, isTablet ? 60 : 80) || post.body?.substring(0, isTablet ? 60 : 80) || 'Untitled Post'}
                              </p>
                              
                              {/* Footer */}
                              <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: isTablet ? '4px' : '6px',
                                marginTop: 'auto'
                              }}>
                                {post.campaign_id && (
                                  <div style={{ 
                                    fontSize: isTablet ? '9px' : '10px',
                                    fontWeight: 500,
                                    color: '#9CA3AF',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1
                                  }}>
                                    {post.profile_type === 'company' || post.profile_type === 'organization' 
                                      ? `🏢 ${post.author_name?.substring(0, isTablet ? 8 : 10) || 'Co'}`
                                      : `👤`}
                                  </div>
                                )}
                                <button
                                  onClick={(e) => handleDeletePost(e, post)}
                                  style={{
                                    width: isTablet ? '18px' : '20px',
                                    height: isTablet ? '18px' : '20px',
                                    backgroundColor: '#EF4444',
                                    borderRadius: '9999px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s ease',
                                    flexShrink: 0,
                                    touchAction: 'manipulation'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                                  title="Delete post"
                                >
                                  <X style={{ width: isTablet ? '11px' : '12px', height: isTablet ? '11px' : '12px', color: '#FFFFFF' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
            </div>
                  );
                })}
              </React.Fragment>
          ))}
        </div>
        </div>
        )}
      </div>

      {/* Post View/Edit Modal - Responsive */}
      {showPostModal && selectedPost && (
        <div style={{ 
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: isMobile ? '0' : '16px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }} onClick={() => {setShowPostModal(false); setSelectedPost(null);}}>
          <div style={{ 
            backgroundColor: '#FFFFFF',
            borderRadius: isMobile ? '0' : '16px',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: isMobile ? '100%' : '672px',
            height: isMobile ? '100%' : 'auto',
            maxHeight: isMobile ? '100%' : '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ 
              padding: isMobile ? '12px 16px' : '16px 24px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FEFEFE'
            }}>
              <div>
                <h2 style={{ 
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 700,
                  color: '#1A1A1A',
                  margin: 0
                }}>View & Edit Post</h2>
                <p style={{ 
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#6B7280',
                  marginTop: '4px'
                }}>
                  Scheduled for {selectedPost.scheduled_for ? (() => {
                    let dateStr = selectedPost.scheduled_for;
                    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                      dateStr = dateStr + 'Z';
                    }
                    return new Date(dateStr).toLocaleString();
                  })() : 'Not scheduled'}
                </p>
              </div>
              <button
                onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X style={{ width: '20px', height: '20px', color: '#6B7280' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '16px' : '24px'
            }}>
              {/* Image Preview (if exists) */}
              {selectedPost.image_url && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '8px',
                    display: 'block'
                  }}>Image Preview</label>
                  <img
                    src={selectedPost.image_url}
                    alt="Post"
                    style={{ 
                      width: '100%',
                      maxHeight: '256px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB'
                    }}
                  />
              </div>
              )}

              {/* Content Editor */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '8px',
                  display: 'block'
                }}>Post Content</label>
                <textarea
                  id="post-content-editor"
                  defaultValue={selectedPost.content || selectedPost.body || ''}
                  style={{ 
                    width: '100%',
                    height: '256px',
                    padding: '16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: '#1A1A1A',
                    resize: 'none',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#6366F1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="Enter your post content..."
                />
                <p style={{ 
                  fontSize: '11px',
                  color: '#9CA3AF',
                  marginTop: '8px'
                }}>
                  Character count: {(selectedPost.content || selectedPost.body || '').length}
                </p>
              </div>

              {/* Schedule Time Editor */}
              <div style={{ 
                marginBottom: '24px',
                backgroundColor: '#EEF2FF',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #C7D2FE'
              }}>
                <label style={{ 
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4F46E5',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock style={{ width: '16px', height: '16px' }} />
                  Reschedule Post
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ 
                      fontSize: '11px',
                      color: '#4F46E5',
                      marginBottom: '4px',
                      display: 'block',
                      fontWeight: 500
                    }}>Date</label>
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
                      style={{ 
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #C7D2FE',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1A1A1A',
                        backgroundColor: '#FFFFFF',
                        colorScheme: 'light',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#6366F1';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#C7D2FE';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      fontSize: '11px',
                      color: '#4F46E5',
                      marginBottom: '4px',
                      display: 'block',
                      fontWeight: 500
                    }}>Time</label>
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
                      style={{ 
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #C7D2FE',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1A1A1A',
                        backgroundColor: '#FFFFFF',
                        colorScheme: 'light',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#6366F1';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#C7D2FE';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
                <p style={{ 
                  fontSize: '11px',
                  color: '#6366F1',
                  marginTop: '8px',
                  fontWeight: 500
                }}>
                  Current: {selectedPost.scheduled_for ? (() => {
                    let dateStr = selectedPost.scheduled_for;
                    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                      dateStr = dateStr + 'Z';
                    }
                    return new Date(dateStr).toLocaleString();
                  })() : 'Not scheduled'}
                </p>
              </div>

              {/* Post Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ 
                  backgroundColor: '#FEFEFE',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB'
                }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>Source</div>
                  <div style={{ fontWeight: 600, color: '#1A1A1A', textTransform: 'capitalize' }}>{selectedPost.source}</div>
              </div>
                <div style={{ 
                  backgroundColor: '#FEFEFE',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB'
                }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>Status</div>
                  <div style={{ fontWeight: 600, color: '#1A1A1A', textTransform: 'capitalize' }}>{selectedPost.status || 'scheduled'}</div>
            </div>
              </div>

              {selectedPost.campaign_id && (
                <div style={{ 
                  backgroundColor: '#EEF2FF',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #C7D2FE',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '11px', color: '#6366F1', fontWeight: 600, marginBottom: '4px' }}>📊 Campaign Post</div>
                  <div style={{ fontSize: '14px', color: '#4F46E5' }}>This post is part of an automated campaign</div>
              </div>
            )}
            </div>

            {/* Modal Footer */}
            <div style={{ 
              padding: isMobile ? '12px 16px' : '16px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: isMobile ? 'column-reverse' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? '8px' : '12px',
              backgroundColor: '#FEFEFE'
            }}>
              <button
                onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
                style={{
                  padding: '8px 16px',
                  color: '#6B7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  order: isMobile ? 'last' : 'first'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Cancel
              </button>
              <div style={{ 
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '8px' : '12px'
              }}>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this post?')) {
                      handleDeletePost({stopPropagation: () => {}}, selectedPost);
                      setShowPostModal(false);
                      setSelectedPost(null);
                    }
                  }}
                  style={{
                    padding: isMobile ? '10px 16px' : '8px 16px',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EF4444'}
                >
                  Delete
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('Post this content to LinkedIn immediately?')) {
                      try {
                        // Save any changes first
                        const textarea = document.getElementById('post-content-editor');
                        await handleSavePost(textarea.value);
                        
                        // Post immediately
                        const endpoint = selectedPost.source === 'ai' 
                          ? `${BACKEND_URL}/api/ai-content/posts/${selectedPost.id}/post-now`
                          : `${BACKEND_URL}/api/scheduled-posts/${selectedPost.id}/post-now`;
                        
                        await axios.post(endpoint);
                        alert('Post published successfully to LinkedIn!');
                        setShowPostModal(false);
                        setSelectedPost(null);
                        fetchScheduledPosts();
                      } catch (error) {
                        console.error('Error posting:', error);
                        alert('Failed to post. Please try again.');
                      }
                    }
                  }}
                  style={{
                    padding: isMobile ? '10px 16px' : '8px 16px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10B981'}
                >
                  <Send style={{ width: '16px', height: '16px' }} />
                  Post Now
                </button>
                <button
                  onClick={() => {
                    const textarea = document.getElementById('post-content-editor');
                    handleSavePost(textarea.value);
                  }}
                  style={{
                    padding: isMobile ? '10px 24px' : '8px 24px',
                    backgroundColor: '#6366F1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Post Modal - Responsive */}
      {showScheduleModal && (
        <div style={{ 
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: isMobile ? '0' : '16px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          <div style={{ 
            backgroundColor: '#FFFFFF',
            borderRadius: isMobile ? '0' : '16px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '672px',
            height: isMobile ? '100%' : 'auto',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
            maxHeight: isMobile ? '100%' : '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: isMobile ? '12px 16px' : '16px 24px',
              borderBottom: '1px solid #E5E7EB',
              background: 'linear-gradient(to right, #6366F1, #8B5CF6)'
            }}>
              <h2 style={{ 
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0
              }}>Schedule Post</h2>
              <p style={{ 
                color: '#E0E7FF',
                fontSize: isMobile ? '11px' : '12px',
                marginTop: '4px'
              }}>
                {scheduleSlot?.day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Modal Body */}
            <div style={{ 
              padding: isMobile ? '16px' : '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {/* Time Picker */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '8px'
                }}>
                  Schedule Time
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '18px',
                    color: '#1A1A1A',
                    backgroundColor: '#FFFFFF',
                    colorScheme: 'light',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#6366F1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p style={{ 
                  fontSize: '11px',
                  color: '#9CA3AF',
                  marginTop: '4px'
                }}>
                  Choose any time to schedule your post
                </p>
              </div>

              {/* Select Post from Review Queue */}
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '12px'
                }}>
                  Select Post to Schedule ({pendingPosts.length} pending)
                </label>
                {pendingPosts.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center',
                    padding: '32px 0',
                    color: '#9CA3AF'
                  }}>
                    <p>No posts in review queue</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>Generate posts from the Campaigns tab first</p>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '256px',
                    overflowY: 'auto'
                  }}>
                    {pendingPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPendingPost(post.id)}
                        style={{
                          padding: '16px',
                          border: selectedPendingPost === post.id ? '2px solid #6366F1' : '2px solid #E5E7EB',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          backgroundColor: selectedPendingPost === post.id ? '#EEF2FF' : '#FFFFFF'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedPendingPost !== post.id) {
                            e.currentTarget.style.borderColor = '#D1D5DB';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedPendingPost !== post.id) {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                          }
                        }}
                      >
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}>
                          <span style={{ 
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#9CA3AF'
                          }}>
                            {post.campaign_name || 'Campaign Post'}
                          </span>
                          <span style={{ 
                            fontSize: '11px',
                            color: '#D1D5DB'
                          }}>
                            {new Date(post.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p style={{ 
                          fontSize: '14px',
                          color: '#1A1A1A',
                          lineHeight: 1.5,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {post.content}
                        </p>
                        {post.image_url && (
                          <div style={{ 
                            marginTop: '8px',
                            fontSize: '11px',
                            color: '#6366F1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>📷</span> Has image
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ 
              padding: isMobile ? '12px 16px' : '16px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: isMobile ? 'column-reverse' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: isMobile ? '8px' : '0',
              backgroundColor: '#FEFEFE'
            }}>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPendingPost(null);
                }}
                style={{
                  padding: isMobile ? '10px 16px' : '8px 16px',
                  color: '#6B7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={handleSchedulePendingPost}
                disabled={!selectedPendingPost}
                style={{
                  padding: isMobile ? '10px 24px' : '8px 24px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: 600,
                  cursor: selectedPendingPost ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                  backgroundColor: selectedPendingPost ? '#6366F1' : '#D1D5DB',
                  color: selectedPendingPost ? '#FFFFFF' : '#9CA3AF'
                }}
                onMouseEnter={(e) => {
                  if (selectedPendingPost) {
                    e.currentTarget.style.backgroundColor = '#4F46E5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPendingPost) {
                    e.currentTarget.style.backgroundColor = '#6366F1';
                  }
                }}
              >
                Approve & Schedule
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* End Main Calendar Area */}
      
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
