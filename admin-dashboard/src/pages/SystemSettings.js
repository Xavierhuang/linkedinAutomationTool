import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SystemSettings = () => {
  const tokens = useThemeTokens();
  const [settings, setSettings] = useState({
    free_tier_ai_tokens: 1000,
    free_tier_post_limit: 50,
    pro_tier_ai_tokens: 10000,
    pro_tier_post_limit: -1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/system/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.patch(`${API_URL}/api/admin/system/settings`, settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save settings',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent" style={{ borderColor: tokens.colors.accent.lime }}></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 animate-in fade-in duration-500">
        <p style={{ color: tokens.colors.text.secondary }}>Unable to load settings. Check backend connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>System Settings</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
          Configure system-wide settings and limits
        </p>
      </div>

      {message.text && (
        <div
          style={{
            borderRadius: tokens.radius.lg,
            padding: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}
          className="animate-in fade-in duration-300"
        >
          <AlertCircle
            style={{ width: '20px', height: '20px', flexShrink: 0, color: message.type === 'success' ? '#22c55e' : '#ef4444' }}
          />
          <p
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: message.type === 'success' ? '#22c55e' : '#ef4444'
            }}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Settings Form */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, padding: '24px' }} className="animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6">
          <div style={{ width: '40px', height: '40px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.lg }} className="flex items-center justify-center">
            <Settings style={{ width: '20px', height: '20px', color: tokens.colors.text.inverse }} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>Usage Limits</h2>
            <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, fontWeight: 300 }}>
              Configure default limits for each tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Tier */}
          <div className="space-y-4">
            <h3 style={{ fontWeight: 500, color: tokens.colors.text.primary, fontSize: '18px' }}>Free Tier</h3>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                AI Tokens per Month
              </label>
              <input
                type="number"
                value={settings.free_tier_ai_tokens}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    free_tier_ai_tokens: parseInt(e.target.value),
                  })
                }
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
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                Posts per Month
              </label>
              <input
                type="number"
                value={settings.free_tier_post_limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    free_tier_post_limit: parseInt(e.target.value),
                  })
                }
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
              />
            </div>
          </div>

          {/* Pro Tier */}
          <div className="space-y-4">
            <h3 style={{ fontWeight: 500, color: tokens.colors.text.primary, fontSize: '18px' }}>Pro Tier</h3>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                AI Tokens per Month
              </label>
              <input
                type="number"
                value={settings.pro_tier_ai_tokens}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pro_tier_ai_tokens: parseInt(e.target.value),
                  })
                }
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
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
                Posts per Month
              </label>
              <input
                type="number"
                value={settings.pro_tier_post_limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pro_tier_post_limit: parseInt(e.target.value),
                  })
                }
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
              />
              <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary, marginTop: '4px' }}>
                Use -1 for unlimited
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${tokens.colors.border.default}` }}>
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
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;

