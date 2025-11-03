import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Eye, EyeOff, Save, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const APIKeysManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('openai');
  const [keys, setKeys] = useState({
    openai_api_key: '',
    openrouter_api_key: '',
    anthropic_api_key: '',
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
    openrouter_api_key: false,
    anthropic_api_key: false,
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

  const getKeyStatus = (key) => {
    if (!keys[key] || keys[key].trim() === '') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'Access multiple AI models through one API',
      keys: [
        { id: 'openrouter_api_key', label: 'API Key', placeholder: 'sk-or-v1-...' }
      ]
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude models for content generation',
      keys: [
        { id: 'anthropic_api_key', label: 'API Key', placeholder: 'sk-ant-...' }
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
    }
  ];

  const activeProvider = providers.find(p => p.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys Management</h1>
        <p className="text-gray-600 mt-2">
          Configure system-wide API keys that will be used by all users. These keys are encrypted and stored securely.
        </p>
      </div>

      {/* Alert Banner */}
      {message.text && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
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
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {providers.map((provider) => {
              const hasAllKeys = provider.keys.every(k => keys[k.id] && keys[k.id].trim() !== '');
              const hasSomeKeys = provider.keys.some(k => keys[k.id] && keys[k.id].trim() !== '');
              
              return (
                <button
                  key={provider.id}
                  onClick={() => setActiveTab(provider.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === provider.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{provider.name}</span>
                  {hasAllKeys ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  ) : hasSomeKeys ? (
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeProvider && (
            <div className="space-y-6">
              {/* Provider Info */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{activeProvider.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{activeProvider.description}</p>
              </div>

              {/* API Key Fields */}
              <div className="space-y-4">
                {activeProvider.keys.map((key) => (
                  <div key={key.id}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {key.label}
                      </label>
                      <div className="flex items-center gap-2">
                        {getKeyStatus(key.id)}
                        <span className="text-xs text-gray-500">
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
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">How to get {activeProvider.name} API keys:</p>
                    {activeProvider.id === 'openai' && (
                      <p>Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenAI Platform</a> to create an API key. You'll need an OpenAI account with billing set up.</p>
                    )}
                    {activeProvider.id === 'openrouter' && (
                      <p>Visit <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenRouter</a> to create an API key. OpenRouter gives you access to multiple AI models (GPT-4, Claude, Gemini, etc.) through one unified API.</p>
                    )}
                    {activeProvider.id === 'anthropic' && (
                      <p>Visit <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Anthropic Console</a> to create an API key for Claude models. You'll need an Anthropic account with billing configured.</p>
                    )}
                    {activeProvider.id === 'google' && (
                      <p>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google AI Studio</a> to create an API key for Gemini models.</p>
                    )}
                    {activeProvider.id === 'linkedin' && (
                      <p>Visit <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline font-medium">LinkedIn Developers</a> to create an app and get your OAuth credentials.</p>
                    )}
                    {activeProvider.id === 'unsplash' && (
                      <p>Visit <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="underline font-medium">Unsplash Developers</a> to create an application and get your access key.</p>
                    )}
                    {activeProvider.id === 'pexels' && (
                      <p>Visit <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Pexels API</a> to create an account and generate an API key.</p>
                    )}
                    {activeProvider.id === 'canva' && (
                      <p>Visit <a href="https://www.canva.com/developers/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Canva Developers</a> to create an app and get your API key.</p>
                    )}
                    {activeProvider.id === 'stripe' && (
                      <div className="space-y-2">
                        <p>Visit <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Stripe Dashboard</a> to get your API keys.</p>
                        <ul className="list-disc list-inside space-y-1 text-sm ml-2">
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
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Keys'}
        </button>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-2">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
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
