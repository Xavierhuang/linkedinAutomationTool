import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Bell, CreditCard, Linkedin, LogOut, Globe, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BillingView from './BillingView';
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
    // Stock Images
    unsplash_access_key: '',
    pexels_api_key: '',
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
    canva_api_key: false,
    unsplash_access_key: false,
    pexels_api_key: false
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
    try {
      // Check user-level LinkedIn connection
      const response = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
      const isConnected = response.data.linkedin_connected;
      setLinkedinConnected(isConnected);
      
      // Set profile info if connected
      if (isConnected && response.data.linkedin_profile) {
        setLinkedinProfile(response.data.linkedin_profile);
      }
    } catch (error) {
      console.error('Error checking LinkedIn connection:', error);
    }
  };

  const handleConnectLinkedIn = async () => {
    setLinkedinLoading(true);
    try {
      // Connect at user level (no org_id needed)
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/auth/start?user_id=${user.id}`);
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
          console.log('[LinkedIn OAuth] Message received:', event.data);
          if (event.data.type === 'linkedin-oauth-success') {
            console.log('[LinkedIn OAuth] Success message received');
            popup?.close();
            window.removeEventListener('message', messageListener);
            // Check connection status and update UI
            setTimeout(async () => {
              await checkLinkedInConnection();
              setLinkedinLoading(false);
              alert('✅ LinkedIn connected successfully!');
            }, 500);
          } else if (event.data.type === 'linkedin-oauth-error') {
            console.log('[LinkedIn OAuth] Error message received:', event.data.error);
            popup?.close();
            window.removeEventListener('message', messageListener);
            // Don't show error yet - check actual connection status first
            // Sometimes OAuth succeeds but message fails
            setTimeout(async () => {
              await checkLinkedInConnection();
              setLinkedinLoading(false);
              // Only show error if still not connected
              const status = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
              if (!status.data.linkedin_connected) {
                alert('❌ LinkedIn connection failed. Please try again.');
              } else {
                alert('✅ LinkedIn connected successfully!');
              }
            }, 1000);
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

        // Monitor popup close and check connection status
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            console.log('[LinkedIn OAuth] Popup closed');
            clearInterval(pollTimer);
            window.removeEventListener('message', messageListener);
            // Check if LinkedIn was actually connected (popup may have closed before message was sent)
            setTimeout(async () => {
              console.log('[LinkedIn OAuth] Checking connection status after popup close...');
              await checkLinkedInConnection();
              setLinkedinLoading(false);
              console.log('[LinkedIn OAuth] Connection check complete');
            }, 1500);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error starting LinkedIn auth:', error);
      alert('Failed to initiate LinkedIn connection. Please try again.');
      setLinkedinLoading(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!window.confirm('Are you sure you want to disconnect your LinkedIn account?')) {
      return;
    }
    
    try {
      // Disconnect at user level (will also disconnect all organizations)
      const orgId = selectedOrgId || localStorage.getItem('selectedOrgId');
      if (orgId) {
        await axios.post(`${BACKEND_URL}/api/organizations/${orgId}/disconnect-linkedin`);
      }
      
      // Immediately update UI state
      setLinkedinConnected(false);
      setLinkedinProfile(null);
      
      // Verify disconnect was successful by checking status after a short delay
      setTimeout(async () => {
        await checkLinkedInConnection();
      }, 500);
      
      alert('✅ LinkedIn disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      alert('Failed to disconnect LinkedIn');
      // Re-check status in case of error
      setTimeout(async () => {
        await checkLinkedInConnection();
      }, 500);
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
    { id: 'linkedin', label: 'LinkedIn Connection', icon: Linkedin },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header - Responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50 text-sm px-3 py-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Content - Responsive */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <div className="flex flex-col md:grid md:grid-cols-4 gap-4 md:gap-8">
            {/* Tabs - Horizontal scroll on mobile, sidebar on desktop */}
            <div className="md:col-span-1">
              <nav className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitScrollbarDisplay: 'none' }}>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap md:w-full ${
                        activeTab === tab.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content - Responsive padding */}
            <div className="md:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
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


                {activeTab === 'linkedin' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">LinkedIn Connection</h2>
                      <p className="text-sm text-gray-600 mb-6">Connect your LinkedIn account to publish posts and manage engagement.</p>
                    </div>

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
                          </div>
                        )}
                      </div>
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

                {activeTab === 'billing' && (
                  <BillingView />
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