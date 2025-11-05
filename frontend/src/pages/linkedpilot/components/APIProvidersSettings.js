import React, { useState } from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const APIProvidersSettings = ({ 
  apiKeys, 
  setApiKeys, 
  showKeys, 
  setShowKeys,
  apiProvider,
  setApiProvider 
}) => {
  const [activeTab, setActiveTab] = useState('openrouter');
  
  const toggleKeyVisibility = (keyName) => {
    setShowKeys({ ...showKeys, [keyName]: !showKeys[keyName] });
  };

  const tabs = [
    { id: 'openrouter', label: 'OpenRouter', recommended: true },
    { id: 'openai', label: 'OpenAI' },
    { id: 'claude', label: 'Claude' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'stock_images', label: 'Stock Images' },
    { id: 'canva', label: 'Canva' },
    { id: 'models', label: 'Model Selection' }
  ];

  return (
    <div className="space-y-4">
      <style>{`
        .api-settings input,
        .api-settings select {
          color: #1A1A1A !important;
          background-color: #FFFFFF !important;
        }
        .api-settings input::placeholder {
          color: #9CA3AF !important;
        }
      `}</style>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">API Keys & Configuration</h2>
        <p className="text-sm text-gray-600 mb-4">
          Configure your AI provider API keys for content generation and image creation.
        </p>
      </div>

      {/* Horizontal Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.recommended && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  Recommended
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="api-settings pt-4">
        {activeTab === 'openrouter' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">OpenRouter API Key</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              OpenRouter provides access to multiple AI models including Claude, GPT-4, and more.
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Get your API key
              </a>
            </p>
            <div className="relative">
              <Input
                type={showKeys.openrouter_api_key ? 'text' : 'password'}
                value={apiKeys.openrouter_api_key || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, openrouter_api_key: e.target.value })}
                placeholder="sk-or-v1-..."
                className="pr-10"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('openrouter_api_key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKeys.openrouter_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'openai' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">OpenAI API Key</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              For GPT-4 and GPT-3.5 models directly from OpenAI.
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Get your API key
              </a>
            </p>
            <div className="relative">
              <Input
                type={showKeys.openai_api_key ? 'text' : 'password'}
                value={apiKeys.openai_api_key || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, openai_api_key: e.target.value })}
                placeholder="sk-..."
                className="pr-10"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('openai_api_key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKeys.openai_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'claude' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Anthropic Claude API Key</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              For Claude models directly from Anthropic.
              <a 
                href="https://console.anthropic.com/settings/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Get your API key
              </a>
            </p>
            <div className="relative">
              <Input
                type={showKeys.anthropic_api_key ? 'text' : 'password'}
                value={apiKeys.anthropic_api_key || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, anthropic_api_key: e.target.value })}
                placeholder="sk-ant-..."
                className="pr-10"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('anthropic_api_key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKeys.anthropic_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'gemini' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Google Gemini API Key</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              For Gemini models and image generation from Google AI.
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Get your API key
              </a>
            </p>
            <div className="relative">
              <Input
                type={showKeys.google_ai_api_key ? 'text' : 'password'}
                value={apiKeys.google_ai_api_key || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, google_ai_api_key: e.target.value })}
                placeholder="AIza..."
                className="pr-10"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('google_ai_api_key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKeys.google_ai_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stock_images' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Stock Image APIs</h3>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                Free & Fast
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Add API keys for free stock photos from Unsplash or Pexels. These are used as the default image source (much faster than AI generation).
            </p>

            {/* Unsplash API Key */}
            <div className="space-y-3">
              <div>
                <Label className="text-gray-700 mb-1 block text-sm font-medium">Unsplash Access Key</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Recommended - High quality photos, 50 requests/hour free.
                  <a 
                    href="https://unsplash.com/developers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    Get API key
                  </a>
                </p>
                <div className="relative">
                  <Input
                    type={showKeys.unsplash_access_key ? 'text' : 'password'}
                    value={apiKeys.unsplash_access_key || ''}
                    onChange={(e) => setApiKeys({ ...apiKeys, unsplash_access_key: e.target.value })}
                    placeholder="Enter Unsplash Access Key"
                    className="pr-10"
                    style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility('unsplash_access_key')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKeys.unsplash_access_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Pexels API Key */}
              <div>
                <Label className="text-gray-700 mb-1 block text-sm font-medium">Pexels API Key</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Alternative/Backup - Generous free tier.
                  <a 
                    href="https://www.pexels.com/api/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    Get API key
                  </a>
                </p>
                <div className="relative">
                  <Input
                    type={showKeys.pexels_api_key ? 'text' : 'password'}
                    value={apiKeys.pexels_api_key || ''}
                    onChange={(e) => setApiKeys({ ...apiKeys, pexels_api_key: e.target.value })}
                    placeholder="Enter Pexels API Key"
                    className="pr-10"
                    style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility('pexels_api_key')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKeys.pexels_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                <p className="text-xs text-blue-800">
                  <strong>💡 Tip:</strong> If no API keys are provided, the system will automatically fall back to AI image generation (slower but still works).
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'canva' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Canva API Key</h3>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                Optional
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              For Canva design integration (optional).
              <a 
                href="https://www.canva.com/developers/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Learn more
              </a>
            </p>
            <div className="relative">
              <Input
                type={showKeys.canva_api_key ? 'text' : 'password'}
                value={apiKeys.canva_api_key || ''}
                onChange={(e) => setApiKeys({ ...apiKeys, canva_api_key: e.target.value })}
                placeholder="Enter Canva API key"
                className="pr-10"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              />
              <button
                type="button"
                onClick={() => toggleKeyVisibility('canva_api_key')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKeys.canva_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Model Preferences</h3>
            
            <div>
              <Label className="text-gray-700 mb-2 block text-sm">Text Generation Model</Label>
              <select
                value={apiKeys.text_model || 'anthropic/claude-3.5-sonnet'}
                onChange={(e) => setApiKeys({ ...apiKeys, text_model: e.target.value })}
                className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              >
                <optgroup label="Claude (Anthropic)">
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Recommended)</option>
                  <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
                  <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                </optgroup>
                <optgroup label="GPT (OpenAI)">
                  <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="openai/gpt-4">GPT-4</option>
                  <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Gemini (Google)">
                  <option value="google/gemini-pro">Gemini Pro</option>
                  <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                </optgroup>
              </select>
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block text-sm">Image Generation Model</Label>
              <select
                value={apiKeys.image_model || 'google/gemini-2.5-flash-image'}
                onChange={(e) => setApiKeys({ ...apiKeys, image_model: e.target.value })}
                className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              >
                <optgroup label="Google Gemini">
                  <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash (Recommended)</option>
                  <option value="google/gemini-2.0-flash-exp">Gemini 2.0 Flash Experimental</option>
                </optgroup>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> OpenRouter is recommended as it provides access to all models through a single API key.
        </p>
      </div>
    </div>
  );
};

export default APIProvidersSettings;
