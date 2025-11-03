import React, { useState, useEffect } from 'react';
import { X, Key, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ApiKeyModal = ({ isOpen, onClose, keyType, onSaved }) => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const keyInfo = {
    openai: {
      title: 'OpenAI API Key Required',
      description: 'This feature requires an OpenAI API key for AI content generation.',
      link: 'https://platform.openai.com/api-keys',
      linkText: 'Get your API key from OpenAI',
      placeholder: 'sk-...',
      field: 'openai_api_key'
    },
    linkedin: {
      title: 'LinkedIn OAuth Required',
      description: 'This feature requires LinkedIn OAuth credentials to publish posts.',
      link: 'https://www.linkedin.com/developers/apps',
      linkText: 'Create a LinkedIn App',
      placeholder: 'Client ID and Secret',
      field: 'linkedin'
    }
  };

  const info = keyInfo[keyType] || keyInfo.openai;

  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        [info.field]: apiKey
      };

      await axios.post(`${BACKEND_URL}/api/settings/api-keys`, payload);
      
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving API key:', err);
      setError('Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGoToSettings = () => {
    window.location.href = '/dashboard/settings';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{info.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{info.description}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-900 mb-2">
            <strong>💡 Tip:</strong> This key works across OpenAI, Anthropic, and Google models through OpenRouter.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-700 mb-2 block text-sm font-medium">
              API Key
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={info.placeholder}
              className="border-gray-300 font-mono text-sm"
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>

          <div className="text-sm text-gray-600">
            Don't have an API key?{' '}
            <a
              href={info.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {info.linkText} →
            </a>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleGoToSettings}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
            >
              Go to Settings
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
