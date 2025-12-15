import React, { useState, useCallback, useEffect } from 'react';
import { Edit2, Save, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import axios from 'axios';
import designTokens from '@/designTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EditableField = ({ 
  value, 
  onSave, 
  label, 
  multiline = false, 
  placeholder,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (editValue !== value) {
      setIsSaving(true);
      try {
        await onSave(editValue);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to save:', error);
        // Revert on error
        setEditValue(value);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  if (isEditing) {
    return (
      <div className={`relative ${className}`}>
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
              if (e.key === 'Enter' && e.ctrlKey) handleSave();
            }}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none min-h-[100px]"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
              if (e.key === 'Enter') handleSave();
            }}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder={placeholder}
            autoFocus
          />
        )}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-all flex items-center gap-1.5 text-sm"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {multiline ? (
            <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap">
              {value || <span className="text-white/40 italic">{placeholder}</span>}
            </p>
          ) : (
            <p className="text-base text-white/90">
              {value || <span className="text-white/40 italic">{placeholder}</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          title={`Edit ${label}`}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const SamplePostAccordion = ({ post, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const postPreview = post.length > 150 ? post.substring(0, 150) + '...' : post;
  
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-all hover:bg-white/10">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider flex-shrink-0">
            Post {index + 1}
          </span>
          <span className="text-sm text-white/70 truncate">
            {isExpanded ? post : postPreview}
          </span>
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-white/60" />
          ) : (
            <ChevronDown className="h-5 w-5 text-white/60" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-6 pb-4 pt-0 border-t border-white/10">
          <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap pt-4">
            {post}
          </p>
        </div>
      )}
    </div>
  );
};

const EditablePillars = ({ pillars, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPillars, setEditPillars] = useState(pillars?.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const newPillars = editPillars.split(',').map(p => p.trim()).filter(Boolean);
    if (JSON.stringify(newPillars) !== JSON.stringify(pillars || [])) {
      setIsSaving(true);
      try {
        await onSave(newPillars);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to save:', error);
        setEditPillars(pillars?.join(', ') || '');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  }, [editPillars, pillars, onSave]);

  if (isEditing) {
    return (
      <div>
        <input
          type="text"
          value={editPillars}
          onChange={(e) => setEditPillars(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditPillars(pillars?.join(', ') || '');
              setIsEditing(false);
            }
            if (e.key === 'Enter') handleSave();
          }}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Enter pillars separated by commas"
          autoFocus
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditPillars(pillars?.join(', ') || '');
              setIsEditing(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 transition-all flex items-center gap-1.5 text-sm"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {pillars && pillars.length > 0 ? (
            pillars.map((pillar, index) => (
              <span
                key={index}
                className="px-4 py-2 rounded-full text-sm font-medium text-white/90 bg-white/10 border border-white/15"
              >
                {pillar}
              </span>
            ))
          ) : (
            <span className="text-white/40 italic text-sm">No content pillars defined</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          title="Edit content pillars"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const CampaignCard = ({ campaign, onAction, disabled, onUpdate, orgId, userId, forceExpanded = false, a4Size = false }) => {
  const [expanded, setExpanded] = useState(forceExpanded);
  const [isUpdating, setIsUpdating] = useState(false);

  // Auto-expand if forceExpanded is true
  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);

  if (!campaign) {
    return null;
  }

  const toggleExpanded = () => setExpanded((prev) => !prev);

  const handleAction = (e, actionType) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) {
      return;
    }
    if (onAction) {
      onAction(actionType, campaign);
    }
  };

  const updateCampaignField = useCallback(async (field, value) => {
    if (!campaign.id || !onUpdate) {
      return;
    }

    setIsUpdating(true);
    try {
      // Try to update first (campaign might already exist in DB)
      try {
        await axios.put(
          `${BACKEND_URL}/api/campaigns/${campaign.id}`,
          { [field]: value },
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (updateError) {
        // If campaign doesn't exist (404), create it first if we have org_id
        if (updateError?.response?.status === 404 && orgId) {
          // Create campaign with current data + updated field
          const campaignData = {
            id: campaign.id,
            org_id: orgId,
            name: campaign.name,
            description: campaign.description,
            target_audience: campaign.target_audience || {},
            content_pillars: campaign.content_pillars || [],
            posting_schedule: campaign.posting_schedule || { frequency: 'weekly', time_slots: [] },
            tone_voice: campaign.tone_voice || 'professional',
            content_types: campaign.content_types || ['text'],
            status: 'draft',
            created_by: campaign.created_by || userId || 'system',
            [field]: value, // Include the updated field
          };
          
          await axios.post(
            `${BACKEND_URL}/api/campaigns`,
            campaignData,
            { headers: { 'Content-Type': 'application/json' } }
          );
        } else if (updateError?.response?.status === 404) {
          // Campaign preview not in DB yet and no org_id, just update local state
          // Campaign will be saved when approved
          console.log('Campaign preview not in DB yet, updating local state only');
        } else {
          throw updateError;
        }
      }
      
      // Call parent update handler to refresh campaign data
      if (onUpdate) {
        onUpdate({ ...campaign, [field]: value });
      }
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [campaign, onUpdate]);

  return (
    <article
      className={`rounded-3xl border overflow-hidden transition-all ${
        expanded ? 'md:col-span-3 w-full' : 'w-full'
      } ${a4Size ? 'min-h-[842px]' : ''}`}
      style={{
        borderColor: designTokens.colors.border.light,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: expanded ? designTokens.shadow.lg : designTokens.shadow.md,
        ...(a4Size && {
          width: '210mm',
          minHeight: '297mm',
          maxWidth: '100%',
        }),
      }}
    >
      {/* Header - Always Visible */}
      <header
        className={`px-8 py-6 border-b border-white/10 ${!forceExpanded ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
        onClick={(e) => {
          if (!forceExpanded) {
            e.stopPropagation();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs uppercase tracking-[0.28em] text-white/60">Campaign</span>
              {isUpdating && (
                <span className="text-xs text-white/40 animate-pulse">Saving...</span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {campaign.name || 'Untitled Campaign'}
            </h2>
            <p className="text-base text-white/70 leading-relaxed">
              {campaign.description || 'AI generated campaign aligned with brand analysis.'}
            </p>
          </div>
          {!forceExpanded && (
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              {expanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Blog Post Content - Expanded View */}
      {(expanded || forceExpanded) && (
        <div className={`px-8 py-8 space-y-8 ${a4Size ? 'min-h-[calc(297mm-120px)]' : ''}`}>
          {/* Campaign Overview */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              Campaign Overview
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Campaign Name</label>
                <EditableField
                  value={campaign.name}
                  onSave={(value) => updateCampaignField('name', value)}
                  label="Campaign Name"
                  placeholder="Enter campaign name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Description</label>
                <EditableField
                  value={campaign.description}
                  onSave={(value) => updateCampaignField('description', value)}
                  label="Description"
                  multiline
                  placeholder="Enter campaign description"
                />
              </div>
            </div>
          </section>

          {/* Focus & Strategy */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              Focus & Strategy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Focus Area</label>
                <EditableField
                  value={campaign.focus}
                  onSave={(value) => updateCampaignField('focus', value)}
                  label="Focus Area"
                  placeholder="e.g., Multi-channel awareness"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Tone & Voice</label>
                <EditableField
                  value={campaign.tone_voice ? campaign.tone_voice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Professional'}
                  onSave={(value) => updateCampaignField('tone_voice', value.toLowerCase().replace(/\s+/g, '_'))}
                  label="Tone & Voice"
                  placeholder="e.g., Professional"
                />
              </div>
            </div>
          </section>

          {/* Content Pillars */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
              Content Pillars
            </h3>
            <EditablePillars
              pillars={campaign.content_pillars}
              onSave={(pillars) => updateCampaignField('content_pillars', pillars)}
            />
          </section>

          {/* Sample Posts - Accordion Style */}
          {campaign.sample_posts && campaign.sample_posts.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
                Sample Posts
              </h3>
              <div className="space-y-2">
                {campaign.sample_posts.map((post, index) => (
                  <SamplePostAccordion key={index} post={post} index={index} />
                ))}
              </div>
            </section>
          )}

          {/* Posting Schedule */}
          {campaign.posting_schedule && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">
                Posting Schedule
              </h3>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-2 block">Frequency</label>
                    <p className="text-base text-white/90">
                      {campaign.posting_schedule.frequency?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Weekly'}
                    </p>
                  </div>
                  {Array.isArray(campaign.posting_schedule.time_slots) && campaign.posting_schedule.time_slots.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-white/60 mb-2 block">Time Slots</label>
                      <p className="text-base text-white/90">
                        {campaign.posting_schedule.time_slots.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="pt-4 border-t border-white/10">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={(e) => handleAction(e, 'refine')}
                disabled={disabled}
                className={`px-6 py-3 text-sm rounded-full border transition-all ${
                  disabled ? 'border-white/15 text-white/30 cursor-not-allowed' : 'border-white/25 text-white/80 hover:border-white/40 hover:bg-white/5'
                }`}
              >
                Refine
              </button>
              <button
                type="button"
                onClick={(e) => handleAction(e, 'combine')}
                disabled={disabled}
                className={`px-6 py-3 text-sm rounded-full border transition-all ${
                  disabled ? 'border-white/15 text-white/30 cursor-not-allowed' : 'border-white/25 text-white/80 hover:border-white/40 hover:bg-white/5'
                }`}
              >
                Combine
              </button>
              <button
                type="button"
                onClick={(e) => handleAction(e, 'new')}
                disabled={disabled}
                className={`px-6 py-3 text-sm rounded-full border transition-all ${
                  disabled ? 'border-white/15 text-white/30 cursor-not-allowed' : 'border-white/25 text-white/80 hover:border-white/40 hover:bg-white/5'
                }`}
              >
                Start New
              </button>
              <button
                type="button"
                onClick={(e) => handleAction(e, 'approve')}
                disabled={disabled}
                className={`px-6 py-3 text-sm rounded-full transition-all ml-auto ${
                  disabled
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] font-semibold'
                }`}
              >
                Approve Campaign
              </button>
            </div>
          </section>
        </div>
      )}
    </article>
  );
};

export default CampaignCard;
