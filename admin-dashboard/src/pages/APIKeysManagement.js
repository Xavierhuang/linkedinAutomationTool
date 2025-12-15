import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Eye, EyeOff, Save, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const APIKeysManagement = () => {
  const tokens = useThemeTokens();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('openai');
  const [modelSettings, setModelSettings] = useState({
    text_draft_content: 'google_ai_studio:gemini-2.5-flash',
    text_text_overlay: 'google_ai_studio:gemini-2.5-flash',
    text_carousel_content: 'google_ai_studio:gemini-2.5-flash',
    image_draft_image: 'google_ai_studio:gemini-2.5-flash-image',
    image_carousel_images: 'google_ai_studio:gemini-2.5-flash-image'
  });
  const [availableModels, setAvailableModels] = useState({ text_models: {}, image_models: {} });
  const [keys, setKeys] = useState({
    openai_api_key: '',
    google_ai_api_key: '',
    linkedin_client_id: '',
    linkedin_client_secret: '',
    unsplash_access_key: '',
    pexels_api_key: '',
    canva_api_key: '',
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
    stripe_pro_price_id: ''
  });
  const [showKeys, setShowKeys] = useState({
    openai_api_key: false,
    google_ai_api_key: false,
    linkedin_client_id: false,
    linkedin_client_secret: false,
    unsplash_access_key: false,
    pexels_api_key: false,
    canva_api_key: false,
    stripe_secret_key: false,
    stripe_publishable_key: false,
    stripe_webhook_secret: false,
    stripe_pro_price_id: false
  });

  useEffect(() => {
    fetchSystemKeys();
    fetchModelSettings();
    fetchAvailableModels();
  }, []);

  const fetchSystemKeys = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/system-keys`);
      setKeys(response.data);
    } catch (error) {
      console.error('Error fetching system keys:', error);
      setMessage({ type: 'error', text: 'Failed to load API keys' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(`${API_URL}/api/admin/system-keys`, keys);
      setMessage({ type: 'success', text: 'API keys saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save API keys',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const toggleKeyVisibility = (keyName) => {
    setShowKeys({ ...showKeys, [keyName]: !showKeys[keyName] });
  };

  const fetchModelSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/model-settings`);
      setModelSettings(response.data);
    } catch (error) {
      console.error('Error fetching model settings:', error);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/available-models`);
      setAvailableModels(response.data);
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  };

  const handleSaveModelSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(`${API_URL}/api/admin/model-settings`, modelSettings);
      setMessage({ type: 'success', text: 'Model settings saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save model settings',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const getKeyStatus = (key) => {
    if (!keys[key] || keys[key].trim() === '') {
      return <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />;
    }
    return <CheckCircle className="w-4 h-4" style={{ color: tokens.colors.accent.lime }} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent" style={{ borderColor: tokens.colors.accent.lime }}></div>
      </div>
    );
  }

  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT models for content generation',
      keys: [
        { id: 'openai_api_key', label: 'API Key', placeholder: 'sk-...' }
      ]
    },
    {
      id: 'google',
      name: 'Google AI',
      description: 'Gemini models for content generation',
      keys: [
        { id: 'google_ai_api_key', label: 'API Key', placeholder: 'AIza...' }
      ]
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'OAuth credentials for LinkedIn posting',
      keys: [
        { id: 'linkedin_client_id', label: 'Client ID', placeholder: 'Enter LinkedIn Client ID' },
        { id: 'linkedin_client_secret', label: 'Client Secret', placeholder: 'Enter LinkedIn Client Secret' }
      ]
    },
    {
      id: 'unsplash',
      name: 'Unsplash',
      description: 'Stock photos for posts',
      keys: [
        { id: 'unsplash_access_key', label: 'Access Key', placeholder: 'Enter Unsplash Access Key' }
      ]
    },
    {
      id: 'pexels',
      name: 'Pexels',
      description: 'Stock photos for posts',
      keys: [
        { id: 'pexels_api_key', label: 'API Key', placeholder: 'Enter Pexels API Key' }
      ]
    },
    {
      id: 'canva',
      name: 'Canva',
      description: 'Design templates and graphics',
      keys: [
        { id: 'canva_api_key', label: 'API Key', placeholder: 'Enter Canva API Key' }
      ]
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and subscriptions',
      keys: [
        { id: 'stripe_secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
        { id: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
        { id: 'stripe_webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...' },
        { id: 'stripe_pro_price_id', label: 'Pro Plan Price ID', placeholder: 'price_...' }
      ]
    },
    {
      id: 'models',
      name: 'AI Models',
      description: 'Default AI models for text and image generation',
      isModelTab: true
    }
  ];

  const activeProvider = providers.find(p => p.id === activeTab);
  const isModelTab = activeTab === 'models';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>API Keys Management</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '8px' }}>
          Configure system-wide API keys that will be used by all users. These keys are encrypted and stored securely.
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
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Horizontal Tabs */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}` }}>
        {/* Tab Headers */}
        <div style={{ borderBottom: `1px solid ${tokens.colors.border.default}` }}>
          <nav className="flex overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {providers.map((provider) => {
              const isModelProvider = provider.isModelTab;
              const hasAllKeys = isModelProvider ? true : provider.keys.every(k => keys[k.id] && keys[k.id].trim() !== '');
              const hasSomeKeys = isModelProvider ? true : provider.keys.some(k => keys[k.id] && keys[k.id].trim() !== '');
              
              return (
                <button
                  key={provider.id}
                  onClick={() => setActiveTab(provider.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderBottom: `2px solid ${activeTab === provider.id ? tokens.colors.accent.lime : 'transparent'}`,
                    color: activeTab === provider.id ? tokens.colors.accent.lime : tokens.colors.text.secondary,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== provider.id) {
                      e.currentTarget.style.color = tokens.colors.text.primary;
                      e.currentTarget.style.borderBottomColor = tokens.colors.border.strong;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== provider.id) {
                      e.currentTarget.style.color = tokens.colors.text.secondary;
                      e.currentTarget.style.borderBottomColor = 'transparent';
                    }
                  }}
                >
                  <span>{provider.name}</span>
                  {!isModelProvider && (hasAllKeys ? (
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: tokens.colors.accent.lime }} />
                  ) : hasSomeKeys ? (
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: '#facc15' }} />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  ))}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {isModelTab ? (
            /* Model Settings Tab */
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 style={{ fontSize: '18px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>AI Model Configuration</h2>
                <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>Set default AI models for different features in the application</p>
              </div>

              {/* Text Generation Models */}
              <div style={{ border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg, padding: '24px', backgroundColor: tokens.colors.background.input }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500, color: tokens.colors.text.primary, marginBottom: '16px' }}>Text Generation Models</h3>
                <div className="space-y-5">
                  {['text_draft_content', 'text_text_overlay', 'text_carousel_content'].map((key, idx) => {
                    const labels = ['Draft Content Generation', 'Text Overlay Generation', 'Carousel Content Generation'];
                    const descriptions = ['Used when generating post content from topics', 'Used when generating AI text overlays for images', 'Used when generating carousel post captions'];
                    return (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                          {labels[idx]}
                        </label>
                        <select
                          value={modelSettings[key]}
                          onChange={(e) => setModelSettings({ ...modelSettings, [key]: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            backgroundColor: tokens.colors.background.input,
                            border: `1px solid ${tokens.colors.border.default}`,
                            color: tokens.colors.text.primary,
                            borderRadius: tokens.radius.lg,
                            outline: 'none'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.border.default;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {Object.entries(availableModels.text_models || {}).flatMap(([provider, models]) =>
                            models.map(model => (
                              <option key={model.value} value={model.value}>{model.label}</option>
                            ))
                          )}
                        </select>
                        <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary, marginTop: '4px' }}>{descriptions[idx]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Image Generation Models */}
              <div style={{ border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg, padding: '24px', backgroundColor: tokens.colors.background.input }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500, color: tokens.colors.text.primary, marginBottom: '16px' }}>Image Generation Models</h3>
                <div className="space-y-5">
                  {['image_draft_image', 'image_carousel_images'].map((key, idx) => {
                    const labels = ['Draft Image Generation', 'Carousel Image Generation'];
                    const descriptions = ['Used when generating images for draft posts', 'Used when generating images for carousel posts'];
                    return (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                          {labels[idx]}
                        </label>
                        <select
                          value={modelSettings[key]}
                          onChange={(e) => setModelSettings({ ...modelSettings, [key]: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            backgroundColor: tokens.colors.background.input,
                            border: `1px solid ${tokens.colors.border.default}`,
                            color: tokens.colors.text.primary,
                            borderRadius: tokens.radius.lg,
                            outline: 'none'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.border.default;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {Object.entries(availableModels.image_models || {}).flatMap(([provider, models]) =>
                            models.map(model => (
                              <option key={model.value} value={model.value}>{model.label}</option>
                            ))
                          )}
                        </select>
                        <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary, marginTop: '4px' }}>{descriptions[idx]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Helper Text */}
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: tokens.radius.lg, padding: '16px' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
                  <div style={{ fontSize: '14px', color: '#93c5fd' }}>
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>About Model Selection:</p>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>These are default models used system-wide</li>
                      <li>Format: provider:model-name (e.g., google_ai_studio:gemini-2.5-flash)</li>
                      <li>Users can override defaults if they have their own API keys</li>
                      <li>Make sure the corresponding API keys are configured in the API Keys tab</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : activeProvider && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Provider Info */}
              <div>
                <h2 style={{ fontSize: '18px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>{activeProvider.name}</h2>
                <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>{activeProvider.description}</p>
              </div>

              {/* API Key Fields */}
              <div className="space-y-4">
                {activeProvider.keys.map((key) => (
                  <div key={key.id}>
                    <div className="flex items-center justify-between mb-2">
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary }}>
                        {key.label}
                      </label>
                      <div className="flex items-center gap-2">
                        {getKeyStatus(key.id)}
                        <span style={{ fontSize: '12px', color: tokens.colors.text.tertiary }}>
                          {keys[key.id] && keys[key.id].trim() !== '' ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeys[key.id] ? 'text' : 'password'}
                        value={keys[key.id] || ''}
                        onChange={(e) => setKeys({ ...keys, [key.id]: e.target.value })}
                        placeholder={key.placeholder}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          paddingRight: '48px',
                          backgroundColor: tokens.colors.background.input,
                          border: `1px solid ${tokens.colors.border.default}`,
                          color: tokens.colors.text.primary,
                          borderRadius: tokens.radius.lg,
                          fontSize: '14px',
                          outline: 'none'
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
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(key.id)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: tokens.colors.text.secondary }}
                        onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
                        onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
                      >
                        {showKeys[key.id] ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Helper Text */}
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: tokens.radius.lg, padding: '16px' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
                  <div style={{ fontSize: '14px', color: '#93c5fd' }}>
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>How to get {activeProvider.name} API keys:</p>
                    {activeProvider.id === 'openai' && (
                      <p>Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>OpenAI Platform</a> to create an API key. You'll need an OpenAI account with billing set up.</p>
                    )}
                    {activeProvider.id === 'google' && (
                      <p>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>Google AI Studio</a> to create an API key for Gemini models.</p>
                    )}
                    {activeProvider.id === 'linkedin' && (
                      <p>Visit <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>LinkedIn Developers</a> to create an app and get your OAuth credentials.</p>
                    )}
                    {activeProvider.id === 'unsplash' && (
                      <p>Visit <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>Unsplash Developers</a> to create an application and get your access key.</p>
                    )}
                    {activeProvider.id === 'pexels' && (
                      <p>Visit <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>Pexels API</a> to create an account and generate an API key.</p>
                    )}
                    {activeProvider.id === 'canva' && (
                      <p>Visit <a href="https://www.canva.com/developers/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>Canva Developers</a> to create an app and get your API key.</p>
                    )}
                    {activeProvider.id === 'stripe' && (
                      <div className="space-y-2">
                        <p>Visit <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 500, color: tokens.colors.accent.lime }}>Stripe Dashboard</a> to get your API keys.</p>
                        <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                          <li><strong>Secret Key:</strong> Found in Developers → API keys (starts with sk_live_ or sk_test_)</li>
                          <li><strong>Publishable Key:</strong> Found in same location (starts with pk_live_ or pk_test_)</li>
                          <li><strong>Webhook Secret:</strong> Create webhook endpoint at Developers → Webhooks (starts with whsec_)</li>
                          <li><strong>Price ID:</strong> Create product + price at Products → Add product (starts with price_)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end animate-in fade-in duration-500">
        <button
          onClick={isModelTab ? handleSaveModelSettings : handleSave}
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
          {saving ? 'Saving...' : isModelTab ? 'Save Model Settings' : 'Save All Keys'}
        </button>
      </div>

      {/* Info Section */}
      <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: tokens.radius.lg, padding: '24px' }} className="animate-in fade-in duration-500">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
          <div style={{ fontSize: '14px', color: '#93c5fd' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Important Notes:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>All API keys are encrypted before storage</li>
              <li>These keys will be used by all users across the platform</li>
              <li>Users will not need to configure their own API keys</li>
              <li>If a key is missing or invalid, features using that provider may not work</li>
              <li>Keep your API keys secure and never share them publicly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeysManagement;
