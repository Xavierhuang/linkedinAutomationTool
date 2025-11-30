import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeTokens } from '@/hooks/useThemeTokens';
import axios from 'axios';
import {
  Loader2,
  Globe,
  FileText,
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Target,
  Calendar,
  ChevronRight,
  Linkedin,
  Palette,
  Type,
  Image as ImageIcon,
  Edit3,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BrandIdentityCard from '../conversation/BrandIdentityCard';
import BrandDNAEditModal from './BrandDNAEditModal';
import CampaignConfigModal from '../CampaignConfigModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const OnboardingFlow = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Step completion tracking
  const [completedSteps, setCompletedSteps] = useState({
    step1: false, // LinkedIn connection
    step2: false, // Business DNA input
    step3: false, // Brand analysis
    step4: false, // Campaign selection
    step5: false  // Topic approval & post generation
  });

  // Get step from URL hash or default to 1
  const getStepFromHash = () => {
    const hash = location.hash.replace('#', '');
    if (hash.startsWith('step')) {
      const stepNum = parseInt(hash.replace('step', ''));
      return isNaN(stepNum) ? 1 : Math.max(1, Math.min(5, stepNum));
    }
    return 1;
  };

  const [step, setStep] = useState(getStepFromHash());
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // Prevent double-clicks on all actions

  // Step 1: LinkedIn
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  // Step 2: Business DNA Input
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [orgId, setOrgId] = useState(null);

  // Step 3: Brand Identity Review
  const [analysisData, setAnalysisData] = useState(null);
  const [brandInfo, setBrandInfo] = useState(null);
  const [scrapedImages, setScrapedImages] = useState([]);
  const [heroImage, setHeroImage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'identity', or 'audience'

  // Step 4: Campaign Selection
  const [campaignPreviews, setCampaignPreviews] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [generatedCampaign, setGeneratedCampaign] = useState(null);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState(null); // Store the saved campaign ID

  // Step 5: Topic Approval & Post Generation
  const [topics, setTopics] = useState([]);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // Prevent double-clicks
  const [postsGenerated, setPostsGenerated] = useState(false); // Track if posts are generated

  // Edit modals
  const [showBrandDNAEditModal, setShowBrandDNAEditModal] = useState(false);
  const [showCampaignEditModal, setShowCampaignEditModal] = useState(false);
  const [editingCampaignData, setEditingCampaignData] = useState(null);

  // Theme tokens for theme-aware styling
  const tokens = useThemeTokens();

  // State Persistence - Load from localStorage and IndexedDB
  useEffect(() => {
    const loadState = async () => {
      // Load essential data from localStorage
    const savedState = localStorage.getItem('onboardingState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.orgId) setOrgId(parsed.orgId);
        if (parsed.completedSteps) setCompletedSteps(parsed.completedSteps);
        if (parsed.savedCampaignId) setSavedCampaignId(parsed.savedCampaignId);
        if (parsed.websiteUrl) setWebsiteUrl(parsed.websiteUrl);
        if (parsed.description) setDescription(parsed.description);
      } catch (e) {
          console.error('Failed to load onboarding state from localStorage:', e);
          localStorage.removeItem('onboardingState');
        }
      }
      
      // Load large objects from IndexedDB if available
      if (typeof indexedDB !== 'undefined') {
        try {
          const dbName = 'onboardingStateDB';
          const dbVersion = 1;
          const request = indexedDB.open(dbName, dbVersion);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create stores if they don't exist (for initial setup)
            if (!db.objectStoreNames.contains('analysisData')) {
              db.createObjectStore('analysisData');
            }
            if (!db.objectStoreNames.contains('brandInfo')) {
              db.createObjectStore('brandInfo');
            }
            if (!db.objectStoreNames.contains('campaignPreviews')) {
              db.createObjectStore('campaignPreviews');
            }
            if (!db.objectStoreNames.contains('generatedCampaign')) {
              db.createObjectStore('generatedCampaign');
            }
            if (!db.objectStoreNames.contains('topics')) {
              db.createObjectStore('topics');
            }
          };
          
          request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Helper function to safely load from a store
            const loadFromStore = (storeName, setter) => {
              if (!db.objectStoreNames.contains(storeName)) {
                return;
              }
              try {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const getRequest = store.get('current');
                getRequest.onsuccess = () => {
                  if (getRequest.result) {
                    setter(getRequest.result);
                  }
                };
                getRequest.onerror = () => {
                  console.warn(`Failed to load ${storeName} from IndexedDB`);
                };
              } catch (error) {
                console.warn(`Error loading ${storeName} from IndexedDB:`, error);
              }
            };
            
            // Load each object store
            // Note: Campaign previews will be cleared when a new org is created
            loadFromStore('analysisData', setAnalysisData);
            loadFromStore('brandInfo', setBrandInfo);
            // Don't auto-load campaign previews - they should be generated fresh for each org
            // loadFromStore('campaignPreviews', setCampaignPreviews);
            // loadFromStore('generatedCampaign', setGeneratedCampaign);
            // loadFromStore('topics', setTopics);
          };
          
          request.onerror = () => {
            console.warn('IndexedDB not available for loading state');
          };
        } catch (indexedDBError) {
          console.warn('Failed to load from IndexedDB:', indexedDBError);
        }
      }
    };
    
    loadState();
  }, []);

  // Clear campaign data when orgId changes (new organization)
  useEffect(() => {
    if (orgId) {
      // When orgId is set, ensure we don't have stale campaign data
      // This handles the case where orgId changes from one onboarding to another
      const savedOrgId = localStorage.getItem('onboardingState') 
        ? JSON.parse(localStorage.getItem('onboardingState'))?.orgId 
        : null;
      
      if (savedOrgId && savedOrgId !== orgId) {
        console.log(`🔄 OrgId changed from ${savedOrgId} to ${orgId} - clearing old campaigns`);
        setCampaignPreviews([]);
        setGeneratedCampaign(null);
        setSelectedCampaign(null);
        setTopics([]);
      }
    }
  }, [orgId]);

  // Save state on change with increased capacity using IndexedDB for large data
  useEffect(() => {
    const saveState = async () => {
      try {
        // Save essential data to localStorage
        const essentialState = {
      orgId,
      completedSteps,
      savedCampaignId,
      websiteUrl,
          description,
          hasAnalysisData: !!analysisData,
          hasBrandInfo: !!brandInfo,
          campaignPreviewsCount: campaignPreviews?.length || 0,
          generatedCampaignName: generatedCampaign?.name || null,
          topicsCount: topics?.length || 0
        };
        
        const essentialString = JSON.stringify(essentialState);
        
        // Save essential data to localStorage (should be small)
        localStorage.setItem('onboardingState', essentialString);
        
        // Save large objects to IndexedDB if available
        if (typeof indexedDB !== 'undefined') {
          try {
            const dbName = 'onboardingStateDB';
            const dbVersion = 1;
            
            const request = indexedDB.open(dbName, dbVersion);
            
            request.onerror = () => {
              console.warn('IndexedDB open failed, skipping large data storage');
            };
            
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              
              // Create all object stores during upgrade
              if (!db.objectStoreNames.contains('analysisData')) {
                db.createObjectStore('analysisData');
              }
              if (!db.objectStoreNames.contains('brandInfo')) {
                db.createObjectStore('brandInfo');
              }
              if (!db.objectStoreNames.contains('campaignPreviews')) {
                db.createObjectStore('campaignPreviews');
              }
              if (!db.objectStoreNames.contains('generatedCampaign')) {
                db.createObjectStore('generatedCampaign');
              }
              if (!db.objectStoreNames.contains('topics')) {
                db.createObjectStore('topics');
              }
            };
            
            request.onsuccess = (event) => {
              const db = event.target.result;
              
              // Check if stores exist before using them
              const storesToSave = [];
              
              if (db.objectStoreNames.contains('analysisData') && analysisData) {
                storesToSave.push({ name: 'analysisData', data: analysisData });
              }
              
              if (db.objectStoreNames.contains('brandInfo') && brandInfo) {
                storesToSave.push({ name: 'brandInfo', data: brandInfo });
              }
              
              if (db.objectStoreNames.contains('campaignPreviews') && campaignPreviews && campaignPreviews.length > 0) {
                storesToSave.push({ name: 'campaignPreviews', data: campaignPreviews });
              }
              
              if (db.objectStoreNames.contains('generatedCampaign') && generatedCampaign) {
                storesToSave.push({ name: 'generatedCampaign', data: generatedCampaign });
              }
              
              if (db.objectStoreNames.contains('topics') && topics && topics.length > 0) {
                storesToSave.push({ name: 'topics', data: topics });
              }
              
              // Save each object in its own transaction
              storesToSave.forEach(({ name, data }) => {
                try {
                  const transaction = db.transaction([name], 'readwrite');
                  const store = transaction.objectStore(name);
                  store.put(data, 'current');
                } catch (storeError) {
                  console.warn(`Failed to save ${name} to IndexedDB:`, storeError);
                }
              });
            };
          } catch (indexedDBError) {
            console.warn('IndexedDB save failed, continuing without large data storage:', indexedDBError);
          }
        }
      } catch (error) {
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          console.warn('LocalStorage quota exceeded, saving minimal data only');
          try {
            // Clear old onboarding state
            localStorage.removeItem('onboardingState');
            // Save only the most essential data
            const minimalState = {
              orgId,
              completedSteps,
              savedCampaignId
            };
            localStorage.setItem('onboardingState', JSON.stringify(minimalState));
          } catch (retryError) {
            console.error('Failed to save onboarding state:', retryError);
          }
        } else {
          console.error('Error saving onboarding state:', error);
        }
      }
    };
    
    saveState();
  }, [orgId, completedSteps, analysisData, brandInfo, campaignPreviews, generatedCampaign, savedCampaignId, topics, websiteUrl, description]);

  // Track if we're programmatically updating step to prevent hashchange handler from interfering
  const isProgrammaticUpdate = useRef(false);

  // Sync URL hash with step changes
  const updateStep = (newStep, skipValidation = false) => {
    // Validate step can be accessed (skip validation when called programmatically after completing a step)
    if (!skipValidation && newStep > 1 && !canAccessStep(newStep)) {
      alert('Please complete previous steps before proceeding.');
      return;
    }

    // Mark as programmatic update to prevent hashchange handler from reverting
    isProgrammaticUpdate.current = true;
    
    // Update step and hash
    setStep(newStep);
    window.location.hash = `step${newStep}`;
    
    // Reset flag after state update completes
    setTimeout(() => {
      isProgrammaticUpdate.current = false;
    }, 0);
  };

  // Check if a step can be accessed (all previous steps must be completed)
  const canAccessStep = (targetStep) => {
    if (targetStep === 1) return true;

    const stepKeys = ['step1', 'step2', 'step3', 'step4', 'step5'];
    for (let i = 1; i < targetStep; i++) {
      if (!completedSteps[stepKeys[i - 1]]) {
        return false;
      }
    }
    return true;
  };

  // Listen to hash changes
  useEffect(() => {
    const handleHashChange = () => {
      // Skip if this is a programmatic update
      if (isProgrammaticUpdate.current) {
        return;
      }

      const hash = window.location.hash.replace('#', '');
      let newStep = 1;
      if (hash.startsWith('step')) {
        const stepNum = parseInt(hash.replace('step', ''));
        newStep = isNaN(stepNum) ? 1 : Math.max(1, Math.min(5, stepNum));
      }

      if (newStep !== step) {
        const stepKeys = ['step1', 'step2', 'step3', 'step4', 'step5'];
        let canAccess = true;
        if (newStep > 1) {
          for (let i = 1; i < newStep; i++) {
            if (!completedSteps[stepKeys[i - 1]]) {
              canAccess = false;
              break;
            }
          }
        }

        if (canAccess) {
          // Mark as programmatic to prevent infinite loop
          isProgrammaticUpdate.current = true;
          setStep(newStep);
          setTimeout(() => {
            isProgrammaticUpdate.current = false;
          }, 0);
        } else {
          // Revert to current step if trying to skip
          isProgrammaticUpdate.current = true;
          window.location.hash = `step${step}`;
          setTimeout(() => {
            isProgrammaticUpdate.current = false;
          }, 0);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [step, completedSteps, location.hash]);

  // Check if user has already completed onboarding - redirect to dashboard
  useEffect(() => {
    if (user && user.onboarding_completed) {
      console.log('User has already completed onboarding, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Initialize hash on mount
  useEffect(() => {
    if (!location.hash) {
      window.location.hash = 'step1';
    }
  }, []);

  // Initialize - Check LinkedIn Status (Organization will be created during brand analysis)
  useEffect(() => {
    const init = async () => {
      // Don't initialize if user has completed onboarding
      if (user && user.onboarding_completed) {
        return;
      }
      
      try {
        // Clear old campaign data when starting a new onboarding (step 1)
        // This ensures fresh campaigns for each new brand
        if (step === 1) {
          console.log('🔄 Starting new onboarding - clearing old campaign data');
          setCampaignPreviews([]);
          setGeneratedCampaign(null);
          setSelectedCampaign(null);
          setTopics([]);
          
          // Clear campaign-related IndexedDB stores for fresh start
          if (typeof indexedDB !== 'undefined') {
            try {
              const dbName = 'onboardingStateDB';
              const request = indexedDB.open(dbName, 1);
              request.onsuccess = (event) => {
                const db = event.target.result;
                const campaignStores = ['campaignPreviews', 'generatedCampaign', 'topics'];
                campaignStores.forEach(storeName => {
                  if (db.objectStoreNames.contains(storeName)) {
                    const tx = db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    store.clear();
                    console.log(`✅ Cleared ${storeName} from IndexedDB`);
                  }
                });
                db.close();
              };
            } catch (e) {
              console.error('Failed to clear IndexedDB:', e);
            }
          }
        }
        
        // Check LinkedIn Status
        const liStatus = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
        const isConnected = liStatus.data.linkedin_connected;
        setLinkedinConnected(isConnected);

        // Mark step 1 as completed if LinkedIn is already connected
        if (isConnected) {
          setCompletedSteps(prev => ({ ...prev, step1: true }));
        }

        // Note: Organization will be created automatically during brand analysis
        // Each brand analysis creates its own organization for that specific brand
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    if (user) init();
  }, [user, step]);

  const handleConnectLinkedIn = async () => {
    setLinkedinLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/linkedin/auth/start?user_id=${user.id}`);
      const authUrl = response.data.auth_url;

      if (authUrl.startsWith('http')) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          'LinkedIn Authorization',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        const messageListener = (event) => {
          if (event.data.type === 'linkedin-oauth-success') {
            popup?.close();
            window.removeEventListener('message', messageListener);
            setLinkedinConnected(true);
            setLinkedinLoading(false);
            setCompletedSteps(prev => ({ ...prev, step1: true }));
          }
        };
        window.addEventListener('message', messageListener);
      }
    } catch (error) {
      console.error('LinkedIn auth error:', error);
      setLinkedinLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const normalizeUrl = (url) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const discoverBrandAttributes = async (url) => {
    try {
      // First create org to get org_id, then pass it for API key retrieval
      // Actually, we'll pass org_id after org is created - but for now try without
      const response = await axios.post(`${BACKEND_URL}/api/brand/discover`, { url });
      console.log('Brand discovery response:', response.data);
      if (response.data.brand_story) {
        console.log('✅ Brand DNA analysis completed:', {
          story: response.data.brand_story?.substring(0, 100),
          personality: response.data.brand_personality,
          values: response.data.core_values
        });
      } else {
        console.warn('⚠️ Brand DNA analysis not found in response');
      }
      return response.data;
    } catch (error) {
      console.error('Brand discovery failed:', error);
      console.error('Error details:', error.response?.data);
      return null;
    }
  };

  const createOrganizationFromBrand = async (websiteUrl, brandTitle) => {
    try {
      // Always create a NEW organization for each brand analysis
      // Each website/brand gets its own organization

      // Ensure we always have a valid name
      const orgName = brandTitle ||
        (websiteUrl ? new URL(websiteUrl).hostname.replace('www.', '') : null) ||
        `${user.full_name}'s Organization`;

      const createRes = await axios.post(`${BACKEND_URL}/api/organizations`, {
        name: orgName,  // Required field - never null
        website: websiteUrl,
        description: brandTitle ? `Organization for ${brandTitle}` : undefined,
        created_by: user.id
      });

      console.log('✅ New organization created:', createRes.data);
      console.log('   Name:', orgName);
      console.log('   Website:', websiteUrl);

      return createRes.data;
    } catch (error) {
      console.error('Organization creation failed:', error);
      throw error;
    }
  };

  const analyzeBrand = async () => {
    // Prevent double-clicks
    if (isProcessing || loading) {
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setLoadingMessage('Discovering your brand identity...');

    try {
      let normalizedUrl = null;
      let discoveredBrand = null;
      let organization = null;

      // Step 1: Brand Discovery (if URL provided)
      if (websiteUrl) {
        normalizedUrl = normalizeUrl(websiteUrl);

        if (normalizedUrl) {
          setLoadingMessage('Extracting brand identity from website...');
          discoveredBrand = await discoverBrandAttributes(normalizedUrl);

          if (discoveredBrand) {
            console.log('✅ Brand Discovery Complete:', discoveredBrand);
            console.log(`   - Colors: ${discoveredBrand.color_palette?.length || 0}`);
            console.log(`   - Fonts: ${discoveredBrand.font_families?.length || 0}`);
            console.log(`   - Images: ${discoveredBrand.imagery?.length || 0}`);
            if (discoveredBrand.imagery?.length > 0) {
              console.log('   - Imagery URLs:');
              discoveredBrand.imagery.forEach((img, i) => console.log(`     ${i + 1}. ${img}`));
            }
            // Log brand DNA if available
            if (discoveredBrand.brand_story) {
              console.log('   - Brand DNA Analysis Complete');
              console.log(`     Brand Story: ${discoveredBrand.brand_story?.substring(0, 100)}...`);
              console.log(`     Personality: ${discoveredBrand.brand_personality?.join(', ')}`);
              console.log(`     Core Values: ${discoveredBrand.core_values?.join(', ')}`);
            }
          }
        }
      }

      // Step 2: Create NEW Organization for this brand analysis
      setLoadingMessage('Creating organization from brand...');
      organization = await createOrganizationFromBrand(
        normalizedUrl,
        discoveredBrand?.title
      );
      setOrgId(organization.id);
      console.log('Organization created with ID:', organization.id);
      
      // Clear old campaign previews when creating a new organization
      // This ensures we don't show campaigns from previous onboarding
      setCampaignPreviews([]);
      setGeneratedCampaign(null);
      setSelectedCampaign(null);
      setTopics([]);
      console.log('🔄 Cleared old campaign data for new organization');

      // Step 2.5: Save brand DNA if available
      if (discoveredBrand && organization.id) {
        try {
          const brandDnaData = {
            brand_story: discoveredBrand.brand_story,
            brand_personality: discoveredBrand.brand_personality || [],
            core_values: discoveredBrand.core_values || [],
            target_audience_description: discoveredBrand.target_audience_description,
            unique_selling_points: discoveredBrand.unique_selling_points || [],
            key_messages: discoveredBrand.key_messages || [],
          };
          
          // Only save if we have brand DNA data
          if (brandDnaData.brand_story || brandDnaData.brand_personality?.length > 0) {
            setLoadingMessage('Saving brand DNA...');
            await axios.post(`${BACKEND_URL}/api/organization-materials/save-brand-dna`, brandDnaData, {
              params: { org_id: organization.id }
            });
            console.log('✅ Brand DNA saved to database');
          }
        } catch (err) {
          console.error('Failed to save brand DNA (non-critical):', err);
          // Don't fail the whole flow if brand DNA save fails
        }
      }

      // Step 3: Add website as material and extract content
      let materialId = null;
      if (normalizedUrl) {
        setLoadingMessage('Adding website materials...');
        const addMaterialRes = await axios.post(`${BACKEND_URL}/api/organization-materials/add-url`, null, {
          params: {
            org_id: organization.id,
            url: normalizedUrl,
            material_type: 'website'
          }
        });

        materialId = addMaterialRes.data?.id;

        // Step 4: Extract content explicitly (deep extraction)
        if (materialId) {
          setLoadingMessage('Extracting content from website...');
          try {
            await axios.post(`${BACKEND_URL}/api/organization-materials/extract-content/${materialId}`);
          } catch (err) {
            console.error('Content extraction failed:', err);
          }
        }
      }

      // Step 5: Upload additional files
      if (files.length > 0) {
        setLoadingMessage('Processing uploaded documents...');
        for (const file of files) {
          const formData = new FormData();
          formData.append('org_id', organization.id);
          formData.append('file', file);
          await axios.post(`${BACKEND_URL}/api/organization-materials/upload`, formData);
        }
      }

      // Step 6: Add description as material
      if (description) {
        setLoadingMessage('Processing business description...');
        const blob = new Blob([description], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('org_id', organization.id);
        formData.append('file', blob, 'business_description.txt');
        await axios.post(`${BACKEND_URL}/api/organization-materials/upload`, formData);
      }

      // Step 7: Run AI Brand Analysis
      setLoadingMessage('Analyzing brand with AI...');
      const analyzeRes = await axios.post(`${BACKEND_URL}/api/organization-materials/analyze`, null, {
        params: { org_id: organization.id }
      });

      // Step 8: Merge brand discovery + analysis data
      const analysis = analyzeRes.data;
      setAnalysisData(analysis);

      // Create brand info object for BrandIdentityCard
      if (discoveredBrand) {
        const brandCardData = {
          title: discoveredBrand.title || organization.name,
          description: analysis?.key_messages?.slice(0, 2).join(' • ') || discoveredBrand.description || 'Brand summary',
          colorPalette: discoveredBrand.color_palette || [],
          fontFamilies: discoveredBrand.font_families || [],
          imagery: discoveredBrand.imagery || [],
          toneKeywords: analysis?.brand_tone || discoveredBrand.tone_keywords || [],
          keywordSummary: discoveredBrand.keyword_summary || [],
          contentExcerpt: analysis?.value_propositions?.slice(0, 2).join(' • ') || discoveredBrand.content_excerpt,
          normalizedUrl: discoveredBrand.normalized_url || normalizedUrl,
          websiteUrl: normalizedUrl,
        };
        setBrandInfo(brandCardData);
        console.log('📊 Brand Info for Card:', {
          title: brandCardData.title,
          colors: brandCardData.colorPalette.length,
          fonts: brandCardData.fontFamilies.length,
          images: brandCardData.imagery.length,
          websiteUrl: brandCardData.websiteUrl
        });

        // Also set hero image and scraped images for backward compatibility
        if (discoveredBrand.imagery?.length > 0) {
          setHeroImage(discoveredBrand.imagery[0]);
          setScrapedImages(discoveredBrand.imagery.slice(1));
          console.log(`🖼️  Hero Image: ${discoveredBrand.imagery[0]}`);
        }
      }

      setCompletedSteps(prev => ({ ...prev, step2: true }));

      // Smooth transition to next step
      setTimeout(() => {
        updateStep(3, true); // Skip validation since we just completed step 2
      }, 300);
    } catch (error) {
      console.error('Brand analysis failed:', error);

      // Show detailed error message
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      alert(`Brand analysis failed: ${errorMessage}\n\nPlease try again. If the issue persists, check that:\n1. The website URL is accessible\n2. MongoDB is running\n3. API keys are configured`);

      // Reset to allow retry
      setLoading(false);
      setLoadingMessage('');
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const generateCampaigns = async () => {
    // Prevent double-clicks
    if (isProcessing || loading) {
      return;
    }

    // Validate orgId exists
    if (!orgId) {
      console.error('❌ generateCampaigns: orgId is missing');
      alert('Organization ID is missing. Please go back to Step 2 and try again.');
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setLoadingMessage('Generating campaign strategies...');

    try {
      // Clear any old campaign previews before generating new ones
      setCampaignPreviews([]);
      setGeneratedCampaign(null);
      setSelectedCampaign(null);
      
      console.log(`📊 Generating campaigns for org_id: ${orgId}`);
      
      // Use the same endpoint as dashboard - generates full campaign previews
      const suggestions = Array.isArray(analysisData?.suggested_campaigns)
        ? analysisData.suggested_campaigns.map((item, index) => ({
          name: item.name || `Campaign ${index + 1}`,
          description: item.description,
          focus: item.focus,
        }))
        : [];

      const response = await axios.post(`${BACKEND_URL}/api/brand/campaign-previews`, {
        org_id: orgId,
        count: 3,
        suggestions,
      });

      const campaigns = response.data?.campaigns || [];
      if (campaigns.length === 0) {
        throw new Error('No campaign previews generated');
      }

      console.log(`✅ Generated ${campaigns.length} campaigns for org_id: ${orgId}`);
      console.log('Campaign names:', campaigns.map(c => c.name));

      setCampaignPreviews(campaigns);
      setCompletedSteps(prev => ({ ...prev, step3: true }));

      // Smooth transition to next step
      setTimeout(() => {
        updateStep(4, true); // Skip validation since we just completed step 3
      }, 300);
    } catch (error) {
      console.error('Campaign preview generation failed:', error);
      alert('Failed to generate campaign previews. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectCampaign = async (campaign) => {
    // Campaign preview already has all details, just show detail view
    // Ensure loading states are cleared when selecting a campaign
    setLoading(false);
    setIsProcessing(false);
    setLoadingMessage('');
    setSelectedCampaign(campaign);
    setGeneratedCampaign(campaign);
    setIsEditingCampaign(true);
  };

  const approveCampaign = async () => {
    // Prevent double-clicks
    if (isProcessing || loading) {
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setLoadingMessage('Saving campaign...');

    try {
      // Validate user and orgId
      if (!user || !user.id) {
        console.error('❌ approveCampaign: User not found');
        throw new Error('User session not found. Please refresh the page and try again.');
      }

      if (!orgId) {
        console.error('❌ approveCampaign: orgId is missing');
        throw new Error('Organization ID is missing. Please go back to Step 2 and try again.');
      }

      // Validate generatedCampaign exists
      if (!generatedCampaign) {
        console.error('❌ approveCampaign: generatedCampaign is null/undefined');
        throw new Error('No campaign selected. Please select a campaign first.');
      }

      console.log('✅ approveCampaign: Saving campaign:', generatedCampaign.name);

      // Convert tone_voice from preview format to enum format
      const toneVoiceMap = {
        'professional': 'professional',
        'casual': 'casual',
        'thought-leader': 'thought-leader',
        'storytelling': 'storytelling'
      };
      const toneVoice = toneVoiceMap[generatedCampaign.tone_voice?.toLowerCase()] || 'professional';

      // Convert posting_schedule from preview format to Campaign format
      let postingSchedule = generatedCampaign.posting_schedule;
      
      // Validate and normalize posting_schedule
      if (!postingSchedule || typeof postingSchedule !== 'object') {
        postingSchedule = {
          frequency: 'daily',
          time_slots: ['09:00']
        };
      } else {
        // Ensure frequency is valid
        if (!postingSchedule.frequency || typeof postingSchedule.frequency !== 'string') {
          postingSchedule.frequency = 'daily';
        }
        
        // Ensure time_slots is a valid array
        if (!Array.isArray(postingSchedule.time_slots) || postingSchedule.time_slots.length === 0) {
          postingSchedule.time_slots = ['09:00'];
        }
        
        // Validate time slot format
        postingSchedule.time_slots = postingSchedule.time_slots.map(ts => {
          if (typeof ts === 'string' && /^\d{2}:\d{2}$/.test(ts)) {
            return ts;
          }
          return '09:00'; // Fallback
        }).filter(ts => ts); // Remove any null/undefined
      }

      // Ensure target_audience is a valid object
      let targetAudience = generatedCampaign.target_audience;
      if (!targetAudience || typeof targetAudience !== 'object') {
        targetAudience = {
        job_titles: [],
        industries: [],
        interests: [],
        pain_points: []
      };
      } else {
        // Normalize to ensure all fields are arrays
        targetAudience = {
          job_titles: Array.isArray(targetAudience.job_titles) ? targetAudience.job_titles : [],
          industries: Array.isArray(targetAudience.industries) ? targetAudience.industries : [],
          interests: Array.isArray(targetAudience.interests) ? targetAudience.interests : [],
          pain_points: Array.isArray(targetAudience.pain_points) ? targetAudience.pain_points : []
        };
      }

      // Ensure content_pillars is an array
      const contentPillars = Array.isArray(generatedCampaign.content_pillars) 
        ? generatedCampaign.content_pillars 
        : (generatedCampaign.content_pillars ? [String(generatedCampaign.content_pillars)] : []);

      // Build campaign payload
      const campaignPayload = {
        org_id: orgId,
        name: generatedCampaign.name || 'Untitled Campaign',
        description: generatedCampaign.description || '',
        target_audience: targetAudience,
        content_pillars: contentPillars,
        posting_schedule: postingSchedule,
        tone_voice: toneVoice,
        content_types: ['text'],
        duration: {
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString() // 12 weeks
        },
        text_model: 'openai/gpt-4o-mini',
        include_images: true,
        use_ai_images: true,
        image_style: generatedCampaign.image_style || 'professional',
        image_model: generatedCampaign.image_model || 'google/gemini-2.5-flash-image',
        profile_type: 'personal',
        status: 'active',  // Set to 'active' so it appears in dashboard
        auto_post: false,
        created_by: user.id
      };

      console.log('📤 Saving campaign with payload:', JSON.stringify(campaignPayload, null, 2));

      // Save the campaign directly using the campaigns endpoint
      const response = await axios.post(`${BACKEND_URL}/api/campaigns`, campaignPayload);

      console.log('✅ Campaign saved successfully:', response.data);

      // Store the saved campaign ID
          const campaignId = response.data.id || response.data._id;
          setSavedCampaignId(campaignId);
          console.log('✅ Campaign ID stored:', campaignId);
          
          // Update generatedCampaign with the saved campaign ID
          setGeneratedCampaign({
            ...generatedCampaign,
            id: campaignId
          });

      // Generate real topics using AI based on campaign content pillars and brand DNA
      setLoadingMessage('Generating topic ideas...');
      try {
        const contentPillars = Array.isArray(generatedCampaign.content_pillars) 
          ? generatedCampaign.content_pillars 
          : (generatedCampaign.content_pillars ? [String(generatedCampaign.content_pillars)] : []);
        
        const keyMessages = analysisData?.key_messages || [];
        const brandVoice = analysisData?.brand_voice || 'professional';
        const targetAudience = generatedCampaign.target_audience || analysisData?.target_audience || {};
        
        // Build topic generation prompt
        const topicPrompt = `Generate 7 unique, engaging LinkedIn post topics for the first week of a content campaign.

Campaign Name: ${generatedCampaign.name || 'Content Campaign'}
Campaign Focus: ${generatedCampaign.focus || generatedCampaign.description || 'Business growth'}
Brand Voice: ${brandVoice}
Content Pillars: ${contentPillars.join(', ') || 'Business insights'}
Key Messages: ${keyMessages.slice(0, 3).join(', ') || 'Value-driven content'}
Target Audience: ${targetAudience.job_titles?.join(', ') || 'Business professionals'}

Requirements:
- Create 7 distinct topics (one for each day)
- Mix educational (60%) and promotional (40%) content types
- Each topic should be specific and actionable
- Topics should align with the content pillars
- Make each topic unique and engaging
- Keep topics concise (under 10 words each)

Return ONLY a JSON array in this exact format:
[
  {"day": 1, "topic": "Specific topic title here", "type": "Educational"},
  {"day": 2, "topic": "Another specific topic", "type": "Promotional"},
  ...
]

Generate 7 unique topics now:`;

        // Generate topics using chat endpoint
        const topicsResponse = await axios.post(`${BACKEND_URL}/api/drafts/chat`, {
          messages: [
            {
              role: "system",
              content: "You are an expert LinkedIn content strategist. Generate unique, engaging post topics based on brand DNA and campaign context. Return ONLY valid JSON arrays."
            },
            {
              role: "user",
              content: topicPrompt
            }
          ],
          org_id: orgId,
          user_id: user.id
        });

        let generatedTopics = [];
        
        // Parse the response
        if (topicsResponse.data && topicsResponse.data.content) {
          try {
            // Extract JSON from response
            const content = topicsResponse.data.content;
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              generatedTopics = JSON.parse(jsonMatch[0]);
            }
          } catch (parseError) {
            console.warn('Failed to parse topics JSON, using fallback:', parseError);
          }
        }

        // Ensure we have exactly 7 topics, fallback if needed
        if (generatedTopics.length !== 7) {
          console.warn(`Generated ${generatedTopics.length} topics, creating fallback topics`);
          // Create smarter fallback based on content pillars
          generatedTopics = contentPillars.length > 0 
            ? Array(7).fill(null).map((_, i) => {
                const pillarIndex = i % contentPillars.length;
                const pillar = contentPillars[pillarIndex];
                const isEducational = i % 3 !== 1; // 2/3 educational, 1/3 promotional
                return {
        day: i + 1,
                  topic: `${pillar}: Key insights and strategies`,
                  type: isEducational ? 'Educational' : 'Promotional'
                };
              })
            : Array(7).fill(null).map((_, i) => ({
                day: i + 1,
                topic: `Day ${i + 1}: ${generatedCampaign.name} - Actionable insights`,
        type: i % 2 === 0 ? 'Educational' : 'Promotional'
      }));
        }

        setTopics(generatedTopics);
        console.log('✅ Generated topics:', generatedTopics);
      } catch (topicError) {
        console.error('Failed to generate topics, using fallback:', topicError);
        // Fallback to content pillar-based topics
        const contentPillars = Array.isArray(generatedCampaign.content_pillars) 
          ? generatedCampaign.content_pillars 
          : (generatedCampaign.content_pillars ? [String(generatedCampaign.content_pillars)] : []);
        
        const fallbackTopics = contentPillars.length > 0 
          ? Array(7).fill(null).map((_, i) => {
              const pillarIndex = i % contentPillars.length;
              const pillar = contentPillars[pillarIndex];
              const isEducational = i % 3 !== 1;
              return {
                day: i + 1,
                topic: `${pillar}: Insights and best practices`,
                type: isEducational ? 'Educational' : 'Promotional'
              };
            })
          : Array(7).fill(null).map((_, i) => ({
              day: i + 1,
              topic: `Day ${i + 1}: ${generatedCampaign.name} - Key strategies`,
              type: i % 2 === 0 ? 'Educational' : 'Promotional'
            }));
        
        setTopics(fallbackTopics);
      }
      
      setCompletedSteps(prev => ({ ...prev, step4: true }));

      // Smooth transition to next step (7 day topics)
      setTimeout(() => {
        updateStep(5, true); // Skip validation since we just completed step 4
      }, 300);
    } catch (error) {
      console.error('❌ Failed to save campaign:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        generatedCampaign,
        orgId,
        userId: user?.id
      });
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      alert(`Failed to save campaign: ${errorMessage}\n\nPlease try again.`);
      // Don't reset loading states here - let finally block handle it
    } finally {
      setLoading(false);
      setIsProcessing(false);
      setLoadingMessage('');
    }
  };

  const approveTopics = async () => {
    // Prevent double-clicks
    if (isGenerating || generatingPosts || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setIsGenerating(true);
    setGeneratingPosts(true);

    try {
      // Build brand DNA context for post generation
      const brandContext = {
        brand_voice: analysisData?.brand_voice || 'professional',
        key_messages: analysisData?.key_messages || [],
        value_propositions: analysisData?.value_propositions || [],
        content_pillars: generatedCampaign?.content_pillars || analysisData?.content_pillars || [],
        target_audience: generatedCampaign?.target_audience || analysisData?.target_audience || {}
      };

      // Build campaign context
      const campaignContext = {
        campaign_name: generatedCampaign?.name || '',
        campaign_focus: generatedCampaign?.focus || '',
        tone_voice: generatedCampaign?.tone_voice || 'professional',
        content_pillars: generatedCampaign?.content_pillars || []
      };

      // Generate 7 real posts using the approved topics
      const posts = [];
      const today = new Date();

      // Initialize topics with loading state
      setTopics(prevTopics => prevTopics.map(t => ({ ...t, loading: true, imageLoading: true })));

      for (let i = 0; i < 7; i++) {
        const postDate = new Date(today);
        postDate.setDate(today.getDate() + i);
        const topic = topics[i]; // Use the approved topic

        if (!topic) {
          console.warn(`No topic found for day ${i + 1}, skipping`);
          continue;
        }

        try {
          // Build enriched topic that includes brand DNA and campaign context
          // Use the approved topic as the base
          const enrichedTopic = `${topic.topic}\n\nBrand Context: ${brandContext.brand_voice} voice, focusing on ${brandContext.content_pillars.slice(0, 2).join(' and ')}. Key messages: ${brandContext.key_messages.slice(0, 2).join(', ')}. Campaign: ${campaignContext.campaign_name} - ${campaignContext.campaign_focus}.`;

          // Generate draft content with enriched context
          const draftResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate`, {
            org_id: orgId,
            topic: enrichedTopic,
            type: topic.type?.toLowerCase() || 'text',
            tone: campaignContext.tone_voice,
            created_by: user.id
          });

          const draftContent = draftResponse.data;

          // Update topic with generated content immediately (remove text loading)
          setTopics(prev => prev.map((t, idx) =>
            idx === i ? { ...t, draft: draftContent, loading: false } : t
          ));
          
          // Save the draft to database so we can schedule it
          // Ensure we have the campaign ID
          const campaignId = savedCampaignId || generatedCampaign?.id;
          if (!campaignId) {
            console.warn(`⚠️ No campaign ID available for post ${i + 1}, saving draft without campaign_id`);
          }
          
          // Build draft payload according to Draft model requirements
          const draftToSave = {
            id: `draft_${Date.now()}_${i}`,
            org_id: orgId,
            campaign_id: campaignId || null,  // Link to the saved campaign (null not undefined)
            author_id: user.id,  // Use author_id, not created_by
            mode: 'text',  // Use mode, not type (must be DraftMode enum: "text", "image", or "carousel")
            content: {
              body: draftContent.content || draftContent.body || '',
              hashtags: draftContent.hashtags || []
            },
            assets: [],  // Will be updated with image later
            status: 'draft'  // Explicitly set status
          };
          
          console.log(`💾 Saving draft for post ${i + 1} with campaign_id:`, campaignId);
          console.log(`💾 Draft payload:`, draftToSave);
          
          // Save draft
          const savedDraftResponse = await axios.post(`${BACKEND_URL}/api/drafts`, draftToSave);
          const savedDraft = savedDraftResponse.data;
          console.log(`✅ Draft saved for post ${i + 1}:`, savedDraft.id, savedDraft.campaign_id);

          // Generate Image for the post - ALWAYS ensure an image is present
          let imageUrl = null;
          try {
            const imageResponse = await axios.post(`${BACKEND_URL}/api/drafts/generate-image`, {
              prompt: draftContent.content || draftContent.body || topic.topic,
              topic: topic.topic,
              style: generatedCampaign?.image_style || 'professional',
              user_id: user.id,
              org_id: orgId,
              model: generatedCampaign?.image_model || 'google/gemini-2.5-flash-image'
            });
            imageUrl = imageResponse.data.url;
            console.log(`✅ AI image generated for post ${i + 1}`);
          } catch (imgError) {
            console.error(`Failed to generate AI image for post ${i + 1}:`, imgError);
            // Fallback to stock image if AI generation fails
            try {
              const stockResponse = await axios.post(`${BACKEND_URL}/api/drafts/fetch-stock-image`, {
                prompt: topic.topic,
                topic: topic.topic
              });
              imageUrl = stockResponse.data.url;
              console.log(`✅ Stock image fetched for post ${i + 1}`);
            } catch (stockError) {
              console.error("Stock image fallback failed:", stockError);
              // Final fallback: Use a placeholder image to ensure post always has an image
              imageUrl = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=630&fit=crop';
              console.warn(`⚠️ Using placeholder image for post ${i + 1}`);
            }
          }

          // Ensure imageUrl is never null
          if (!imageUrl) {
            imageUrl = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=630&fit=crop';
            console.warn(`⚠️ Image was null, using placeholder for post ${i + 1}`);
          }

          // Update topic with generated image (remove image loading)
          setTopics(prev => prev.map((t, idx) =>
            idx === i ? { ...t, imageUrl: imageUrl, imageLoading: false } : t
          ));

          // Update draft with image URL
          if (savedDraft && savedDraft.id) {
            try {
              await axios.put(`${BACKEND_URL}/api/drafts/${savedDraft.id}`, {
                ...savedDraft,
                assets: [
                  {
                    type: 'image',
                    url: imageUrl,
                    prompt: topic.topic,
                    generated_at: new Date().toISOString()
                  }
                ]
              });
            } catch (updateError) {
              console.warn(`Failed to update draft with image:`, updateError);
            }
          }

          // Schedule the post using the campaign's posting schedule or default to 9 AM
          // Start from today (not tomorrow) - schedule first post for today
          const publishDate = new Date(today);
          publishDate.setDate(today.getDate() + i);  // Day 0 = today, Day 1 = tomorrow, etc.
          
          const timeSlots = generatedCampaign?.posting_schedule?.time_slots || ['09:00'];
          const timeSlot = timeSlots[i % timeSlots.length] || '09:00';
          const [hours, minutes] = timeSlot.split(':').map(Number);
          publishDate.setHours(hours, minutes || 0, 0, 0);
          
          const publishTime = publishDate;
          
          console.log(`📅 Scheduling post ${i + 1} for ${publishTime.toISOString()} (${timeSlot})`);

          // Create scheduled post with draft_id (required by API)
          if (!savedDraft || !savedDraft.id) {
            throw new Error(`Failed to save draft for post ${i + 1}`);
          }

          console.log(`📅 Scheduling post ${i + 1} for ${publishTime.toISOString()}`);

          const scheduledPost = await axios.post(`${BACKEND_URL}/api/scheduled-posts`, {
            id: `scheduled_${Date.now()}_${i}`,  // Unique ID for scheduled post
            draft_id: savedDraft.id,  // Use the saved draft ID
            org_id: orgId,
            publish_time: publishTime.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',  // Use user's timezone
            status: 'scheduled',
            require_approval: false
          });
          
          console.log(`✅ Scheduled post ${i + 1} created:`, scheduledPost.data.id);

          posts.push({
            day: i + 1,
            topic: topic.topic,
            draft: savedDraft,
            draftContent: draftContent,
            scheduled: scheduledPost.data,
            date: postDate,
            time: timeSlot,
            imageUrl: imageUrl
          });

          console.log(`✅ Generated and scheduled post ${i + 1}/7: "${topic.topic}" at ${timeSlot}`);
        } catch (error) {
          console.error(`Failed to generate post ${i + 1}:`, error);
          // Mark loading as false even on error
          setTopics(prev => prev.map((t, idx) =>
            idx === i ? { ...t, loading: false, imageLoading: false, error: true } : t
          ));
        }
      }

      console.log('✅ All posts generated and scheduled:', posts);

      // Mark step 5 as complete, unlock dashboard sidebar, and navigate to calendar
      setCompletedSteps(prev => ({ ...prev, step5: true }));
      setPostsGenerated(true); // Mark posts as generated
      localStorage.setItem('sidebarUnlocked', 'true');

      // Mark onboarding as complete (with auth token from localStorage)
      try {
        const token = localStorage.getItem('token');
        await axios.put(`${BACKEND_URL}/api/auth/complete-onboarding`, {}, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        await refreshUser();
        console.log('✅ Onboarding marked as complete');
      } catch (error) {
        console.error("Onboarding completion failed:", error);
        // Don't block navigation if this fails
      }

      // Automatically redirect to dashboard immediately after all posts are generated
      console.log('✅ All posts generated successfully, redirecting to dashboard...');
      
      // Save the organization ID to localStorage so dashboard auto-selects it
      if (orgId) {
        localStorage.setItem('selectedOrgId', orgId);
        console.log(`✅ Saved orgId ${orgId} to localStorage for auto-selection`);
      }
      
      navigate('/dashboard');

    } catch (error) {
      console.error("Post generation failed:", error);
      alert('Some posts failed to generate. You can generate them later from the dashboard.');
      setPostsGenerated(true); // Still mark as done so user can proceed
      localStorage.setItem('sidebarUnlocked', 'true');
      
      // Save the organization ID to localStorage so dashboard auto-selects it
      if (orgId) {
        localStorage.setItem('selectedOrgId', orgId);
        console.log(`✅ Saved orgId ${orgId} to localStorage for auto-selection`);
      }
      
      navigate('/dashboard');
    } finally {
      setGeneratingPosts(false);
      setIsGenerating(false);
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 font-sans"
      style={{ 
        backgroundColor: tokens.colors.background.app,
        color: tokens.colors.text.primary
      }}
    >
      {/* Header / Progress */}
      <div className="w-full max-w-6xl mb-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: tokens.colors.accent.lime }}
          >
            <img src="/pilot.gif" alt="LinkedIn Pilot" className="w-full h-full object-contain" />
          </div>
          <span 
            className="text-lg font-serif italic"
            style={{ color: tokens.colors.text.primary }}
          >
            LinkedIn Pilot
          </span>
        </div>

        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => {
            const isCompleted = completedSteps[`step${i}`];
            const isCurrent = step === i;
            const canAccess = canAccessStep(i);

            return (
              <button
                key={i}
                onClick={() => {
                  if (canAccess) {
                    updateStep(i);
                  }
                }}
                disabled={!canAccess}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  canAccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                }`}
                style={{
                  width: isCurrent ? '48px' : isCompleted ? '32px' : '16px',
                  backgroundColor: isCurrent 
                    ? tokens.colors.accent.lime 
                    : isCompleted 
                      ? `${tokens.colors.accent.lime}99`
                      : tokens.colors.border.default,
                }}
                onMouseEnter={(e) => {
                  if (canAccess && !isCurrent) {
                    e.target.style.backgroundColor = `${tokens.colors.accent.lime}66`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (canAccess && !isCurrent) {
                    e.target.style.backgroundColor = isCompleted 
                      ? `${tokens.colors.accent.lime}99`
                      : tokens.colors.border.default;
                  }
                }}
                title={canAccess ? `Go to step ${i}` : 'Complete previous steps first'}
              />
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-6xl relative min-h-[600px]">
        <AnimatePresence mode='wait'>

          {/* STEP 1: Welcome & LinkedIn */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl mx-auto text-center"
            >
              <div className="mb-6">
                <h1 
                  className="text-4xl md:text-6xl font-serif italic mb-4"
                  style={{ color: tokens.colors.text.primary }}
                >
                  Welcome to LinkedIn Pilot
                </h1>
                <p 
                  className="text-lg max-w-2xl mx-auto mb-6"
                  style={{ color: tokens.colors.text.secondary }}
                >
                  Your AI-powered LinkedIn agent. Let's get you set up to automate your growth.
                </p>

                <div 
                  className="border rounded-3xl p-6 max-w-md mx-auto"
                  style={{ 
                    backgroundColor: tokens.colors.background.layer1,
                    borderColor: tokens.colors.border.default,
                    borderRadius: tokens.radius.xl
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: '#0077b5' }}
                  >
                    <Linkedin className="w-6 h-6" style={{ color: tokens.colors.accent.white }} />
                  </div>
                  <h3 
                    className="text-xl font-serif italic mb-1"
                    style={{ color: tokens.colors.text.primary }}
                  >
                    Connect LinkedIn
                  </h3>
                  <p 
                    className="text-sm mb-4"
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    Connect your profile so we can post on your behalf.
                  </p>

                  {linkedinConnected ? (
                    <div className="space-y-3">
                      <div 
                        className="flex items-center justify-center gap-2 font-medium py-2 rounded-xl text-sm"
                        style={{ 
                          color: tokens.colors.accent.lime,
                          backgroundColor: `${tokens.colors.accent.lime}1A`,
                          borderRadius: tokens.radius.lg
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        LinkedIn Connected
                      </div>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateStep(2, true); // Skip validation since step 1 is completed
                        }}
                        className="w-full h-10 font-medium text-sm"
                        style={{
                          backgroundColor: tokens.colors.accent.lime,
                          color: tokens.colors.text.inverse
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.accent.limeHover}
                        onMouseLeave={(e) => e.target.style.backgroundColor = tokens.colors.accent.lime}
                      >
                        Continue <ArrowRight className="w-3 h-3 ml-2" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleConnectLinkedIn}
                      disabled={linkedinLoading}
                      className="w-full h-10 font-medium text-sm"
                      style={{
                        backgroundColor: '#0077b5',
                        color: tokens.colors.accent.white
                      }}
                      onMouseEnter={(e) => !linkedinLoading && (e.target.style.backgroundColor = '#006097')}
                      onMouseLeave={(e) => !linkedinLoading && (e.target.style.backgroundColor = '#0077b5')}
                    >
                      {linkedinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Account'}
                    </Button>
                  )}

                  {!linkedinConnected && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCompletedSteps(prev => ({ ...prev, step1: true }));
                        // Use setTimeout to ensure state update completes before updating step
                        setTimeout(() => {
                          updateStep(2, true); // Skip validation since we just completed step 1
                        }, 0);
                      }}
                      className="mt-3 text-xs transition-colors"
                      style={{ color: tokens.colors.text.tertiary }}
                      onMouseEnter={(e) => e.target.style.color = tokens.colors.text.secondary}
                      onMouseLeave={(e) => e.target.style.color = tokens.colors.text.tertiary}
                    >
                      Skip for now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Business DNA Input */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl mx-auto"
            >
              <div className="text-center mb-6">
                <h1 
                  className="text-3xl md:text-4xl font-serif italic mb-2"
                  style={{ color: tokens.colors.text.primary }}
                >
                  Tell us about your business
                </h1>
                <p 
                  className="text-base"
                  style={{ color: tokens.colors.text.secondary }}
                >
                  We'll analyze your website and documents to build your Business DNA.
                </p>
              </div>

              <Card 
                style={{ 
                  backgroundColor: tokens.colors.background.layer1,
                  borderColor: tokens.colors.border.default
                }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label 
                      className="text-xs font-medium"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      Website URL
                    </label>
                    <div className="relative">
                      <Globe 
                        className="absolute left-3 top-2.5 w-4 h-4" 
                        style={{ color: tokens.colors.text.tertiary }}
                      />
                      <Input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://your-business.com"
                        className="pl-9 h-10 text-sm"
                        style={{
                          backgroundColor: tokens.colors.background.input,
                          borderColor: tokens.colors.border.default,
                          color: tokens.colors.text.primary
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label 
                      className="text-xs font-medium"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      Business Description
                    </label>
                    <div className="relative">
                      <FileText 
                        className="absolute left-3 top-2.5 w-4 h-4" 
                        style={{ color: tokens.colors.text.tertiary }}
                      />
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What do you do? Who is your target audience?"
                        className="pl-9 min-h-[80px] text-sm"
                        style={{
                          backgroundColor: tokens.colors.background.input,
                          borderColor: tokens.colors.border.default,
                          color: tokens.colors.text.primary
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label 
                      className="text-xs font-medium"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      Upload Materials
                    </label>
                    <div 
                      className="border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer relative"
                      style={{
                        borderColor: tokens.colors.border.default,
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.background.layer2}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload 
                        className="w-6 h-6 mx-auto mb-1" 
                        style={{ color: tokens.colors.text.tertiary }}
                      />
                      <p 
                        className="text-xs"
                        style={{ color: tokens.colors.text.secondary }}
                      >
                        {files.length > 0 ? `${files.length} files selected` : "Drag & drop PDFs or Images"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                    {step > 1 && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateStep(step - 1, true); // Skip validation for going back
                        }}
                        variant="outline"
                        className="flex-1 h-10 text-sm"
                        style={{
                          borderColor: tokens.colors.border.strong,
                          color: tokens.colors.text.primary,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.background.layer2}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <ArrowLeft className="w-3 h-3 mr-2" />
                        Back
                      </Button>
                    )}
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isProcessing && !loading) {
                          analyzeBrand();
                        }
                      }}
                      disabled={isProcessing || loading || (!websiteUrl && !description && files.length === 0)}
                      className={`${step > 1 ? 'flex-1' : 'w-full'} h-10 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={{
                        backgroundColor: tokens.colors.accent.lime,
                        color: tokens.colors.text.inverse
                      }}
                      onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = tokens.colors.accent.limeHover)}
                      onMouseLeave={(e) => !e.target.disabled && (e.target.style.backgroundColor = tokens.colors.accent.lime)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {loadingMessage}
                        </>
                      ) : (
                        "Analyze & Build DNA"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3: Brand Identity Review */}
          {step === 3 && analysisData && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="text-center mb-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-1">
                  <h1 
                    className="text-3xl md:text-4xl font-serif italic"
                    style={{ color: tokens.colors.text.primary }}
                  >
                    Your Business DNA
                  </h1>

                  {/* Display Organization/Brand Name */}
                  {brandInfo?.title && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full backdrop-blur-sm border"
                      style={{
                        backgroundColor: `${tokens.colors.accent.lime}1A`,
                        borderColor: `${tokens.colors.accent.lime}4D`,
                        borderRadius: tokens.radius.full
                      }}
                    >
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: tokens.colors.accent.lime,
                          boxShadow: `${tokens.colors.accent.lime}33 0 0 10px`
                        }}
                      >
                        <Globe 
                          className="w-2.5 h-2.5" 
                          style={{ color: tokens.colors.text.inverse }}
                        />
                      </div>
                      <div className="text-left flex flex-col leading-none">
                        <span 
                          className="text-[9px] uppercase tracking-wider"
                          style={{ color: tokens.colors.text.secondary }}
                        >
                          Org Created
                        </span>
                        <span 
                          className="text-xs font-semibold"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          {brandInfo.title}
                        </span>
                      </div>
                      <div 
                        className="pl-2 border-l"
                        style={{ borderColor: `${tokens.colors.accent.lime}4D` }}
                      >
                        <Check 
                          className="w-2.5 h-2.5"
                          style={{ color: tokens.colors.accent.lime }}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
                <p 
                  className="text-base"
                  style={{ color: tokens.colors.text.secondary }}
                >
                  We've analyzed your brand. Review your identity before we generate campaigns.
                </p>
              </div>

              {/* Tabs Navigation */}
              <div className="flex justify-center mb-6">
                <div 
                  className="p-1 rounded-full inline-flex border"
                  style={{
                    backgroundColor: tokens.colors.background.layer2,
                    borderColor: tokens.colors.border.default,
                    borderRadius: tokens.radius.full
                  }}
                >
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="px-5 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: activeTab === 'overview' ? tokens.colors.accent.lime : 'transparent',
                      color: activeTab === 'overview' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                      boxShadow: activeTab === 'overview' ? tokens.shadow.subtle : 'none',
                      borderRadius: tokens.radius.full
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== 'overview') {
                        e.target.style.color = tokens.colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== 'overview') {
                        e.target.style.color = tokens.colors.text.secondary;
                      }
                    }}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('identity')}
                    className="px-5 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: activeTab === 'identity' ? tokens.colors.accent.lime : 'transparent',
                      color: activeTab === 'identity' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                      boxShadow: activeTab === 'identity' ? tokens.shadow.subtle : 'none',
                      borderRadius: tokens.radius.full
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== 'identity') {
                        e.target.style.color = tokens.colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== 'identity') {
                        e.target.style.color = tokens.colors.text.secondary;
                      }
                    }}
                  >
                    Brand Voice & Identity
                  </button>
                  <button
                    onClick={() => setActiveTab('audience')}
                    className="px-5 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: activeTab === 'audience' ? tokens.colors.accent.lime : 'transparent',
                      color: activeTab === 'audience' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                      boxShadow: activeTab === 'audience' ? tokens.shadow.subtle : 'none',
                      borderRadius: tokens.radius.full
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== 'audience') {
                        e.target.style.color = tokens.colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== 'audience') {
                        e.target.style.color = tokens.colors.text.secondary;
                      }
                    }}
                  >
                    Target Audience
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="mb-8 min-h-[400px]">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' ? (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {brandInfo && <BrandIdentityCard brand={brandInfo} />}
                    </motion.div>
                  ) : activeTab === 'identity' ? (
                    <motion.div
                      key="identity"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card 
                        style={{ 
                          backgroundColor: tokens.colors.background.layer1,
                          borderColor: tokens.colors.border.default
                        }}
                      >
                        <CardHeader>
                          <CardTitle 
                            className="flex items-center justify-between"
                            style={{ color: tokens.colors.text.primary }}
                          >
                            <div className="flex items-center gap-2">
                              <FileText 
                                className="w-5 h-5" 
                                style={{ color: tokens.colors.accent.lime }}
                              />
                              Brand Voice & Identity
                            </div>
                            <Button
                              onClick={() => setShowBrandDNAEditModal(true)}
                              variant="outline"
                              size="sm"
                              style={{
                                borderColor: tokens.colors.border.default,
                                color: tokens.colors.text.primary
                              }}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div>
                            <h4 
                              className="text-sm font-medium mb-2 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Voice
                            </h4>
                            <p 
                              className="leading-relaxed text-lg"
                              style={{ color: tokens.colors.text.primary }}
                            >
                              {analysisData.brand_voice || "Professional and authoritative"}
                            </p>
                          </div>

                          <div>
                            <h4 
                              className="text-sm font-medium mb-2 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Key Messages
                            </h4>
                            <ul className="grid md:grid-cols-2 gap-4">
                              {analysisData.key_messages?.map((msg, i) => (
                                <li 
                                  key={i} 
                                  className="flex items-start gap-3 p-3 rounded-lg border"
                                  style={{
                                    color: tokens.colors.text.primary,
                                    backgroundColor: tokens.colors.background.layer2,
                                    borderColor: tokens.colors.border.subtle
                                  }}
                                >
                                  <div 
                                    className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                    style={{ backgroundColor: tokens.colors.accent.lime }}
                                  />
                                  {msg}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 
                              className="text-sm font-medium mb-2 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Value Propositions
                            </h4>
                            <ul className="grid md:grid-cols-2 gap-4">
                              {analysisData.value_propositions?.map((value, i) => (
                                <li 
                                  key={i} 
                                  className="flex items-start gap-3 p-3 rounded-lg border"
                                  style={{
                                    color: tokens.colors.text.primary,
                                    backgroundColor: tokens.colors.background.layer2,
                                    borderColor: tokens.colors.border.subtle
                                  }}
                                >
                                  <Check 
                                    className="w-4 h-4 mt-0.5 shrink-0"
                                    style={{ color: tokens.colors.accent.lime }}
                                  />
                                  {value}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="audience"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card 
                        style={{ 
                          backgroundColor: tokens.colors.background.layer1,
                          borderColor: tokens.colors.border.default
                        }}
                      >
                        <CardHeader>
                          <CardTitle 
                            className="flex items-center justify-between"
                            style={{ color: tokens.colors.text.primary }}
                          >
                            <div className="flex items-center gap-2">
                              <Target 
                                className="w-5 h-5"
                                style={{ color: tokens.colors.accent.lime }}
                              />
                              Target Audience
                            </div>
                            <Button
                              onClick={() => setShowBrandDNAEditModal(true)}
                              variant="outline"
                              size="sm"
                              style={{
                                borderColor: tokens.colors.border.default,
                                color: tokens.colors.text.primary
                              }}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                          <div>
                            <h4 
                              className="text-sm font-medium mb-3 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Job Titles
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {analysisData.target_audience?.job_titles?.map((title, i) => (
                                <Badge 
                                  key={i} 
                                  variant="secondary" 
                                  className="px-3 py-1 text-sm border-0"
                                  style={{
                                    backgroundColor: tokens.colors.background.layer2,
                                    color: tokens.colors.text.primary
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.background.input}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = tokens.colors.background.layer2}
                                >
                                  {title}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 
                              className="text-sm font-medium mb-3 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Industries
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {analysisData.target_audience?.industries?.map((industry, i) => (
                                <Badge 
                                  key={i} 
                                  variant="secondary" 
                                  className="px-3 py-1 text-sm border"
                                  style={{
                                    backgroundColor: `${tokens.colors.accent.lime}1A`,
                                    color: tokens.colors.accent.lime,
                                    borderColor: `${tokens.colors.accent.lime}4D`
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = `${tokens.colors.accent.lime}33`}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = `${tokens.colors.accent.lime}1A`}
                                >
                                  {industry}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 
                              className="text-sm font-medium mb-3 uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Content Pillars
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {analysisData.content_pillars?.map((pillar, i) => (
                                <Badge 
                                  key={i} 
                                  variant="outline" 
                                  className="px-3 py-1 text-sm"
                                  style={{
                                    backgroundColor: tokens.colors.background.layer2,
                                    color: tokens.colors.text.primary,
                                    borderColor: tokens.colors.border.strong
                                  }}
                                >
                                  {pillar}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    updateStep(step - 1, true); // Skip validation for going back
                  }}
                  variant="outline"
                  className="h-12 px-8 font-medium"
                  disabled={loading}
                  style={{
                    borderColor: tokens.colors.border.strong,
                    color: tokens.colors.text.primary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = tokens.colors.background.layer2)}
                  onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = 'transparent')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                {completedSteps.step3 && campaignPreviews.length > 0 ? (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateStep(4, true);
                    }}
                    className="h-12 px-12 bg-[#88D9E7] text-black hover:bg-[#A0E5F0] font-medium text-lg"
                  >
                    Continue to Campaigns <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isProcessing && !loading) {
                        generateCampaigns();
                      }
                    }}
                    disabled={isProcessing || loading}
                    className="h-12 px-12 bg-[#88D9E7] text-black hover:bg-[#A0E5F0] font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      "Approve & Generate Campaigns"
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 4: Campaign Selection */}
          {step === 4 && campaignPreviews.length > 0 && !isEditingCampaign && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div className="text-center mb-6">
                <h1 className="text-3xl md:text-4xl font-serif italic mb-2" style={{ color: tokens.colors.text.primary }}>Choose a Campaign Strategy</h1>
                <p 
                  className="text-base"
                  style={{ color: tokens.colors.text.secondary }}
                >
                  Select one of these tailored campaign directions to start with.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {campaignPreviews.map((campaign, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card
                      onClick={() => selectCampaign(campaign)}
                      className="aspect-[2.5/3.2] hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col p-5"
                      style={{
                        backgroundColor: tokens.colors.background.layer1,
                        borderColor: tokens.colors.border.default
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = tokens.colors.border.default;
                      }}
                    >
                      {/* Decorative Background Pattern */}
                      <div 
                        className="absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-4 -mt-4 transition-all"
                        style={{
                          backgroundColor: `${tokens.colors.accent.lime}0D`,
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = `${tokens.colors.accent.lime}1A`}
                        onMouseLeave={(e) => e.target.style.backgroundColor = `${tokens.colors.accent.lime}0D`}
                      />

                      <div className="relative z-10 flex flex-col h-full">
                        {/* Header: Focus Badge */}
                        <div className="flex justify-between items-start mb-3">
                          <Badge 
                            className="border-0 text-[9px] uppercase tracking-wider px-2 py-0.5 transition-colors"
                            style={{
                              backgroundColor: tokens.colors.background.layer2,
                              color: tokens.colors.text.primary
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = tokens.colors.accent.lime;
                              e.target.style.color = tokens.colors.text.inverse;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = tokens.colors.background.layer2;
                              e.target.style.color = tokens.colors.text.primary;
                            }}
                          >
                            {campaign.focus || 'Strategy'}
                          </Badge>
                        </div>

                        {/* Main Content: Title & Excerpt */}
                        <div className="flex-1 flex flex-col justify-center text-center space-y-3">
                          <h3 
                            className="text-lg font-serif italic leading-tight transition-colors"
                            style={{ color: tokens.colors.text.primary }}
                            onMouseEnter={(e) => e.target.style.color = tokens.colors.accent.lime}
                            onMouseLeave={(e) => e.target.style.color = tokens.colors.text.primary}
                          >
                            {campaign.name}
                          </h3>

                          <div 
                            className="w-6 h-[1px] mx-auto transition-colors"
                            style={{ backgroundColor: tokens.colors.border.subtle }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.accent.lime}
                            onMouseLeave={(e) => e.target.style.backgroundColor = tokens.colors.border.subtle}
                          />

                          <p 
                            className="text-[10px] leading-relaxed line-clamp-3"
                            style={{ color: tokens.colors.text.secondary }}
                          >
                            {campaign.description}
                          </p>
                        </div>

                        {/* Footer: Visual Hint */}
                        <div className="mt-auto pt-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                          <span 
                            className="text-[9px] font-medium uppercase tracking-widest flex items-center gap-1"
                            style={{ color: tokens.colors.accent.lime }}
                          >
                            View Strategy <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {loading && (
                <div 
                  className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
                  style={{ backgroundColor: `${tokens.colors.background.app}CC` }}
                >
                  <div className="text-center">
                    <Loader2 
                      className="w-12 h-12 animate-spin mx-auto mb-4"
                      style={{ color: tokens.colors.accent.lime }}
                    />
                    <p 
                      className="text-xl font-serif italic"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      {loadingMessage}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 4 (Detailed View): Campaign Edit */}
          {step === 4 && isEditingCampaign && generatedCampaign && (
            <motion.div
              key="step4-edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditingCampaign(false)}
                  style={{
                    color: tokens.colors.text.secondary
                  }}
                  onMouseEnter={(e) => e.target.style.color = tokens.colors.text.primary}
                  onMouseLeave={(e) => e.target.style.color = tokens.colors.text.secondary}
                >
                  ← Back
                </Button>
                <h1 
                  className="text-3xl font-serif italic"
                  style={{ color: tokens.colors.text.primary }}
                >
                  Campaign Strategy
                </h1>
              </div>

              <Card 
                className="p-8 md:p-12"
                style={{
                  backgroundColor: tokens.colors.background.layer1,
                  borderColor: tokens.colors.border.default
                }}
              >
                <div className="prose max-w-none">
                  <div 
                    className="flex justify-between items-start mb-8 border-b pb-8"
                    style={{ borderColor: tokens.colors.border.default }}
                  >
                    <div className="flex-1">
                      <h1 
                        className="text-4xl font-serif italic mb-2"
                        style={{ color: tokens.colors.accent.lime }}
                      >
                        {generatedCampaign.name}
                      </h1>
                      <p 
                        className="text-xl"
                        style={{ color: tokens.colors.text.secondary }}
                      >
                        {generatedCampaign.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        className="text-lg px-4 py-1"
                        style={{
                          backgroundColor: tokens.colors.accent.lime,
                          color: tokens.colors.text.inverse
                        }}
                      >
                        {generatedCampaign.duration?.length || 4} Weeks
                      </Badge>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingCampaignData(generatedCampaign);
                          setShowCampaignEditModal(true);
                        }}
                        variant="outline"
                        className="h-10 px-4 font-medium"
                        style={{
                          borderColor: tokens.colors.border.strong,
                          color: tokens.colors.text.primary,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.background.layer2}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <section>
                      <h3 
                        className="text-2xl font-serif mb-4 flex items-center gap-2"
                        style={{ color: tokens.colors.text.primary }}
                      >
                        <Target 
                          className="w-6 h-6"
                          style={{ color: tokens.colors.accent.lime }}
                        />
                        Objective
                      </h3>
                      <p 
                        className="text-lg leading-relaxed p-6 rounded-xl border"
                        style={{
                          color: tokens.colors.text.primary,
                          backgroundColor: tokens.colors.background.layer2,
                          borderColor: tokens.colors.border.default,
                          borderRadius: tokens.radius.xl
                        }}
                      >
                        {generatedCampaign.objective || generatedCampaign.description || "To establish thought leadership and drive engagement through high-value content."}
                      </p>
                    </section>

                    <div className="grid md:grid-cols-2 gap-8">
                      <section>
                        <h3 
                          className="text-2xl font-serif mb-4"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          Target Audience
                        </h3>
                        <ul className="space-y-2">
                          {generatedCampaign.target_audience?.job_titles?.map((title, i) => (
                            <li 
                              key={i} 
                              className="flex items-center gap-2"
                              style={{ color: tokens.colors.text.primary }}
                            >
                              <Check 
                                className="w-4 h-4"
                                style={{ color: tokens.colors.accent.lime }}
                              />
                              {title}
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section>
                        <h3 
                          className="text-2xl font-serif mb-4"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          Content Pillars
                        </h3>
                        <ul className="space-y-2">
                          {generatedCampaign.content_pillars?.map((pillar, i) => (
                            <li 
                              key={i} 
                              className="flex items-center gap-2"
                              style={{ color: tokens.colors.text.primary }}
                            >
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: tokens.colors.accent.lime }}
                              />
                              {pillar}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <section>
                        <h3 
                          className="text-2xl font-serif mb-4"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          Tone & Voice
                        </h3>
                        <p 
                          className="text-lg capitalize p-4 rounded-xl border"
                          style={{
                            color: tokens.colors.text.primary,
                            backgroundColor: tokens.colors.background.layer2,
                            borderColor: tokens.colors.border.default,
                            borderRadius: tokens.radius.xl
                          }}
                        >
                          {generatedCampaign.tone_voice?.replace(/_/g, ' ') || 'Professional'}
                        </p>
                      </section>

                      <section>
                        <h3 
                          className="text-2xl font-serif mb-4"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          Posting Schedule
                        </h3>
                        <p 
                          className="text-lg capitalize p-4 rounded-xl border"
                          style={{
                            color: tokens.colors.text.primary,
                            backgroundColor: tokens.colors.background.layer2,
                            borderColor: tokens.colors.border.default,
                            borderRadius: tokens.radius.xl
                          }}
                        >
                          {generatedCampaign.posting_schedule?.frequency?.replace(/_/g, ' ') || 'Weekly'}
                          {generatedCampaign.posting_schedule?.time_slots?.length > 0 && (
                            <span 
                              className="text-sm block mt-2"
                              style={{ color: tokens.colors.text.secondary }}
                            >
                              at {generatedCampaign.posting_schedule.time_slots.join(', ')}
                            </span>
                          )}
                        </p>
                      </section>
                    </div>

                    {generatedCampaign.sample_posts && generatedCampaign.sample_posts.length > 0 && (
                      <section>
                        <h3 
                          className="text-2xl font-serif mb-4"
                          style={{ color: tokens.colors.text.primary }}
                        >
                          Sample Posts
                        </h3>
                        <div className="space-y-4">
                          {generatedCampaign.sample_posts.slice(0, 3).map((post, i) => (
                            <div 
                              key={i} 
                              className="p-4 rounded-xl border"
                              style={{
                                backgroundColor: tokens.colors.background.layer2,
                                borderColor: tokens.colors.border.default,
                                borderRadius: tokens.radius.xl
                              }}
                            >
                              <p 
                                className="text-sm leading-relaxed"
                                style={{ color: tokens.colors.text.primary }}
                              >
                                {post}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>

                <div 
                  className="mt-12 pt-8 border-t flex justify-end gap-4"
                  style={{ borderColor: tokens.colors.border.default }}
                >
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateStep(step - 1, true); // Skip validation for going back
                    }}
                    variant="outline"
                    className="h-12 px-8 font-medium"
                    disabled={loading}
                    style={{
                      borderColor: tokens.colors.border.strong,
                      color: tokens.colors.text.primary,
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = tokens.colors.background.layer2)}
                    onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = 'transparent')}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔘 Approve Strategy clicked:', {
                        isProcessing,
                        loading,
                        hasCampaign: !!generatedCampaign,
                        campaignName: generatedCampaign?.name,
                        isEditingCampaign
                      });
                      if (!isProcessing && !loading && generatedCampaign) {
                        approveCampaign();
                      } else {
                        console.warn('⚠️ Button click blocked:', {
                          isProcessing,
                          loading,
                          hasCampaign: !!generatedCampaign,
                          isEditingCampaign
                        });
                      }
                    }}
                    disabled={isProcessing || loading || !generatedCampaign}
                    className="h-12 px-8 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: (!isProcessing && !loading && generatedCampaign) 
                        ? tokens.colors.accent.lime 
                        : tokens.colors.background.layer2,
                      color: (!isProcessing && !loading && generatedCampaign) 
                        ? tokens.colors.text.inverse 
                        : tokens.colors.text.tertiary
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing && !loading && generatedCampaign) {
                        e.target.style.backgroundColor = tokens.colors.accent.limeHover || '#A0E5F0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isProcessing && !loading && generatedCampaign) {
                        e.target.style.backgroundColor = tokens.colors.accent.lime;
                      }
                    }}
                    title={!generatedCampaign ? 'Please select a campaign first' : isProcessing || loading ? 'Processing...' : 'Approve and save this campaign'}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      <>
                        Approve Strategy <Check className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* STEP 5: Topic Approval */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="text-center mb-6">
                <h1 
                  className="text-3xl md:text-4xl font-serif italic mb-2"
                  style={{ color: tokens.colors.text.primary }}
                >
                  First Week Topics
                </h1>
                <p 
                  className="text-base"
                  style={{ color: tokens.colors.text.secondary }}
                >
                  Review the topics for your first 7 days of content.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {topics.map((topic, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card 
                      className="border transition-colors"
                      style={{
                        backgroundColor: tokens.colors.background.layer1,
                        borderColor: tokens.colors.border.default
                      }}
                      onMouseEnter={(e) => e.target.style.borderColor = `${tokens.colors.accent.lime}4D`}
                      onMouseLeave={(e) => e.target.style.borderColor = tokens.colors.border.default}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center font-bold font-mono"
                          style={{
                            backgroundColor: tokens.colors.background.layer2,
                            color: tokens.colors.accent.lime,
                            borderRadius: tokens.radius.lg
                          }}
                        >
                          {topic.day}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="text-xs font-medium uppercase tracking-wider"
                              style={{ color: tokens.colors.text.tertiary }}
                            >
                              Day {topic.day}
                            </span>
                            {topic.loading && (
                              <div 
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: tokens.colors.background.layer2 }}
                              >
                                <Loader2 
                                  className="w-3 h-3 animate-spin"
                                  style={{ color: tokens.colors.accent.lime }}
                                />
                                <span 
                                  className="text-[10px]"
                                  style={{ color: tokens.colors.text.secondary }}
                                >
                                  Generating...
                                </span>
                              </div>
                            )}
                            {!topic.loading && topic.draft && (
                              <div 
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${tokens.colors.accent.lime}1A` }}
                              >
                                <CheckCircle2 
                                  className="w-3 h-3"
                                  style={{ color: tokens.colors.accent.lime }}
                                />
                                <span 
                                  className="text-[10px]"
                                  style={{ color: tokens.colors.accent.lime }}
                                >
                                  Ready
                                </span>
                              </div>
                            )}
                          </div>
                          <p 
                            className="font-medium truncate"
                            style={{ color: tokens.colors.text.primary }}
                          >
                            {topic.topic}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className="text-[10px] py-0 h-5"
                              style={{
                                borderColor: tokens.colors.border.subtle,
                                color: tokens.colors.text.tertiary
                              }}
                            >
                              {topic.type}
                            </Badge>
                            {topic.imageUrl && (
                              <Badge 
                                variant="outline" 
                                className="text-[10px] py-0 h-5"
                                style={{
                                  borderColor: `${tokens.colors.accent.lime}4D`,
                                  color: tokens.colors.accent.lime,
                                  backgroundColor: `${tokens.colors.accent.lime}0D`
                                }}
                              >
                                Image Generated
                              </Badge>
                            )}
                          </div>
                        </div>
                        {topic.imageUrl && (
                          <div 
                            className="w-12 h-12 rounded-md overflow-hidden border shrink-0"
                            style={{
                              borderColor: tokens.colors.border.default,
                              backgroundColor: tokens.colors.background.layer2,
                              borderRadius: tokens.radius.md
                            }}
                          >
                            <img src={topic.imageUrl} alt="Generated" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {topic.imageLoading && !topic.imageUrl && (
                          <div 
                            className="w-12 h-12 rounded-md overflow-hidden border shrink-0 flex items-center justify-center"
                            style={{
                              borderColor: tokens.colors.border.default,
                              backgroundColor: tokens.colors.background.layer2,
                              borderRadius: tokens.radius.md
                            }}
                          >
                            <Loader2 
                              className="w-4 h-4 animate-spin"
                              style={{ color: tokens.colors.text.tertiary }}
                            />
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          style={{ color: tokens.colors.text.tertiary }}
                          onMouseEnter={(e) => e.target.style.color = tokens.colors.text.primary}
                          onMouseLeave={(e) => e.target.style.color = tokens.colors.text.tertiary}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    updateStep(step - 1, true); // Skip validation for going back
                  }}
                  variant="outline"
                  className="h-12 px-8 font-medium"
                  disabled={generatingPosts}
                  style={{
                    borderColor: tokens.colors.border.strong,
                    color: tokens.colors.text.primary,
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => !generatingPosts && (e.target.style.backgroundColor = tokens.colors.background.layer2)}
                  onMouseLeave={(e) => !generatingPosts && (e.target.style.backgroundColor = 'transparent')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    if (!isGenerating && !generatingPosts && !postsGenerated) {
                        approveTopics();
                      }
                    }}
                  disabled={isGenerating || generatingPosts || isProcessing || postsGenerated}
                  className="h-12 px-12 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: (!isGenerating && !generatingPosts && !isProcessing && !postsGenerated) 
                      ? tokens.colors.accent.lime 
                      : tokens.colors.background.layer2,
                    color: (!isGenerating && !generatingPosts && !isProcessing && !postsGenerated) 
                      ? tokens.colors.text.inverse 
                      : tokens.colors.text.tertiary
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating && !generatingPosts && !isProcessing && !postsGenerated) {
                      e.target.style.backgroundColor = tokens.colors.accent.limeHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating && !generatingPosts && !isProcessing && !postsGenerated) {
                      e.target.style.backgroundColor = tokens.colors.accent.lime;
                    }
                  }}
                  >
                    {generatingPosts ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating Posts...
                      </>
                  ) : postsGenerated ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Redirecting to Dashboard...
                      </>
                    ) : (
                      <>
                        Generate Posts <Sparkles className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
              </div>
            </motion.div>
          )}


        </AnimatePresence>
      </div>

      {/* Brand DNA Edit Modal */}
      {showBrandDNAEditModal && (
        <BrandDNAEditModal
          isOpen={showBrandDNAEditModal}
          onClose={() => setShowBrandDNAEditModal(false)}
          onSave={(updatedData) => {
            setAnalysisData(updatedData);
            setShowBrandDNAEditModal(false);
          }}
          initialData={analysisData}
          orgId={orgId}
        />
      )}

      {/* Campaign Edit Modal */}
      {showCampaignEditModal && editingCampaignData && (
        <CampaignConfigModal
          isOpen={showCampaignEditModal}
          onClose={() => {
            setShowCampaignEditModal(false);
            setEditingCampaignData(null);
          }}
          onSave={async (campaignData) => {
            try {
              // During onboarding, just update the local state
              // The campaign will be saved when user clicks "Approve Strategy"
              console.log('📝 Updating campaign preview with edited data:', campaignData);
              
              // Update the generatedCampaign state with edited data
              const updatedCampaign = {
                ...generatedCampaign,
                ...campaignData,
                // Ensure required fields are preserved
                name: campaignData.name || generatedCampaign.name,
                description: campaignData.description || generatedCampaign.description,
                content_pillars: campaignData.content_pillars || generatedCampaign.content_pillars,
                target_audience: campaignData.target_audience || generatedCampaign.target_audience,
                posting_schedule: campaignData.posting_schedule || generatedCampaign.posting_schedule,
                tone_voice: campaignData.tone_voice || generatedCampaign.tone_voice
              };
              
              setGeneratedCampaign(updatedCampaign);
              setSelectedCampaign(updatedCampaign);
              setShowCampaignEditModal(false);
              setEditingCampaignData(null);
              
              console.log('✅ Campaign preview updated successfully');
            } catch (error) {
              console.error('Error updating campaign preview:', error);
              alert('Failed to update campaign: ' + (error.response?.data?.detail || error.message));
            }
          }}
          initialData={editingCampaignData}
          orgId={orgId}
        />
      )}
    </div>
  );
};

export default OnboardingFlow;
