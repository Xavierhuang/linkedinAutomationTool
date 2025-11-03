import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SystemSettings = () => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Unable to load settings. Check backend connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure system-wide settings and limits
        </p>
      </div>

      {message.text && (
        <div
          className={`rounded-lg p-4 flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 flex-shrink-0 ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          />
          <p
            className={`text-sm font-medium ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Usage Limits</h2>
            <p className="text-sm text-gray-600">
              Configure default limits for each tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Tier */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Free Tier</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Pro Tier */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Pro Tier</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use -1 for unlimited
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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

