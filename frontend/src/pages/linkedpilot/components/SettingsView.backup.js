import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, CreditCard, Linkedin, Globe, Key, Eye, EyeOff, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import APIProvidersSettings from './APIProvidersSettings';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SettingsView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [apiProvider, setApiProvider] = useState('openrouter'); // openrouter, openai, claude, gemini
  const [timezone, setTimezone] = useState('');
  const [detectedTimezone, setDetectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [apiKeys, setApiKeys] = useState({
    // OpenRouter
    openrouter_api_key: '',
    // OpenAI
    openai_api_key: '',
    // Claude/Anthropic
    anthropic_api_key: '',
    // Google Gemini
    google_ai_api_key: '',
    // LinkedIn
    linkedin_client_id: '',
    linkedin_client_secret: '',
    // Canva
    canva_api_key: '',
    // Model preferences
    text_model: 'anthropic/claude-3.5-sonnet',
    image_model: 'google/gemini-2.5-flash-image',
    content_generation_model: 'anthropic/claude-3.5-sonnet'
  });
  const [showKeys, setShowKeys] = useState({
    openrouter_api_key: false,
    openai_api_key: false,
    anthropic_api_key: false,
    google_ai_api_key: false,
    linkedin_client_id: false,
    linkedin_client_secret: false,
    canva_api_key: false
  });
  const [saveStatus, setSaveStatus] = useState('');
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinProfile, setLinkedinProfile] = useState(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  useEffect(() => {
    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetectedTimezone(userTimezone);
    
    if (user && activeTab === 'apikeys') {
      fetchApiKeys();
    }
    if (user && activeTab === 'linkedin') {
      fetchApiKeys(); // Load API keys for LinkedIn credentials
      checkLinkedInConnection();
    }
    if (user && activeTab === 'profile') {
      fetchTimezonePreference();
    }
    
    // Get selected org from localStorage
    const orgId = localStorage.getItem('selectedOrgId');
    setSelectedOrgId(orgId);
  }, [user, activeTab]);
  
  const fetchTimezonePreference = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/settings/timezone?user_id=${user.id}`);
      const savedTimezone = response.data.timezone;
      if (savedTimezone && savedTimezone.trim() !== '') {
        setTimezone(savedTimezone);
      } else {
        // If no timezone saved, use detected and auto-save it
        setTimezone(detectedTimezone);
        await axios.post(`${BACKEND_URL}/api/settings/timezone`, {
          user_id: user.id,
          timezone: detectedTimezone
        });
        console.log('Auto-saved detected timezone:', detectedTimezone);
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
      setTimezone(detectedTimezone); // Fallback to detected
    }
  };
  
  const handleSaveTimezone = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/settings/timezone`, {
        user_id: user.id,
        timezone: timezone
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving timezone:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/settings/api-keys?user_id=${user.id}`);
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const handleSaveApiKeys = async () => {
    setSaveStatus('saving');
    try {
      // Filter out unchanged masked values (don't save '***')
      const keysToSave = { ...apiKeys };
      
      // Remove masked values - they haven't been changed
      Object.keys(keysToSave).forEach(key => {
        if (keysToSave[key] === '***' || keysToSave[key] === '********') {
          delete keysToSave[key];
        }
      });
      
      console.log('💾 Saving API keys:', {
        user_id: user.id,
        keys: Object.keys(keysToSave).filter(k => k !== 'user_id')
      });
      
      await axios.post(`${BACKEND_URL}/api/settings/api-keys`, {
        user_id: user.id,
        ...keysToSave
      });
      
      console.log('✅ API keys saved successfully!');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('❌ Error saving API keys:', error);
      console.error('Error details:', error.response?.data);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const checkLinkedInConnection = async () => {
    if (!selectedOrgId) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/organizations/${selectedOrgId}`);
      const org = response.data;
      const isConnected = !!org.linkedin_access_token;
      setLinkedinConnected(isConnected);
      
      // Fetch LinkedIn profile info if connected
      if (isConnected) {
        try {
          const profileResponse = await axios.get(`${BACKEND_URL}/api/linkedin/profile?org_id=${selectedOrgId}`);
          setLinkedinProfile(profileResponse.data);
        } catch (error) {
          console.error('Error fetching LinkedIn profile:', error);
        }
      }
    } catch (error) {
      console.error('Error checking LinkedIn connection:', error);
    }
  };

  const handleConnectLinkedIn = async () => {
    if (!selectedOrgId) {
      alert('Please select an organization first');
      return;
    }

    setLinkedinLoading(true);
    try {
      // Pass user_id to use user-specific LinkedIn credentials
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/auth/start?org_id=${selectedOrgId}&user_id=${user.id}`);
      const authUrl = response.data.auth_url;
      
      // Check if it's a full URL (real LinkedIn) or relative path (mock)
      if (authUrl.startsWith('http')) {
        // Real LinkedIn OAuth - Open in popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          authUrl,
          'LinkedIn Authorization',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for callback message
        const messageListener = (event) => {
          if (event.data.type === 'linkedin-oauth-success') {
            popup?.close();
            setLinkedinConnected(true);
            checkLinkedInConnection();
            window.removeEventListener('message', messageListener);
            alert('✅ LinkedIn connected successfully!');
          } else if (event.data.type === 'linkedin-oauth-error') {
            popup?.close();
            window.removeEventListener('message', messageListener);
            alert('❌ LinkedIn connection failed. Please try again.');
          }
        };

        window.addEventListener('message', messageListener);

        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          alert('Popup blocked! Please allow popups for this site and try again.');
          setLinkedinLoading(false);
          window.removeEventListener('message', messageListener);
          return;
        }

        // Monitor popup close
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
            setLinkedinLoading(false);
          }
        }, 500);
      } else {
        // Mock mode - direct redirect
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error('Error starting LinkedIn auth:', error);
      alert('Failed to initiate LinkedIn connection. Please try again.');
      setLinkedinLoading(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!selectedOrgId) return;

    try {
      await axios.post(`${BACKEND_URL}/api/organizations/${selectedOrgId}/disconnect-linkedin`);
      setLinkedinConnected(false);
      alert('✅ LinkedIn disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      alert('Failed to disconnect LinkedIn');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'linkedin', label: 'LinkedIn Connection', icon: Linkedin },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Tabs Sidebar */}
            <div className="md:col-span-1">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="md:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
                      <p className="text-sm text-gray-600 mb-6">Your personal information and profile details.</p>
                    </div>

                    {/* User Info Card */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-2xl">
                            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{user?.full_name || 'User'}</h3>
                          <p className="text-sm text-gray-600">{user?.email || 'No email'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-700 mb-2 block text-sm font-medium">Full Name</Label>
                        <Input
                          value={user?.full_name || ''}
                          readOnly
                          className="bg-gray-50 border-gray-300"
                        />
                      </div>

                      <div>
                        <Label className="text-gray-700 mb-2 block text-sm font-medium">Email Address</Label>
                        <Input
                          value={user?.email || ''}
                          readOnly
                          className="bg-gray-50 border-gray-300"
                        />
                      </div>

                      {/* Timezone Setting */}
                      <div className="pt-6 border-t border-gray-200">
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Timezone Preference
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            All times in the calendar and scheduler will use this timezone
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-900">
                              <strong>Auto-detected:</strong> {detectedTimezone || 'UTC'}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Current local time: {detectedTimezone ? new Date().toLocaleTimeString('en-US', { 
                                timeZone: detectedTimezone,
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              }) : new Date().toLocaleTimeString('en-US', { 
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                          </div>
                          
                          <div>
                            <Label className="text-gray-700 mb-2 block text-sm font-medium">Select Timezone</Label>
                            <select
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                              className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                            >
                              <option value="">-- Select Timezone --</option>
                              <optgroup label="Africa">
                                <option value="Africa/Nairobi">East Africa Time (Nairobi) - UTC+3</option>
                                <option value="Africa/Cairo">Egypt (Cairo) - UTC+2</option>
                                <option value="Africa/Johannesburg">South Africa (Johannesburg) - UTC+2</option>
                                <option value="Africa/Lagos">West Africa (Lagos) - UTC+1</option>
                              </optgroup>
                              <optgroup label="Americas">
                                <option value="America/New_York">Eastern Time (New York) - UTC-5</option>
                                <option value="America/Chicago">Central Time (Chicago) - UTC-6</option>
                                <option value="America/Denver">Mountain Time (Denver) - UTC-7</option>
                                <option value="America/Los_Angeles">Pacific Time (Los Angeles) - UTC-8</option>
                                <option value="America/Toronto">Toronto - UTC-5</option>
                                <option value="America/Mexico_City">Mexico City - UTC-6</option>
                                <option value="America/Sao_Paulo">São Paulo - UTC-3</option>
                              </optgroup>
                              <optgroup label="Europe">
                                <option value="Europe/London">London (GMT) - UTC+0</option>
                                <option value="Europe/Paris">Paris (CET) - UTC+1</option>
                                <option value="Europe/Berlin">Berlin (CET) - UTC+1</option>
                                <option value="Europe/Rome">Rome (CET) - UTC+1</option>
                                <option value="Europe/Madrid">Madrid (CET) - UTC+1</option>
                                <option value="Europe/Amsterdam">Amsterdam (CET) - UTC+1</option>
                                <option value="Europe/Moscow">Moscow - UTC+3</option>
                              </optgroup>
                              <optgroup label="Asia">
                                <option value="Asia/Dubai">Dubai - UTC+4</option>
                                <option value="Asia/Karachi">Karachi - UTC+5</option>
                                <option value="Asia/Kolkata">India (Kolkata) - UTC+5:30</option>
                                <option value="Asia/Dhaka">Bangladesh (Dhaka) - UTC+6</option>
                                <option value="Asia/Bangkok">Bangkok - UTC+7</option>
                                <option value="Asia/Singapore">Singapore - UTC+8</option>
                                <option value="Asia/Hong_Kong">Hong Kong - UTC+8</option>
                                <option value="Asia/Shanghai">Shanghai - UTC+8</option>
                                <option value="Asia/Tokyo">Tokyo - UTC+9</option>
                                <option value="Asia/Seoul">Seoul - UTC+9</option>
                              </optgroup>
                              <optgroup label="Australia & Pacific">
                                <option value="Australia/Sydney">Sydney - UTC+10</option>
                                <option value="Australia/Melbourne">Melbourne - UTC+10</option>
                                <option value="Australia/Perth">Perth - UTC+8</option>
                                <option value="Pacific/Auckland">Auckland - UTC+12</option>
                              </optgroup>
                            </select>
                          </div>
                          
                          <Button 
                            onClick={handleSaveTimezone}
                            className="bg-gray-900 text-white hover:bg-gray-800"
                          >
                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Timezone'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'apikeys' && (
                  <>
                    <APIProvidersSettings
                      apiKeys={apiKeys}
                      setApiKeys={setApiKeys}
                      showKeys={showKeys}
                      setShowKeys={setShowKeys}
                      apiProvider={apiProvider}
                      setApiProvider={setApiProvider}
                    />
                    
                    {/* Save Button */}
                    <div className="pt-6">
                      <Button
                        onClick={handleSaveApiKeys}
                        disabled={saveStatus === 'saving'}
                        className="bg-gray-900 text-white hover:bg-gray-800"
                      >
                        {saveStatus === 'saving' ? 'Saving...' : 'Save API Keys'}
                      </Button>
                      {saveStatus === 'success' && (
                        <span className="ml-3 text-sm text-green-600 font-medium">✓ Saved successfully!</span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="ml-3 text-sm text-red-600 font-medium">✗ Failed to save. Please try again.</span>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'linkedin' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">LinkedIn Connection</h2>
                      <p className="text-sm text-gray-600 mb-6">Connect your LinkedIn account to publish posts and manage engagement.</p>
                    </div>

                    {/* LinkedIn OAuth Configuration */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Linkedin className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-blue-900 mb-2">LinkedIn OAuth Credentials</h3>
                          <p className="text-sm text-blue-700 mb-4">
                            To enable LinkedIn posting, you need to create a LinkedIn App and provide your OAuth credentials. 
                            <a 
                              href="https://www.linkedin.com/developers/apps" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="underline font-medium ml-1 hover:text-blue-900"
                            >
                              Get credentials →
                            </a>
                          </p>
                          
                          <div className="space-y-3">
                            <div>
                              <Label className="text-blue-900 mb-1.5 block text-sm font-medium">Client ID</Label>
                              <Input
                                type={showKeys.linkedin ? 'text' : 'password'}
                                value={apiKeys.linkedin_client_id || ''}
                                onChange={(e) => setApiKeys({ ...apiKeys, linkedin_client_id: e.target.value })}
                                placeholder="Enter your LinkedIn Client ID"
                                className="bg-white border-blue-300 text-gray-900 placeholder:text-gray-400"
                              />
                            </div>
                            <div>
                              <Label className="text-blue-900 mb-1.5 block text-sm font-medium">Client Secret</Label>
                              <div className="relative">
                                <Input
                                  type={showKeys.linkedin ? 'text' : 'password'}
                                  value={apiKeys.linkedin_client_secret || ''}
                                  onChange={(e) => setApiKeys({ ...apiKeys, linkedin_client_secret: e.target.value })}
                                  placeholder="Enter your LinkedIn Client Secret"
                                  className="bg-white border-blue-300 text-gray-900 placeholder:text-gray-400 pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys({ ...showKeys, linkedin: !showKeys.linkedin })}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                  {showKeys.linkedin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="pt-2">
                              <Button
                                onClick={handleSaveApiKeys}
                                disabled={saveStatus === 'saving'}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {saveStatus === 'saving' ? 'Saving...' : 'Save LinkedIn Credentials'}
                              </Button>
                              {saveStatus === 'success' && (
                                <span className="ml-3 text-sm text-green-600 font-medium">✓ Saved!</span>
                              )}
                              {saveStatus === 'error' && (
                                <span className="ml-3 text-sm text-red-600 font-medium">✗ Error!</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!selectedOrgId && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          ⚠️ Please select an organization first to connect LinkedIn.
                        </p>
                        <Button 
                          onClick={() => window.location.href = '/dashboard/organizations'}
                          className="mt-3 bg-gray-900 hover:bg-gray-800 text-white text-sm"
                        >
                          Go to Organizations
                        </Button>
                      </div>
                    )}

                    {selectedOrgId && (
                      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Linkedin className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">LinkedIn Account</h3>
                            <p className="text-sm text-gray-600">
                              {linkedinConnected ? (
                                <span className="text-green-600 font-medium">✓ Connected</span>
                              ) : (
                                'Not connected'
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {linkedinConnected ? (
                          <div className="space-y-3">
                            {linkedinProfile && (
                              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                                <div className="flex items-center gap-3">
                                  {linkedinProfile.picture ? (
                                    <img 
                                      src={linkedinProfile.picture} 
                                      alt={linkedinProfile.name}
                                      className="w-12 h-12 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-blue-600 font-semibold text-lg">
                                        {linkedinProfile.name?.charAt(0) || 'L'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{linkedinProfile.name || 'LinkedIn User'}</p>
                                    {linkedinProfile.email && (
                                      <p className="text-sm text-gray-600">{linkedinProfile.email}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-sm text-green-800">
                                ✓ Your LinkedIn account is connected. You can now publish posts directly to LinkedIn.
                              </p>
                            </div>
                            <Button 
                              onClick={handleDisconnectLinkedIn}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Disconnect LinkedIn Account
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Button 
                              onClick={handleConnectLinkedIn}
                              disabled={linkedinLoading}
                              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                            >
                              {linkedinLoading ? 'Opening LinkedIn...' : 'Connect LinkedIn Account'}
                            </Button>
                            <p className="text-xs text-gray-500 mt-3">
                              A popup will open to authorize access to your LinkedIn organization page.
                            </p>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                              <h4 className="font-semibold text-blue-900 mb-2 text-sm">📋 Setup Instructions</h4>
                              <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
                                <li>Go to the <strong>API Keys</strong> tab above and configure your LinkedIn OAuth credentials (Client ID and Secret)</li>
                                <li>Create a LinkedIn App at <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline font-medium">LinkedIn Developers</a></li>
                                <li>In your LinkedIn App settings, add these OAuth redirect URLs:
                                  <div className="mt-1 ml-4">
                                    <code className="bg-blue-100 px-2 py-1 rounded block text-[10px] break-all">
                                      {window.location.origin}/api/linkedin/callback
                                    </code>
                                  </div>
                                </li>
                                <li>Request these OAuth scopes in your LinkedIn App:
                                  <ul className="ml-4 mt-1 space-y-0.5">
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">openid</code> - User authentication</li>
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">profile</code> - Basic profile info</li>
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">email</code> - User email</li>
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">w_member_social</code> - Post as user</li>
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">r_organization_admin</code> - Read org data</li>
                                    <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">w_organization_social</code> - Post to org pages</li>
                                  </ul>
                                </li>
                                <li>Copy your Client ID and Client Secret to the API Keys tab above</li>
                                <li>Save your API keys, then return here to connect your LinkedIn account</li>
                              </ol>
                            </div>
                            
                            {apiKeys.linkedin_client_id && apiKeys.linkedin_client_secret ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                                <h4 className="font-semibold text-green-900 mb-2 text-sm">✅ Ready to Connect</h4>
                                <p className="text-xs text-green-800">
                                  Your LinkedIn OAuth credentials are configured. Click the button above to connect your account.
                                </p>
                              </div>
                            ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                                <h4 className="font-semibold text-amber-900 mb-2 text-sm">⚠️ LinkedIn Credentials Required</h4>
                              <p className="text-xs text-amber-800">
                                  Please configure your LinkedIn OAuth credentials in the <strong>API Keys</strong> tab above before connecting. 
                                  Without them, the app will use mock mode for testing only.
                              </p>
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
                      <p className="text-sm text-gray-600 mb-6">Configure how you receive notifications about your posts and engagement.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">Post Published</h4>
                          <p className="text-sm text-gray-600">Get notified when your scheduled posts are published</p>
                        </div>
                        <input type="checkbox" className="w-5 h-5 text-gray-900" defaultChecked />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">New Comments</h4>
                          <p className="text-sm text-gray-600">Get notified when someone comments on your posts</p>
                        </div>
                        <input type="checkbox" className="w-5 h-5 text-gray-900" defaultChecked />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">Performance Reports</h4>
                          <p className="text-sm text-gray-600">Weekly summary of your post performance</p>
                        </div>
                        <input type="checkbox" className="w-5 h-5 text-gray-900" />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button className="bg-gray-900 text-white hover:bg-gray-800">
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
                      <p className="text-sm text-gray-600 mb-6">Manage your password and security preferences.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-700 mb-2 block text-sm font-medium">Current Password</Label>
                        <Input type="password" placeholder="Enter current password" className="border-gray-300" />
                      </div>

                      <div>
                        <Label className="text-gray-700 mb-2 block text-sm font-medium">New Password</Label>
                        <Input type="password" placeholder="Enter new password" className="border-gray-300" />
                      </div>

                      <div>
                        <Label className="text-gray-700 mb-2 block text-sm font-medium">Confirm New Password</Label>
                        <Input type="password" placeholder="Confirm new password" className="border-gray-300" />
                      </div>

                      <div className="pt-4">
                        <Button disabled className="bg-gray-900 text-white hover:bg-gray-800">
                          Update Password
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">Password management coming soon</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing & Subscription</h2>
                      <p className="text-sm text-gray-600 mb-6">Manage your subscription and billing information.</p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Current Plan</h3>
                          <p className="text-sm text-gray-600">Free Trial</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        You're currently on the free trial. Upgrade to unlock unlimited posts and advanced features.
                      </p>
                      <Button className="bg-gray-900 text-white hover:bg-gray-800">
                        Upgrade Plan
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;