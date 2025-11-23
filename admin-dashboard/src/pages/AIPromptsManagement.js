import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, Save, AlertCircle, FileText, Sparkles, Image, MessageSquare, Zap } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AIPromptsManagement = () => {
  const tokens = useThemeTokens();
  const [prompts, setPrompts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/ai-prompts`);
      setPrompts(response.data.prompts || {});
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setMessage({ type: 'error', text: 'Failed to load AI prompts' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(`${API_URL}/api/admin/ai-prompts`, { prompts });
      setMessage({ type: 'success', text: 'AI prompts saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save AI prompts',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const updatePrompt = (sectionId, promptKey, value) => {
    setPrompts(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [promptKey]: value
      }
    }));
  };

  const promptCategories = [
    {
      id: 'content_generation',
      name: 'Content Generation',
      description: 'Prompts for generating LinkedIn post content',
      icon: FileText,
      prompts: [
        {
          key: 'main_prompt',
          label: 'Main Content Generation Prompt',
          description: 'Used when generating post content from topics and campaigns (from ai_content_generator.py)',
          placeholder: 'Enter the main content generation prompt...'
        },
        {
          key: 'llm_adapter_prompt',
          label: 'LLM Adapter Prompt',
          description: 'Used by LLMAdapter for generating post content (from llm_adapter.py)',
          placeholder: 'Enter the LLM adapter prompt...'
        },
        {
          key: 'carousel_prompt',
          label: 'Carousel Content Prompt',
          description: 'Used when generating content for carousel posts',
          placeholder: 'Enter the carousel content prompt...'
        }
      ]
    },
    {
      id: 'text_overlay',
      name: 'Text Overlay Generation',
      description: 'Prompts for AI text overlay generation on images',
      icon: Sparkles,
      prompts: [
        {
          key: 'research_agent',
          label: 'Research Agent Prompt',
          description: 'Prompt for analyzing images and recommending design elements',
          placeholder: 'Enter the research agent prompt...'
        },
        {
          key: 'orchestra_agent',
          label: 'Orchestra Agent Prompt',
          description: 'Prompt for synthesizing research into design strategy',
          placeholder: 'Enter the orchestra agent prompt...'
        },
        {
          key: 'review_agent',
          label: 'Review Agent Prompt',
          description: 'Prompt for validating design quality',
          placeholder: 'Enter the review agent prompt...'
        },
        {
          key: 'refinement_agent',
          label: 'Refinement Agent Prompt',
          description: 'Prompt for polishing final design output',
          placeholder: 'Enter the refinement agent prompt...'
        }
      ]
    },
    {
      id: 'image_generation',
      name: 'Image Generation',
      description: 'Prompts for generating and optimizing images',
      icon: Image,
      prompts: [
        {
          key: 'image_prompt_optimizer',
          label: 'Image Prompt Optimizer',
          description: 'Prompt for optimizing image generation prompts',
          placeholder: 'Enter the image prompt optimizer prompt...'
        }
      ]
    },
    {
      id: 'campaign_generation',
      name: 'Campaign Generation',
      description: 'Prompts for generating campaign ideas and content',
      icon: Zap,
      prompts: [
        {
          key: 'campaign_idea_generator',
          label: 'Campaign Idea Generator',
          description: 'Prompt for generating campaign ideas from brand materials',
          placeholder: 'Enter the campaign idea generator prompt...'
        }
      ]
    },
    {
      id: 'brand_assistant',
      name: 'Brand Assistant',
      description: 'Prompts for brand analysis and suggestions',
      icon: MessageSquare,
      prompts: [
        {
          key: 'brand_analysis',
          label: 'Brand Analysis Prompt',
          description: 'Prompt for analyzing brand materials and extracting insights',
          placeholder: 'Enter the brand analysis prompt...'
        }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent" style={{ borderColor: tokens.colors.accent.lime }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>AI Prompts Management</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
          Edit and manage all AI prompts used throughout the application
        </p>
      </div>

      {/* Alert Banner */}
      {message.text && (
        <div
          style={{
            padding: '16px',
            borderRadius: tokens.radius.lg,
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444'
          }}
          className="animate-in fade-in duration-300"
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <Save className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Accordion */}
      <div className="space-y-4">
        {promptCategories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedSections[category.id];
          
          return (
            <div
              key={category.id}
              style={{
                backgroundColor: tokens.colors.background.layer1,
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.border.default}`,
                overflow: 'hidden'
              }}
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleSection(category.id)}
                style={{
                  width: '100%',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="flex items-center gap-4">
                  <div style={{ width: '40px', height: '40px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.lg }} className="flex items-center justify-center">
                    <Icon style={{ width: '20px', height: '20px', color: tokens.colors.text.inverse }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: tokens.colors.text.primary, marginBottom: '4px' }}>
                      {category.name}
                    </h3>
                    <p style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                      {category.description}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp style={{ width: '20px', height: '20px', color: tokens.colors.text.secondary }} />
                ) : (
                  <ChevronDown style={{ width: '20px', height: '20px', color: tokens.colors.text.secondary }} />
                )}
              </button>

              {/* Accordion Content */}
              {isExpanded && (
                <div style={{ padding: '24px', borderTop: `1px solid ${tokens.colors.border.default}` }}>
                  <div className="space-y-6">
                    {category.prompts.map((prompt) => (
                      <div key={prompt.key}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary, marginBottom: '8px' }}>
                          {prompt.label}
                        </label>
                        <p style={{ fontSize: '12px', color: tokens.colors.text.secondary, marginBottom: '12px' }}>
                          {prompt.description}
                        </p>
                        <textarea
                          value={prompts[category.id]?.[prompt.key] || ''}
                          onChange={(e) => updatePrompt(category.id, prompt.key, e.target.value)}
                          placeholder={prompt.placeholder}
                          rows={12}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: tokens.colors.background.input,
                            border: `1px solid ${tokens.colors.border.default}`,
                            color: tokens.colors.text.primary,
                            borderRadius: tokens.radius.lg,
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            lineHeight: '1.6',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.border.default;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end animate-in fade-in duration-500">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: tokens.colors.accent.lime,
            color: tokens.colors.text.inverse,
            borderRadius: tokens.radius.lg,
            fontWeight: 500,
            opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            border: 'none'
          }}
          className="transition"
          onMouseEnter={(e) => {
            if (!saving) e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            if (!saving) e.currentTarget.style.opacity = '1';
          }}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Prompts'}
        </button>
      </div>

      {/* Info Section */}
      <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: tokens.radius.lg, padding: '24px' }} className="animate-in fade-in duration-500">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
          <div style={{ fontSize: '14px', color: '#93c5fd' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Important Notes:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Changes to prompts will affect all future AI-generated content</li>
              <li>Test prompts thoroughly before deploying to production</li>
              <li>Use variables like {'{campaign_name}'}, {'{topic}'}, {'{tone}'} where applicable</li>
              <li>Prompts are stored securely and encrypted</li>
              <li>Backup your prompts before making major changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPromptsManagement;

