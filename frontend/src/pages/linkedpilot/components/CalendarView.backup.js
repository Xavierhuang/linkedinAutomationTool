import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Linkedin, Loader2, X, Clock, Send, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { getUserTimezone, convertUTCToUserTime, getTimeInUserTimezone } from '@/utils/timezone';

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

  const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  const timeSlotHeight = 240; // 2x size: 120px → 240px for better visibility
  
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

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

  const getCardColor = (post) => {
    if (post.source === 'ai') return 'blue';
    if (post.campaign_id) return 'pink';
    return 'gray';
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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between" style={{ height: '64px' }}>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
            {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h1>
          <div className="flex gap-2">
              <button
              onClick={() => navigateWeek(-1)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-100 transition"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
              onClick={() => navigateWeek(1)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-100 transition"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
          <Button
          onClick={() => navigate('/dashboard/drafts')}
          className="bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Post
          </Button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minWidth: '900px' }}>
            {/* Time Column Header */}
            <div className="bg-white border-b border-r border-gray-200" style={{ height: '80px' }} />

          {/* Day Headers */}
            {weekDays.map((day, idx) => {
              const today = isToday(day);
              return (
              <div
                key={idx}
                  className="bg-white border-b border-r border-gray-200 px-4 py-4 flex flex-col items-center justify-center relative"
                  style={{ height: '80px' }}
                >
                  {today && (
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                      Today
                    </div>
                  )}
                  <div className={`flex items-baseline gap-3 ${today ? 'mt-6' : ''}`}>
                    <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                    <div className={`text-3xl font-bold ${today ? 'text-blue-600' : 'text-gray-900'}`}>
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
                <div className="bg-white border-r border-b border-gray-200 px-2 py-1 text-right text-xs text-gray-500" style={{ height: `${timeSlotHeight}px` }}>
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
                      className={`bg-white border-r border-b border-gray-100 relative transition ${isEmpty ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      style={{
                        height: `${timeSlotHeight}px`,
                        backgroundColor: isOver ? 'rgba(74, 158, 255, 0.1)' : (isEmpty ? '#FFFFFF' : '#FFFFFF'),
                        borderColor: isOver ? '#4A9EFF' : '#F0F0F0'
                      }}
                      onDragOver={(e) => handleDragOver(e, day, timeSlot)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, timeSlot)}
                      onClick={() => isEmpty && handleSlotClick(day, timeSlot)}
                    >
                      {posts.map((post) => {
                        const color = getCardColor(post);
                        const colorStyles = {
                          blue: { bg: '#E3F2FF', border: '#4A9EFF' },
                          pink: { bg: '#FFE8F0', border: '#FF69B4' },
                          gray: { bg: '#F5F5F5', border: '#D0D0D0' }
                        };

                        return (
                          <div
                            key={post.id}
                            draggable={!post.is_posted}
                            onDragStart={(e) => handleDragStart(e, post)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handleCardClick(e, post)}
                            className={`absolute inset-2 rounded-xl transition-all hover:shadow-xl overflow-hidden flex flex-col ${post.is_posted ? 'cursor-pointer' : 'cursor-grab'}`}
                        style={{
                              backgroundColor: colorStyles[color].bg,
                              border: `3px solid ${colorStyles[color].border}`,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                              transform: draggedPost?.id === post.id ? 'scale(1.05)' : 'scale(1)',
                              opacity: draggedPost?.id === post.id ? 0.8 : (post.is_posted ? 0.95 : 1),
                              zIndex: draggedPost?.id === post.id ? 1000 : 2,
                              minHeight: '160px'
                            }}
                          >
                            {/* Image Preview - 1/3 of card height with badges inside */}
                            {post.image_url && (
                              <div className="relative bg-gray-200 flex-shrink-0" style={{ height: '33%', minHeight: '80px' }}>
                                <img
                                  src={post.image_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  draggable={false}
                                />
                                {/* Badges inside image */}
                                <div className="absolute top-3 right-3 flex gap-2">
                                  {/* Posted Badge */}
                                  {post.is_posted && (
                                    <div 
                                      className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-green-600 transition"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (post.platform_url) {
                                          window.open(post.platform_url, '_blank');
                                        }
                                      }}
                                      title={post.platform_url ? "View on LinkedIn" : "Posted"}
                                    >
                                      <CheckCircle className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                  {/* LinkedIn Badge */}
                                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                                    <Linkedin className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                      </div>
                            )}
                            
                            {/* Content Area */}
                            <div className="flex-1 p-4 flex flex-col relative">
                              {/* Platform Badges (only if no image) */}
                              {!post.image_url && (
                                <div className="flex justify-end mb-3 gap-2">
                                  {/* Posted Badge */}
                                  {post.is_posted && (
                                    <div 
                                      className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-green-600 transition shadow-md"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (post.platform_url) {
                                          window.open(post.platform_url, '_blank');
                                        }
                                      }}
                                      title={post.platform_url ? "View on LinkedIn" : "Posted"}
                                    >
                                      <CheckCircle className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                  {/* LinkedIn Badge */}
                                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Linkedin className="w-4 h-4 text-white" />
        </div>
      </div>
                              )}
                              
                              {/* Post Text */}
                              <p className="text-sm font-medium text-gray-900 leading-snug overflow-hidden flex-1 mb-2" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: post.image_url ? 3 : 5,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {post.content?.substring(0, 120) || post.body?.substring(0, 120) || 'Untitled Post'}
                              </p>
                              
                              {/* Publish Target Badge */}
                              {post.campaign_id && (
                                <div className="mb-2">
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/60 backdrop-blur-sm rounded-md text-xs font-medium border border-gray-300">
                                    <Linkedin className="w-3 h-3 text-blue-600" />
                                    <span className="text-gray-700">
                                      {post.profile_type === 'company' || post.profile_type === 'organization' 
                                        ? `🏢 ${post.author_name || 'Company Page'}`
                                        : `👤 Personal`}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Footer: Time/Status + Delete Button */}
                              <div className="flex items-center justify-between mt-auto pt-2">
                                <div className="flex items-center gap-2">
                                  {post.is_posted ? (
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Posted</span>
                                      {post.platform_url && (
                                        <ExternalLink 
                                          className="w-3 h-3 cursor-pointer hover:text-green-700" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(post.platform_url, '_blank');
                                          }}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm font-semibold text-gray-600">
                                      {userTimezone && post.scheduled_for 
                                        ? getTimeInUserTimezone(post.scheduled_for, userTimezone)
                                        : timeSlot
                                      }
                                    </div>
                                  )}
                                </div>
              <button
                                  onClick={(e) => handleDeletePost(e, post)}
                                  className="w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-sm"
                                  title="Delete post"
                                >
                                  <X className="w-4 h-4 text-white" />
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
        )}
      </div>

      {/* Post View/Edit Modal */}
      {showPostModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {setShowPostModal(false); setSelectedPost(null);}}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">View & Edit Post</h2>
                <p className="text-sm text-gray-600 mt-1">
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
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Image Preview (if exists) */}
              {selectedPost.image_url && (
                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Image Preview</label>
                  <img
                    src={selectedPost.image_url}
                    alt="Post"
                    className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                  />
              </div>
              )}

              {/* Content Editor */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Post Content</label>
                <textarea
                  id="post-content-editor"
                  defaultValue={selectedPost.content || selectedPost.body || ''}
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                  placeholder="Enter your post content..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Character count: {(selectedPost.content || selectedPost.body || '').length}
                </p>
              </div>

              {/* Schedule Time Editor */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-semibold text-blue-900 mb-3 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Reschedule Post
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block font-medium">Date</label>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block font-medium">Time</label>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2 font-medium">
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Source</div>
                  <div className="font-semibold text-gray-900 capitalize">{selectedPost.source}</div>
              </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <div className="font-semibold text-gray-900 capitalize">{selectedPost.status || 'scheduled'}</div>
            </div>
              </div>

              {selectedPost.campaign_id && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                  <div className="text-xs text-blue-600 font-semibold mb-1">📊 Campaign Post</div>
                  <div className="text-sm text-blue-900">This post is part of an automated campaign</div>
              </div>
            )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <button
                onClick={() => {setShowPostModal(false); setSelectedPost(null);}}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium"
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
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-medium"
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post Now
                </button>
                <button
                  onClick={() => {
                    const textarea = document.getElementById('post-content-editor');
                    handleSavePost(textarea.value);
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Post Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
              <h2 className="text-2xl font-bold text-white">Schedule Post</h2>
              <p className="text-blue-100 text-sm mt-1">
                {scheduleSlot?.day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {/* Time Picker */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Schedule Time
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-gray-900 bg-white"
                  style={{ colorScheme: 'light' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose any time to schedule your post
                </p>
              </div>

              {/* Select Post from Review Queue */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Post to Schedule ({pendingPosts.length} pending)
                </label>
                {pendingPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No posts in review queue</p>
                    <p className="text-sm mt-2">Generate posts from the Campaigns tab first</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {pendingPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPendingPost(post.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                          selectedPendingPost === post.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500">
                            {post.campaign_name || 'Campaign Post'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(post.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 line-clamp-3">
                          {post.content}
                        </p>
                        {post.image_url && (
                          <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
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
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPendingPost(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedulePendingPost}
                disabled={!selectedPendingPost}
                className={`px-6 py-2 rounded-lg transition font-medium ${
                  selectedPendingPost
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Approve & Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;