import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Linkedin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function SettingsButton({ className }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [linkedinProfile, setLinkedinProfile] = useState(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (user) {
      checkLinkedInConnection();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkLinkedInConnection = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
      
      const isConnected = response.data.linkedin_connected || false;
      setLinkedinConnected(isConnected);
      
      if (isConnected && response.data.linkedin_profile) {
        const profile = response.data.linkedin_profile;
        setLinkedinProfile(profile);
        setImageError(false); // Reset error state when profile is fetched
        
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
      setLinkedinConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    navigate('/dashboard/settings');
  };

  // Only show when user is authenticated
  if (!user) {
    return null;
  }

  // Use proxy URL to avoid CORS issues, fallback to direct URL
  const pictureUrl = linkedinProfile?.picture || linkedinProfile?.pictureUrl || linkedinProfile?.picture_url || linkedinProfile?.profilePicture;
  const profilePicture = pictureUrl ? `${BACKEND_URL}/api/settings/linkedin-profile-picture?user_id=${user.id}` : null;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      className={cn(
        "fixed top-4 right-16 z-50 h-10 w-10 rounded-full shadow-lg",
        "bg-background/80 backdrop-blur-sm border-border",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-all duration-200",
        className
      )}
      aria-label="Settings"
    >
      {!loading && linkedinConnected && profilePicture && !imageError ? (
        <img 
          src={profilePicture}
          alt="Profile"
          className="w-full h-full rounded-full object-cover"
          onError={() => {
            console.warn('Failed to load LinkedIn profile picture:', profilePicture);
            setImageError(true);
          }}
          onLoad={() => {
            setImageError(false);
          }}
        />
      ) : (
        <div 
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: '#0A66C2'
          }}
        >
          {linkedinConnected ? (
            <Linkedin className="w-5 h-5 text-white" />
          ) : (
            <Settings className="w-5 h-5" />
          )}
        </div>
      )}
    </Button>
  );
}

