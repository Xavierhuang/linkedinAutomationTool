import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Image as ImageIcon, Sparkles, Loader2, Plus, Send, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DraftsView = ({ orgId }) => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    scheduled_for: '',
    scheduled_time: ''
  });
  const [formData, setFormData] = useState({
    type: 'text',
    topic: '',
    tone: 'professional'
  });
  const [generatedDraft, setGeneratedDraft] = useState(null);

  // Load drafts on component mount
  useEffect(() => {
    if (orgId) {
      loadDrafts();
    }
  }, [orgId]);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/drafts?org_id=${orgId}`);
      setDrafts(response.data);
    } catch (error) {
      console.error('Error loading drafts:', error);
      // Load with empty array if error
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!formData.topic) {
      alert('Please enter a topic');
      return;
    }

    setGeneratingContent(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/drafts/generate`, {
        org_id: orgId,
        topic: formData.topic,
        tone: formData.tone,
        type: formData.type,
        created_by: user.id
      });
      
      setGeneratedDraft(response.data);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('❌ Failed to generate content. Please check your OpenAI API key in Settings → API Keys');
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedDraft || !formData.topic) {
      alert('Generate content first');
      return;
    }

    setGeneratingImage(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
        prompt: formData.topic,
        style: formData.tone
      });
      
      setGeneratedDraft({
        ...generatedDraft,
        image_url: response.data.url,
        image_base64: response.data.image_base64
      });
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Image generation failed. Make sure your API key is configured in Settings.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedDraft) return;

    try {
      const draftData = {
        id: `draft_${Date.now()}`,
        org_id: orgId,
        type: formData.type,
        content: generatedDraft.content,
        image_url: generatedDraft.image_url,
        status: 'draft',
        created_by: user.id
      };

      const response = await axios.post(`${BACKEND_URL}/api/drafts`, draftData);
      setDrafts([response.data, ...drafts]);
      setShowCreateModal(false);
      setFormData({ type: 'text', topic: '', tone: 'professional' });
      setGeneratedDraft(null);
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    }
  };

  const handleScheduleDraft = (draft) => {
    setSelectedDraft(draft);
    // Set default date/time to tomorrow at 10 AM
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
    if (!selectedDraft || !scheduleData.scheduled_for || !scheduleData.scheduled_time) {
      alert('Please select both date and time');
      return;
    }

    try {
      const scheduledDateTime = `${scheduleData.scheduled_for}T${scheduleData.scheduled_time}:00`;
      
      const schedulePostData = {
        id: `scheduled_${Date.now()}`,
        org_id: orgId,
        content: selectedDraft.content,
        image_url: selectedDraft.image_url,
        scheduled_for: scheduledDateTime,
        status: 'scheduled',
        created_by: user.id
      };

      await axios.post(`${BACKEND_URL}/api/scheduled-posts`, schedulePostData);
      
      // Remove from drafts
      setDrafts(drafts.filter(d => d.id !== selectedDraft.id));
      
      // Try to delete the draft
      try {
        await axios.delete(`${BACKEND_URL}/api/drafts/${selectedDraft.id}`);
      } catch (e) {
        console.log('Draft delete failed, but scheduled post created');
      }
      
      setShowScheduleModal(false);
      setSelectedDraft(null);
      alert('✅ Post scheduled successfully! Check the Calendar view to see your scheduled posts.');
    } catch (error) {
      console.error('Error scheduling post:', error);
      alert('Failed to schedule post. Please try again.');
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 mb-6">Please select an organization to create drafts.</p>
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
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
            <p className="text-sm text-gray-600 mt-1">Create and manage your LinkedIn post drafts</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Draft
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {drafts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Drafts Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first draft with AI-powered content generation and image creation.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create AI-Powered Draft
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-7xl">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                {draft.image_url && (
                  <img 
                    src={draft.image_url} 
                    alt="Draft" 
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4 mb-4">
                  {draft.content}
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      if (window.confirm('Delete this draft?')) {
                        try {
                          await axios.delete(`${BACKEND_URL}/api/drafts/${draft.id}`);
                          setDrafts(drafts.filter(d => d.id !== draft.id));
                        } catch (error) {
                          console.error('Error deleting draft:', error);
                        }
                      }
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm"
                  >
                    Delete
                  </Button>
                  <Button 
                    onClick={() => handleScheduleDraft(draft)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm flex items-center justify-center gap-1"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Draft Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 my-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Draft with AI</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 mb-2 block text-sm font-medium">Post Type</Label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm"
                  >
                    <option value="text">Text Only</option>
                    <option value="image">Text + Image</option>
                  </select>
                </div>

                <div>
                  <Label className="text-gray-700 mb-2 block text-sm font-medium">Topic / Theme</Label>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g., Remote work productivity tips"
                    className="border-gray-300 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 mb-2 block text-sm font-medium">Tone</Label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>

                <Button
                  onClick={handleGenerateContent}
                  disabled={generatingContent || !formData.topic}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  {generatingContent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Content with AI
                    </>
                  )}
                </Button>

                {generatedDraft && formData.type === 'image' && (
                  <Button
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                  >
                    {generatingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Image... (may take 30-60s)
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        Generate Image with AI
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Right: Preview */}
              <div className="space-y-4">
                <Label className="text-gray-700 mb-2 block text-sm font-medium">Preview</Label>
                <div className="border border-gray-300 rounded-lg p-4 min-h-96 bg-gray-50">
                  {generatedDraft ? (
                    <>
                      {generatedDraft.image_url && (
                        <img 
                          src={generatedDraft.image_url} 
                          alt="Generated" 
                          className="w-full h-64 object-cover rounded-lg mb-4"
                        />
                      )}
                      <p className="text-sm text-gray-900 whitespace-pre-wrap mb-4">
                        {generatedDraft.content}
                      </p>
                      {generatedDraft.hashtags && (
                        <div className="flex flex-wrap gap-2">
                          {generatedDraft.hashtags.map((tag, idx) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p className="text-sm">Generated content will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <Button
                onClick={() => {
                  setShowCreateModal(false);
                  setGeneratedDraft(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveDraft}
                disabled={!generatedDraft}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => {
                  if (!generatedDraft) return;
                  // Create a temporary draft object for scheduling
                  const tempDraft = {
                    id: `temp_${Date.now()}`,
                    content: generatedDraft.content,
                    image_url: generatedDraft.image_url
                  };
                  setSelectedDraft(tempDraft);
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const dateString = tomorrow.toISOString().split('T')[0];
                  setScheduleData({
                    scheduled_for: dateString,
                    scheduled_time: '10:00'
                  });
                  setShowScheduleModal(true);
                  setShowCreateModal(false);
                }}
                disabled={!generatedDraft}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Schedule Post
            </h2>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Post Preview:</p>
              {selectedDraft.image_url && (
                <img 
                  src={selectedDraft.image_url} 
                  alt="Preview" 
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}
              <p className="text-sm text-gray-600 line-clamp-3">{selectedDraft.content}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Select Date
                </Label>
                <Input
                  type="date"
                  value={scheduleData.scheduled_for}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_for: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Select Time
                </Label>
                <Input
                  type="time"
                  value={scheduleData.scheduled_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Your post will be automatically published to LinkedIn at the scheduled time.
                  You can view and manage all scheduled posts in the Calendar view.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedDraft(null);
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
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftsView;