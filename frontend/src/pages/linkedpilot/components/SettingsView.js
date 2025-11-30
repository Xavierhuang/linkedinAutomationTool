import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, Linkedin, LogOut, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BillingView from './BillingView';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SettingsView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tokens = useThemeTokens();
  const [activeTab, setActiveTab] = useState('profile');
  const [timezone, setTimezone] = useState('');
  const [detectedTimezone, setDetectedTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [saveStatus, setSaveStatus] = useState('');
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    title: '',
    company: '',
    location: '',
    website: '',
    bio: '',
    profile_image: ''
  });
  const [profileStatus, setProfileStatus] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinProfile, setLinkedinProfile] = useState(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  useEffect(() => {
    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetectedTimezone(userTimezone);
    
    if (user && activeTab === 'linkedin') {
      checkLinkedInConnection();
    }
    if (user && activeTab === 'profile') {
      fetchTimezonePreference();
      fetchProfile();
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

  const fetchProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/settings/profile`, {
        params: { user_id: user.id }
      });
      const data = response.data || {};
      setProfileForm({
        full_name: data.full_name || user?.full_name || '',
        title: data.title || '',
        company: data.company || '',
        location: data.location || '',
        website: data.website || '',
        bio: data.bio || '',
        profile_image: data.profile_image || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileInputChange = (field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm(prev => ({ ...prev, profile_image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfileImage = () => {
    setProfileForm(prev => ({ ...prev, profile_image: '' }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileStatus('saving');
    try {
      await axios.post(`${BACKEND_URL}/api/settings/profile`, {
        user_id: user.id,
        ...profileForm
      });
      setProfileStatus('saved');
      setTimeout(() => setProfileStatus(''), 2500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileStatus('error');
      setTimeout(() => setProfileStatus(''), 2500);
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
        const profile = response.data.linkedin_profile;
        setLinkedinProfile(profile);
        setProfileImageError(false); // Reset error state when profile is fetched
        
        // Debug: Log picture URL if available
        const picUrl = profile.picture || profile.pictureUrl || profile.picture_url || profile.profilePicture;
        if (picUrl) {
          console.log('LinkedIn profile picture URL:', picUrl);
        } else {
          console.warn('LinkedIn profile picture not found in profile data:', profile);
        }
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

  const renderProfileTab = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div
        style={{
          backgroundColor: tokens.colors.background.layer2,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radius.xl
        }}
        className="p-6 space-y-6"
      >
        <div className="flex flex-col gap-4 border-b pb-6" style={{ borderColor: tokens.colors.border.default }}>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                style={{
                  width: '112px',
                  height: '112px',
                  borderRadius: '50%',
                  backgroundColor: tokens.colors.background.app,
                  border: `1px solid ${tokens.colors.border.default}`,
                  overflow: 'hidden'
                }}
                className="flex items-center justify-center text-2xl font-semibold text-muted-foreground"
              >
                {profileForm.profile_image ? (
                  <img src={profileForm.profile_image} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (profileForm.full_name || user?.full_name || user?.email || '?')
                    .split(' ')
                    .map(word => word.charAt(0))
                    .slice(0, 2)
                    .join('')
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                {profileForm.profile_image && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveProfileImage}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleProfileImageUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Full Name</Label>
                <Input
                  value={profileForm.full_name}
                  onChange={(e) => handleProfileInputChange('full_name', e.target.value)}
                  style={{ backgroundColor: tokens.colors.background.app, borderColor: tokens.colors.border.default, color: tokens.colors.text.primary }}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Title</Label>
                <Input
                  value={profileForm.title}
                  onChange={(e) => handleProfileInputChange('title', e.target.value)}
                  style={{ backgroundColor: tokens.colors.background.app, borderColor: tokens.colors.border.default, color: tokens.colors.text.primary }}
                  placeholder="Role / Title"
                />
              </div>
              <div>
                <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Company / Organization</Label>
                <Input
                  value={profileForm.company}
                  onChange={(e) => handleProfileInputChange('company', e.target.value)}
                  style={{ backgroundColor: tokens.colors.background.app, borderColor: tokens.colors.border.default, color: tokens.colors.text.primary }}
                  placeholder="Company name"
                />
              </div>
              <div>
                <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Location</Label>
                <Input
                  value={profileForm.location}
                  onChange={(e) => handleProfileInputChange('location', e.target.value)}
                  style={{ backgroundColor: tokens.colors.background.app, borderColor: tokens.colors.border.default, color: tokens.colors.text.primary }}
                  placeholder="City, Country"
                />
              </div>
              <div className="md:col-span-2">
                <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Website</Label>
                <Input
                  value={profileForm.website}
                  onChange={(e) => handleProfileInputChange('website', e.target.value)}
                  style={{ backgroundColor: tokens.colors.background.app, borderColor: tokens.colors.border.default, color: tokens.colors.text.primary }}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>
          <div>
            <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">About</Label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => handleProfileInputChange('bio', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                backgroundColor: tokens.colors.background.app,
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radius.lg,
                padding: '12px 16px',
                color: tokens.colors.text.primary,
                fontFamily: tokens.typography.fontFamily.sans
              }}
              placeholder="Share a short bio or anything your team should know."
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: tokens.colors.text.tertiary }}>
              {profileStatus === 'saved' && 'Profile updated!'}
              {profileStatus === 'error' && 'Something went wrong. Please try again.'}
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={profileStatus === 'saving' || profileLoading}
              style={{ backgroundColor: tokens.colors.accent.lime, color: tokens.colors.text.inverse }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
            >
              {profileStatus === 'saving' ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Email Address</Label>
            <div style={{ backgroundColor: tokens.colors.background.app, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg }} className="flex items-center justify-between px-4 py-2">
              <span style={{ color: tokens.colors.text.primary }}>{user?.email}</span>
              <span style={{ fontSize: '12px', backgroundColor: tokens.colors.status.badge, color: tokens.colors.text.secondary }} className="px-2 py-1 rounded">
                Primary
              </span>
            </div>
          </div>

          <div>
            <Label style={{ color: tokens.colors.text.secondary }} className="mb-2 block">Your Timezone</Label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: tokens.colors.background.app,
                    border: `1px solid ${tokens.colors.border.default}`,
                    borderRadius: tokens.radius.lg,
                    padding: '8px 16px',
                    color: tokens.colors.text.primary,
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontSize: '14px',
                    appearance: 'none'
                  }}
                  className="outline-none"
                  onFocus={(e) => e.currentTarget.style.borderColor = tokens.colors.accent.lime}
                  onBlur={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
                >
                  {Intl.supportedValuesOf('timeZone').map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <Globe style={{ color: tokens.colors.text.tertiary }} className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
              </div>
              <Button 
                onClick={handleSaveTimezone}
                style={{ backgroundColor: tokens.colors.accent.lime, color: tokens.colors.text.inverse, minWidth: '100px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
              >
                {saveStatus === 'saved' ? 'Saved!' : 'Save'}
              </Button>
            </div>
            <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary }} className="mt-2">
              Current detected time: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: tokens.colors.background.layer2, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.xl }} className="p-6">
        <h3 style={{ color: tokens.colors.text.primary, fontSize: '18px', fontWeight: 500 }} className="mb-4">Account Actions</h3>
        <Button 
          onClick={handleLogout} 
          variant="destructive" 
          className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );


  const renderLinkedInTab = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div style={{ backgroundColor: tokens.colors.background.layer2, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.xl }} className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 style={{ color: tokens.colors.text.primary, fontSize: '18px', fontWeight: 500 }} className="mb-1">LinkedIn Connection</h3>
            <p style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
              Connect your personal profile to publish posts.
            </p>
          </div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: linkedinConnected ? '#10B981' : '#EF4444' }} />
        </div>

        {linkedinConnected ? (
          <div style={{ backgroundColor: tokens.colors.background.app, border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg }} className="p-4 mb-6">
            <div className="flex items-center gap-4">
              {(() => {
                const pictureUrl = linkedinProfile?.picture || linkedinProfile?.pictureUrl || linkedinProfile?.picture_url || linkedinProfile?.profilePicture;
                return pictureUrl ? `${BACKEND_URL}/api/settings/linkedin-profile-picture?user_id=${user.id}` : null;
              })() && !profileImageError ? (
                <img 
                  src={(() => {
                    const pictureUrl = linkedinProfile?.picture || linkedinProfile?.pictureUrl || linkedinProfile?.picture_url || linkedinProfile?.profilePicture;
                    return pictureUrl ? `${BACKEND_URL}/api/settings/linkedin-profile-picture?user_id=${user.id}` : null;
                  })()}
                  alt="LinkedIn Profile"
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  onError={() => {
                    console.warn('Failed to load LinkedIn profile picture:', linkedinProfile.picture || linkedinProfile.pictureUrl || linkedinProfile.picture_url || linkedinProfile.profilePicture);
                    setProfileImageError(true);
                  }}
                  onLoad={() => {
                    setProfileImageError(false);
                  }}
                />
              ) : (
                <div style={{ width: '48px', height: '48px', backgroundColor: '#0A66C2', borderRadius: '50%', display: 'flex' }} className="items-center justify-center text-white">
                  <Linkedin className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 style={{ fontWeight: 500, color: tokens.colors.text.primary }}>
                  {linkedinProfile ? (linkedinProfile.name || `${linkedinProfile.firstName || ''} ${linkedinProfile.lastName || ''}`.trim() || 'LinkedIn Profile') : 'Connected Profile'}
                </h4>
                <p style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>LinkedIn Account Active</p>
              </div>
              <Button 
                variant="outline" 
                style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }}
                className="ml-auto"
                onClick={handleDisconnectLinkedIn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = '#F87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#EF4444';
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: tokens.colors.background.app, border: `1px dashed ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg }} className="text-center py-8 mb-6">
            <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(10, 102, 194, 0.1)', color: '#0A66C2', borderRadius: '50%' }} className="flex items-center justify-center mx-auto mb-3">
              <Linkedin className="w-6 h-6" />
            </div>
            <h4 style={{ color: tokens.colors.text.primary, fontWeight: 500 }} className="mb-2">Not Connected</h4>
            <p style={{ color: tokens.colors.text.tertiary, fontSize: '14px' }} className="mb-4">Connect your LinkedIn account to start publishing.</p>
            <Button 
              onClick={handleConnectLinkedIn}
              disabled={linkedinLoading}
              style={{ backgroundColor: '#0A66C2', color: '#FFFFFF' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#004182')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#0A66C2')}
            >
              {linkedinLoading ? 'Connecting...' : 'Connect LinkedIn'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: tokens.colors.background.app, color: tokens.colors.text.primary }} className="h-full flex flex-col">
      {/* Header */}
      <div style={{ backgroundColor: tokens.colors.background.app, borderBottom: `1px solid ${tokens.colors.border.default}` }} className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ fontSize: '30px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }} className="mb-2">Settings</h1>
            <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, fontWeight: 300 }}>Manage your account and integrations</p>
          </div>
          <Button
            onClick={() => navigate('/onboarding')}
            style={{
              backgroundColor: tokens.colors.accent.lime,
              color: tokens.colors.text.inverse,
              fontFamily: tokens.typography.fontFamily.sans,
              fontWeight: 500
            }}
            className="rounded-full px-6 flex items-center gap-2"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
          >
            <Sparkles className="w-4 h-4" />
            Start New Onboarding
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div style={{ width: '256px', borderRight: `1px solid ${tokens.colors.border.default}`, backgroundColor: tokens.colors.background.layer1 }} className="p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: tokens.radius.lg,
                fontSize: '14px',
                fontWeight: 500,
                backgroundColor: activeTab === 'profile' ? tokens.colors.accent.lime : 'transparent',
                color: activeTab === 'profile' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                fontFamily: tokens.typography.fontFamily.sans
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'profile') {
                  e.currentTarget.style.color = tokens.colors.text.primary;
                  e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'profile') {
                  e.currentTarget.style.color = tokens.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('linkedin')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: tokens.radius.lg,
                fontSize: '14px',
                fontWeight: 500,
                backgroundColor: activeTab === 'linkedin' ? tokens.colors.accent.lime : 'transparent',
                color: activeTab === 'linkedin' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                fontFamily: tokens.typography.fontFamily.sans
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'linkedin') {
                  e.currentTarget.style.color = tokens.colors.text.primary;
                  e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'linkedin') {
                  e.currentTarget.style.color = tokens.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: tokens.radius.lg,
                fontSize: '14px',
                fontWeight: 500,
                backgroundColor: activeTab === 'billing' ? tokens.colors.accent.lime : 'transparent',
                color: activeTab === 'billing' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                fontFamily: tokens.typography.fontFamily.sans
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'billing') {
                  e.currentTarget.style.color = tokens.colors.text.primary;
                  e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'billing') {
                  e.currentTarget.style.color = tokens.colors.text.secondary;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div style={{ backgroundColor: tokens.colors.background.app }} className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'linkedin' && renderLinkedInTab()}
            {activeTab === 'billing' && <BillingView user={user} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
