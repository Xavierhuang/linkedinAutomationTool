import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import TextOverlayModalKonva from './TextOverlayModalKonva';
import { Loader, ArrowLeft } from 'lucide-react';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const TextEditorPage = () => {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const tokens = useThemeTokens();
  
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [initialElements, setInitialElements] = useState([]);
  const [campaignData, setCampaignData] = useState(null);
  const [error, setError] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        // New project - check navigation state first (fastest), then token, then legacy params
        const navigationState = location.state;
        const tokenParam = searchParams.get('token');
        const imageParam = searchParams.get('image'); // Legacy support
        const elementsParam = searchParams.get('elements'); // Legacy support
        
        // Check navigation state first (instant - no API call needed)
        if (navigationState && navigationState.image_url) {
          console.log('[TextEditorPage] Loading from navigation state (instant)');
          setImageUrl(navigationState.image_url);
          setInitialElements(Array.isArray(navigationState.elements) ? navigationState.elements : []);
          // Merge org_id from navigation state into campaign_data if not present
          const campaignDataWithOrgId = navigationState.campaign_data || {};
          if (navigationState.org_id && !campaignDataWithOrgId.org_id) {
            campaignDataWithOrgId.org_id = navigationState.org_id;
          }
          setCampaignData(campaignDataWithOrgId);
          setLoading(false);
          
          // Clear navigation state to prevent re-loading on refresh
          navigate(location.pathname + location.search, { replace: true, state: {} });
          return;
        }
        
        // Try token (short permalink system)
        if (tokenParam) {
          try {
            console.log('[TextEditorPage] Loading session from token:', tokenParam);
            const sessionResponse = await axios.get(`${BACKEND_URL}/api/text-editor/sessions/${tokenParam}`);
            const sessionData = sessionResponse.data;
            
            setImageUrl(sessionData.image_url);
            const elementsArray = Array.isArray(sessionData.elements) ? sessionData.elements : [];
            setInitialElements(elementsArray);
            setCampaignData(sessionData.campaign_data || null);
            console.log('[TextEditorPage] Loaded session data:', {
              imageUrl: sessionData.image_url?.substring(0, 50),
              elementsCount: elementsArray.length,
              elements: elementsArray.map(el => ({
                text: el.text?.substring(0, 30),
                hasBbox: !!el.bbox_percent,
                hasBboxPixels: !!el.bbox,
                font_size: el.font_size,
                is_baked_in: el.is_baked_in
              }))
            });
            setLoading(false);
            return;
          } catch (error) {
            console.error('[TextEditorPage] Failed to load session:', error);
            setError(error.response?.data?.detail || 'Failed to load session. It may have expired.');
            setLoading(false);
            return;
          }
        }
        
        // Legacy support: direct image/elements params (for backwards compatibility)
        if (imageParam) {
          setImageUrl(imageParam);
          if (elementsParam) {
            try {
              const decoded = decodeURIComponent(elementsParam);
              const elements = JSON.parse(decoded);
              console.log('[TextEditorPage] Loaded elements from URL (legacy):', elements.length, 'elements');
              setInitialElements(Array.isArray(elements) ? elements : []);
            } catch (e) {
              console.error('[TextEditorPage] Failed to parse elements:', e);
              console.error('[TextEditorPage] Elements param:', elementsParam?.substring(0, 200));
              setInitialElements([]);
            }
          } else {
            console.log('[TextEditorPage] No elements param provided');
            setInitialElements([]);
          }
          setLoading(false);
          return;
        }
        
        setError('No session token or image URL provided');
        setLoading(false);
        return;
      }

      // Load existing project
      try {
        const response = await axios.get(`${BACKEND_URL}/api/text-editor/projects/${projectId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const project = response.data;
        setProjectData(project);
        setImageUrl(project.image_url);
        setInitialElements(project.elements || []);
        setCampaignData(project.campaign_data || null);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError(err.response?.data?.detail || 'Failed to load project');
        setLoading(false);
      }
    };

    if (user) {
      loadProject();
    }
  }, [projectId, searchParams, user]);

  const handleSave = async (elements, dataURL) => {
    if (!user) {
      alert('Please log in to save drafts');
      return;
    }
    try {
      // Get org_id from campaignData, location state, or user context (same as BeeBot)
      const orgId = campaignData?.org_id || location.state?.org_id || user?.org_id || null;
      
      if (!orgId) {
        alert('Organization ID is required to save drafts. Please ensure you are part of an organization.');
        return;
      }

      // Format draft data exactly like BeeBot handleSaveDraft
      let assets = [];
      let mode = 'text';
      
      if (imageUrl) {
        mode = 'image';
        assets = [{ 
          type: 'image', 
          url: imageUrl,
          textOverlays: elements // Store overlay data with asset (same as BeeBot)
        }];
      }

      const draftData = {
        id: campaignData?.draft_id || `draft_${Date.now()}`,
        org_id: orgId,
        author_id: user.id,
        mode: mode,
        content: {
          body: campaignData?.content?.body || campaignData?.body || '',
          hashtags: campaignData?.content?.hashtags || campaignData?.hashtags || []
        },
        assets: assets,
        status: 'draft',
        linkedin_author_type: campaignData?.linkedin_author_type || 'personal',
        linkedin_author_id: campaignData?.linkedin_author_id || null
      };

      if (campaignData?.draft_id) {
        // Update existing draft
        await axios.put(
          `${BACKEND_URL}/api/drafts/${campaignData.draft_id}`,
          draftData
        );
        alert('Draft updated successfully!');
      } else {
        // Create new draft (same endpoint as BeeBot)
        const response = await axios.post(
          `${BACKEND_URL}/api/drafts`,
          draftData
        );
        alert('Draft saved successfully!');
        
        // Update campaignData with new draft_id for future updates
        if (response.data?.id) {
          setCampaignData(prev => ({ ...prev, draft_id: response.data.id }));
        }
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
      alert('Failed to save draft: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleClose = () => {
    setIsEditorOpen(false);
    // Navigate back to the page the user came from
    // First try to use referrer from state, then fall back to browser history
    if (location.state?.referrer) {
      navigate(location.state.referrer);
    } else {
      // Use browser history to go back to previous page
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: tokens?.colors?.background?.app || '#000000',
        color: tokens?.colors?.text?.primary || '#FFFFFF'
      }}>
        <Loader className="animate-spin" size={32} />
        <span style={{ marginLeft: '16px' }}>Loading editor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: tokens?.colors?.background?.app || '#000000',
        color: tokens?.colors?.text?.primary || '#FFFFFF',
        padding: '32px'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Error</h1>
        <p style={{ marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            backgroundColor: tokens?.colors?.accent?.lime || '#00FF00',
            color: '#000000',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: tokens?.colors?.background?.app || '#000000',
        color: tokens?.colors?.text?.primary || '#FFFFFF'
      }}>
        <h1>No image provided</h1>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <TextOverlayModalKonva
        isOpen={isEditorOpen}
        onClose={handleClose}
        imageUrl={imageUrl}
        initialElements={initialElements}
        campaignData={campaignData}
        onApply={handleSave}
        standaloneMode={true}
      />
    </div>
  );
};

export default TextEditorPage;






