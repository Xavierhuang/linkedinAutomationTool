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
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground mb-6 text-sm">Please select an organization to create drafts.</p>
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
      <div className="bg-background border-b border-border px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif italic text-foreground mb-2">Drafts</h1>
            <p className="text-sm text-muted-foreground font-light">Create and manage your LinkedIn post drafts</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6 border-none flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Draft
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {drafts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No Drafts Yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto font-light">
              Create your first draft with AI-powered content generation and image creation.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent/50 hover:bg-accent text-foreground rounded-full px-6 border border-border"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create AI-Powered Draft
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-7xl animate-in fade-in duration-500">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all group hover:shadow-2xl hover:-translate-y-1"
              >
                {draft.image_url && (
                  <div className="rounded-xl overflow-hidden mb-4 bg-muted/20 border border-border">
                    <img 
                      src={draft.image_url} 
                      alt="Draft" 
                      className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const parent = e.target.parentElement;
                        if (parent && !parent.querySelector('.image-error-placeholder')) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'image-error-placeholder h-48 flex items-center justify-center text-muted-foreground/40 text-sm';
                          placeholder.textContent = 'Image unavailable';
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                  </div>
                )}
                <p className="text-sm text-foreground/80 font-light leading-relaxed whitespace-pre-wrap line-clamp-4 mb-6 min-h-[5em]">
                  {draft.content}
                </p>
                <div className="flex gap-3 pt-4 border-t border-border">
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
                    className="flex-1 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border h-9 text-xs font-medium rounded-lg transition-colors"
                  >
                    Delete
                  </Button>
                  <Button 
                    onClick={() => handleScheduleDraft(draft)}
                    className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 h-9 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl">
            <div className="p-8">
              <h2 className="text-2xl font-serif italic text-foreground mb-6 flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-primary" />
                Create AI Content
              </h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Topic / Idea</Label>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="What should this post be about?"
                    className="bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-12 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Tone</Label>
                    <select
                      value={formData.tone}
                      onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                      className="w-full bg-input border border-border rounded-xl px-4 h-12 text-foreground focus:border-primary/50 outline-none cursor-pointer appearance-none"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="thought-provoking">Thought-provoking</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Format</Label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-input border border-border rounded-xl px-4 h-12 text-foreground focus:border-primary/50 outline-none cursor-pointer appearance-none"
                    >
                      <option value="text">Text Post</option>
                      <option value="short">Short Update</option>
                      <option value="article">Article</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateContent}
                  disabled={generatingContent || !formData.topic}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-12 rounded-xl"
                >
                  {generatingContent ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Content...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate Draft</>
                  )}
                </Button>

                {generatedDraft && (
                  <div className="mt-8 pt-8 border-t border-border space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div>
                      <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Generated Content</Label>
                      <div className="bg-input border border-border rounded-xl p-4 min-h-[150px]">
                        <p className="text-foreground whitespace-pre-wrap font-light leading-relaxed">{generatedDraft.content}</p>
                      </div>
                    </div>

                    {generatedDraft.image_url ? (
                      <div>
                        <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Generated Image</Label>
                        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                          <img 
                            src={generatedDraft.image_url} 
                            alt="Generated" 
                            className="w-full h-64 object-cover opacity-90" 
                          />
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={handleGenerateImage}
                        disabled={generatingImage}
                        variant="outline"
                        className="w-full border-border hover:bg-accent/50 text-foreground h-12 rounded-xl"
                      >
                        {generatingImage ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Image...</>
                        ) : (
                          <><ImageIcon className="w-4 h-4 mr-2" /> Generate AI Image</>
                        )}
                      </Button>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setGeneratedDraft(null);
                          setShowCreateModal(false);
                        }}
                        className="flex-1 bg-muted hover:bg-accent/50 text-foreground border border-border h-12 rounded-xl"
                      >
                        Discard
                      </Button>
                      <Button
                        onClick={handleSaveDraft}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-12 rounded-xl border-none"
                      >
                        Save to Drafts
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-serif italic text-foreground mb-6 flex items-center gap-3">
              <Calendar className="w-6 h-6 text-primary" />
              Schedule Post
            </h2>
            
            <div className="space-y-5">
              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Date</Label>
                <Input
                  type="date"
                  value={scheduleData.scheduled_for}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_for: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-input border border-border text-foreground focus:border-primary/50 h-11 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Time</Label>
                <Input
                  type="time"
                  value={scheduleData.scheduled_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                  className="bg-input border border-border text-foreground focus:border-primary/50 h-11 rounded-xl"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 bg-muted hover:bg-accent/50 text-foreground border border-border h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSchedule}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11 rounded-xl border-none"
                >
                  Confirm Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftsView;
