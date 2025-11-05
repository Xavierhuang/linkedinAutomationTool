import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Sparkles, Copy, Check, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ChatDraftsView = ({ orgId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI content assistant. Tell me what kind of LinkedIn post you\'d like to create, and I\'ll help you craft it.\n\nYou can ask me to:\n• Generate a post about any topic\n• Create an image for your post\n• Refine and edit the content\n• Adjust the tone or style\n\nWhat would you like to create?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [scheduleData, setScheduleData] = useState({
    scheduled_for: '',
    scheduled_time: '10:00'
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Check if user wants to generate image
      if (currentInput.toLowerCase().includes('image') || currentInput.toLowerCase().includes('picture') || currentInput.toLowerCase().includes('visual')) {
        // Show loading message
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Generating image... This will take about 30-60 seconds.',
          timestamp: new Date(),
          isLoading: true
        }]);

        const imageResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
          prompt: currentInput,
          style: 'professional'
        });

        // Remove loading message and add image
        setMessages(prev => prev.slice(0, -1).concat({
          role: 'assistant',
          content: 'Here\'s your generated image:',
          timestamp: new Date(),
          image: imageResponse.data.url,
          imageData: imageResponse.data
        }));
      } else {
        // Generate or edit content
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

  const handleCopy = async (content, index) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveDraft = async (postData, image = null) => {
    try {
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
          url: image
        }] : [],
        status: 'draft'
      };

      await axios.post(`${BACKEND_URL}/api/drafts`, draftData);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Draft saved successfully! You can find it in your drafts list.',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error saving draft:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to save draft. Please try again.',
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
      const scheduledDateTime = `${scheduleData.scheduled_for}T${scheduleData.scheduled_time}:00`;
      
      const schedulePostData = {
        id: `scheduled_${Date.now()}`,
        org_id: orgId,
        content: selectedPost.postData.content,
        image_url: selectedPost.image,
        scheduled_for: scheduledDateTime,
        status: 'scheduled',
        created_by: user.id
      };

      await axios.post(`${BACKEND_URL}/api/scheduled-posts`, schedulePostData);
      
      setShowScheduleModal(false);
      setSelectedPost(null);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Post scheduled successfully! Check the Calendar view to see your scheduled posts.',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error scheduling post:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to schedule post. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 mb-6">Please select an organization to start creating posts.</p>
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Content Assistant</h2>
              <p className="text-xs text-gray-600">Powered by GPT-4o</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div key={index}>
              {message.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className={`rounded-2xl px-4 py-3 ${
                      message.isError 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-white border border-gray-200'
                    }`}>
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                          <p className="text-sm text-gray-600">{message.content}</p>
                        </div>
                      ) : (
                        <>
                          <MessageContent 
                            content={message.content} 
                            isPost={message.isPost}
                          />
                          
                          {message.image && (
                            <div className="mt-3">
                              <img 
                                src={message.image}
                                onError={(e) => {
                                  // Handle expired or broken image URLs gracefully
                                  e.target.style.display = 'none';
                                  const parent = e.target.parentElement;
                                  if (parent && !parent.querySelector('.image-error-placeholder')) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'image-error-placeholder';
                                    placeholder.style.cssText = 'padding: 20px; text-align: center; color: #9CA3AF; background: #F3F4F6; border-radius: 8px; font-size: 14px;';
                                    placeholder.textContent = 'Image unavailable (expired link)';
                                    parent.appendChild(placeholder);
                                  }
                                }}
                                alt="Generated" 
                                className="w-full rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                          
                          {message.hashtags && message.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                              {message.hashtags.map((tag, idx) => (
                                <span key={idx} className="text-sm text-blue-600">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {(message.isPost || message.image) && (
                            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                              <Button
                                onClick={() => handleCopy(message.content, index)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm h-8"
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
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm h-8"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Save Draft
                              </Button>
                              <Button
                                onClick={() => handleScheduleClick(message.postData || { content: message.content }, message.image)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm h-8"
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                Schedule
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 px-2">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {loading && !messages[messages.length - 1]?.isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                  <p className="text-sm text-gray-600">Thinking...</p>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Message AI assistant... (e.g., 'Create a post about AI trends' or 'Generate an image')"
            className="flex-1 border-gray-300 bg-white text-gray-900 h-11"
            disabled={loading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 h-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Schedule Post
            </h2>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Post Preview:</p>
              {selectedPost.image && (
                <img 
                  src={selectedPost.image}
                  onError={(e) => {
                    // Handle expired or broken image URLs gracefully
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    if (parent && !parent.querySelector('.image-error-placeholder')) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'image-error-placeholder';
                      placeholder.style.cssText = 'padding: 20px; text-align: center; color: #9CA3AF; background: #F3F4F6; border-radius: 8px; font-size: 14px;';
                      placeholder.textContent = 'Image unavailable (expired link)';
                      parent.appendChild(placeholder);
                    }
                  }}
                  alt="Preview" 
                  className="w-full h-24 object-cover rounded-lg mb-2"
                />
              )}
              <p className="text-sm text-gray-600 line-clamp-3">{selectedPost.postData.content}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-gray-700 mb-2 block text-sm font-medium">
                  Select Date
                </label>
                <input
                  type="date"
                  value={scheduleData.scheduled_for}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_for: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm"
                />
              </div>

              <div>
                <label className="text-gray-700 mb-2 block text-sm font-medium">
                  Select Time
                </label>
                <input
                  type="time"
                  value={scheduleData.scheduled_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPost(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSchedule}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Confirm
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
      <p className="text-sm text-gray-900 whitespace-pre-wrap">{displayContent}</p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-gray-900 font-semibold mt-2 hover:underline"
        >
          {isExpanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default ChatDraftsView;