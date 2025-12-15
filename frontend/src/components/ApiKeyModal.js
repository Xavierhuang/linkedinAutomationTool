import React, { useState, useEffect } from 'react';
import { X, Key, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ApiKeyModal = ({ isOpen, onClose, keyType, onSaved }) => {
  const { user } = useAuth();
  const tokens = useThemeTokens();
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
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: tokens.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        className="rounded-lg max-w-md w-full p-6 relative"
        style={{
          backgroundColor: tokens.colors.background.layer2,
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadow.floating
        }}
      >
        <button
          onClick={onClose}
          style={{ color: tokens.colors.text.secondary }}
          className="absolute top-4 right-4 hover:opacity-70 transition-opacity"
          onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div 
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#F59E0B20',
              borderRadius: tokens.radius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertCircle style={{ width: '24px', height: '24px', color: '#F59E0B' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontFamily.sans }}>
              {info.title}
            </h2>
            <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginTop: '4px' }}>
              {info.description}
            </p>
          </div>
        </div>

        <div 
          style={{
            backgroundColor: tokens.colors.accent.lime + '20',
            border: `1px solid ${tokens.colors.accent.lime}40`,
            borderRadius: tokens.radius.lg,
            padding: '12px'
          }}
        >
          <p style={{ fontSize: '14px', color: tokens.colors.text.primary }}>
            <strong>💡 Tip:</strong> This key works with OpenAI and Google AI models.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label style={{ color: tokens.colors.text.primary, marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: 500 }}>
              API Key
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={info.placeholder}
              style={{
                backgroundColor: tokens.colors.background.input,
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radius.lg,
                color: tokens.colors.text.primary,
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
              className="focus:outline-none transition-all"
              onFocus={(e) => {
                e.target.style.borderColor = tokens.colors.accent.lime;
                e.target.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = tokens.colors.border.default;
                e.target.style.boxShadow = 'none';
              }}
            />
            {error && (
              <p style={{ fontSize: '14px', color: '#EF4444', marginTop: '4px' }}>{error}</p>
            )}
          </div>

          <div style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
            Don't have an API key?{' '}
            <a
              href={info.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: tokens.colors.accent.lime }}
              className="hover:underline"
            >
              {info.linkText} →
            </a>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleGoToSettings}
              style={{
                flex: 1,
                backgroundColor: tokens.colors.background.input,
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radius.full,
                color: tokens.colors.text.primary,
                fontFamily: tokens.typography.fontFamily.sans,
                fontSize: '16px',
                fontWeight: 500,
                padding: '10px 24px'
              }}
              className="hover:opacity-80 transition-opacity"
            >
              Go to Settings
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                backgroundColor: tokens.colors.accent.lime,
                borderRadius: tokens.radius.full,
                color: tokens.colors.text.inverse,
                fontFamily: tokens.typography.fontFamily.sans,
                fontSize: '16px',
                fontWeight: 600,
                padding: '10px 24px',
                boxShadow: tokens.shadow.subtle
              }}
              className="hover:opacity-90 transition-opacity disabled:opacity-50"
              onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover)}
              onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = tokens.colors.accent.lime)}
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
