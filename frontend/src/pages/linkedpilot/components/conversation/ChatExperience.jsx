import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import ChatContainer from './ChatContainer';
import { FloatingChatInput } from './FloatingChatInput';
import MobileNavDrawer from '../MobileNavDrawer';
import SetupCarousel from './SetupCarousel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const initialMessage = {
  id: 'welcome',
  role: 'assistant',
  variant: 'text',
  content:
    'Hello, I am your LinkedIn content assistant. Let us connect your LinkedIn account so I can tailor a launch plan for your brand.',
  actions: [
    { id: 'connect-linkedin', label: 'Connect LinkedIn', intent: 'primary' },
  ],
};

const buildUserMessage = (content) => ({
  id: `user-${Date.now()}`,
  role: 'user',
  variant: 'text',
  content,
});

const ChatExperience = ({ onOrganizationChange, onUnlockSidebar, onCampaignCreated }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([initialMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMode, setInputMode] = useState('idle');
  const [currentOrg, setCurrentOrg] = useState(null);
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [campaignMessageId, setCampaignMessageId] = useState(null);
  const [campaignPreviews, setCampaignPreviews] = useState([]);
  const [postsPreview, setPostsPreview] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [sidebarUnlocked, setSidebarUnlocked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState('linkedin');
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [brandDiscovered, setBrandDiscovered] = useState(false);
  const [campaignsGenerated, setCampaignsGenerated] = useState(false);
  const [campaignsApproved, setCampaignsApproved] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [brandInfo, setBrandInfo] = useState(null);
  const [setupError, setSetupError] = useState(null);

  const placeholder = useMemo(() => {
    if (inputMode === 'website') {
      return 'Paste your organization website so I can analyze the brand';
    }
    if (inputMode === 'campaign-feedback') {
      return 'Describe how you want to refine or remix this campaign';
    }
    if (inputMode === 'new-campaign') {
      return 'Describe the new campaign idea you would like the assistant to generate';
    }
    return 'Type your response...';
  }, [inputMode]);

  const appendMessage = useCallback(
    (message) => {
      setMessages((prev) => [...prev, { ...message, id: message.id || `msg-${Date.now()}` }]);
    },
    [setMessages],
  );

  const replaceCampaignMessage = useCallback(
    (nextCampaigns) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === campaignMessageId
            ? { ...message, campaigns: nextCampaigns }
            : message,
        ),
      );
    },
    [campaignMessageId],
  );

  const normalizeUrl = (raw) => {
    if (!raw) {
      return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const fetchLinkedInStatus = useCallback(async () => {
    if (!user) {
      return false;
    }
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/settings/linkedin-status`,
        { params: { user_id: user.id } },
      );
      return Boolean(response.data?.linkedin_connected);
    } catch {
      return false;
    }
  }, [user]);

  const ensureOrganization = useCallback(
    async (websiteUrl, brandTitle) => {
      if (!user) {
        throw new Error('User not available');
      }

      try {
        const response = await axios.get(`${BACKEND_URL}/api/organizations`, {
          params: { user_id: user.id },
        });
        const organizations = Array.isArray(response.data) ? response.data : [];

        const normalizedInput = websiteUrl.replace(/\/$/, '');
        const existing = organizations.find((org) => {
          const orgWebsite = (org.website || '').replace(/\/$/, '');
          return orgWebsite === normalizedInput;
        });

        if (existing) {
          setCurrentOrg(existing);
          if (onOrganizationChange) {
            onOrganizationChange(existing.id);
          }
          return existing;
        }

        const nameFromDomain = () => {
          try {
            const { hostname } = new URL(websiteUrl);
            const domainParts = hostname.split('.');
            if (domainParts.length >= 2) {
              return domainParts[domainParts.length - 2]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());
            }
            return hostname;
          } catch {
            return brandTitle || 'New Organization';
          }
        };

        const payload = {
          name: brandTitle || nameFromDomain(),
          website: websiteUrl,
          brand_tone: 'Professional and engaging',
          target_audience: 'Industry professionals',
          created_by: user.id,
        };

        const createResponse = await axios.post(
          `${BACKEND_URL}/api/organizations`,
          payload,
        );

        const organization = createResponse.data;
        setCurrentOrg(organization);
        if (onOrganizationChange) {
          onOrganizationChange(organization.id);
        }
        localStorage.setItem('selectedOrgId', organization.id);
        return organization;
      } catch (error) {
        throw new Error(
          error?.response?.data?.detail || 'Unable to create organization',
        );
      }
    },
    [user, onOrganizationChange],
  );

  const addWebsiteMaterialAndAnalyze = useCallback(
    async (orgId, websiteUrl) => {
      try {
        const addResponse = await axios.post(
          `${BACKEND_URL}/api/organization-materials/add-url`,
          null,
          { params: { org_id: orgId, url: websiteUrl } },
        );

        const material = addResponse.data;
        if (material?.id) {
          await axios.post(
            `${BACKEND_URL}/api/organization-materials/extract-content/${material.id}`,
          );
        }

        const analysisResponse = await axios.post(
          `${BACKEND_URL}/api/organization-materials/analyze`,
          null,
          { params: { org_id: orgId } },
        );
        setBrandAnalysis(analysisResponse.data);
        return analysisResponse.data;
      } catch (error) {
        throw new Error(
          error?.response?.data?.detail || 'Brand analysis failed. Please try again.',
        );
      }
    },
    [],
  );

  const discoverBrandAttributes = useCallback(async (websiteUrl) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/brand/discover`, {
        url: websiteUrl,
      });
      const data = response.data || {};
      return {
        normalizedUrl: data.normalized_url || websiteUrl,
        title: data.title,
        description: data.description,
        colorPalette: data.color_palette,
        fontFamilies: data.font_families,
        imagery: data.imagery,
        toneKeywords: data.tone_keywords,
        keywordSummary: data.keyword_summary,
        contentExcerpt: data.content_excerpt,
      };
    } catch (error) {
      if (error?.response?.status === 404) {
        throw new Error(
          'Brand discovery endpoint not found. Please ensure the backend server is running and has been restarted to load the new routes.',
        );
      }
      throw new Error(
        error?.response?.data?.detail || error?.message || 'Brand discovery failed. Please verify the URL and try again.',
      );
    }
  }, []);

  const promptForWebsite = useCallback(() => {
    appendMessage({
      id: 'website-request',
      role: 'assistant',
      variant: 'text',
      content:
        'Great. Please share the public website for your organization so I can gather brand signals automatically.',
    });
    setInputMode('website');
  }, [appendMessage]);

  const handleLinkedInConnected = useCallback(() => {
    setLinkedinConnected(true);
    setCurrentStep('brand');
    setCarouselIndex(1); // Move to brand step
  }, []);

  const beginCampaignSelection = useCallback(
    (campaigns) => {
      setCampaignPreviews(campaigns);
      const messageId = `campaigns-${Date.now()}`;
      setCampaignMessageId(messageId);
      appendMessage({
        id: messageId,
        role: 'assistant',
        variant: 'campaigns',
        campaigns,
      });
      appendMessage({
        id: `campaign-cta-${Date.now()}`,
        role: 'assistant',
        variant: 'text',
        content:
          'Each concept is tailored to your brand identity. Expand a card to review the plan, sample posts, and cadence. You can refine, combine ideas, start a fresh direction, or approve your favorite.',
      });
    },
    [appendMessage],
  );

  const generateCampaignPreviews = useCallback(
    async (orgId, analysis) => {
      try {
        setIsTyping(true);
        const suggestions = Array.isArray(analysis?.suggested_campaigns)
          ? analysis.suggested_campaigns.map((item, index) => ({
              name: item.name || `Campaign ${index + 1}`,
              description: item.description,
              focus: item.focus,
            }))
          : [];

        const response = await axios.post(
          `${BACKEND_URL}/api/brand/campaign-previews`,
          {
            org_id: orgId,
            count: 3,
            suggestions,
          },
        );

        const campaigns = response.data?.campaigns || [];
        if (campaigns.length === 0) {
          throw new Error('No campaign previews returned by assistant.');
        }

        beginCampaignSelection(campaigns);
        setCampaignsGenerated(true);
        setCurrentStep('approve');
        setCarouselIndex(3); // Move to approve step
        setInputMode('idle');
      } catch (error) {
        appendMessage({
          id: `campaign-error-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            error?.message || 'Unable to generate campaigns at the moment. Please try again shortly.',
        });
        setInputMode('idle');
      } finally {
        setIsTyping(false);
      }
    },
    [appendMessage, beginCampaignSelection],
  );

  const handleCampaignApproval = useCallback(
    async (campaign) => {
      if (!currentOrg || !campaign) {
        return;
      }

      appendMessage({
        id: `approve-${campaign.id}`,
        role: 'assistant',
        variant: 'text',
        content: `Approving the "${campaign.name}" campaign and generating your first week of posts.`,
      });

      try {
        setIsTyping(true);
        const payload = {
          org_id: currentOrg.id,
          campaign_name: campaign.name,
          focus_area: campaign.focus,
          use_analysis: true,
        };
        const response = await axios.post(
          `${BACKEND_URL}/api/organization-materials/generate-campaign`,
          payload,
        );

        const createdCampaign = response.data;
        if (onCampaignCreated) {
          onCampaignCreated(createdCampaign);
        }

        const postsResponse = await axios.post(
          `${BACKEND_URL}/api/brand/post-previews`,
          {
            org_id: currentOrg.id,
            campaign_id: createdCampaign.id,
            count: 7,
          },
        );

        const generatedPosts = postsResponse.data?.posts || [];
        setPostsPreview(generatedPosts);
        appendMessage({
          id: `posts-preview-${Date.now()}`,
          role: 'assistant',
          variant: 'posts',
          posts: generatedPosts,
        });
        appendMessage({
          id: `sidebar-unlock-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            'Your campaign is queued with seven days of posts. The calendar, posts, analytics, and settings panels are now available for deeper management.',
        });

        setCampaignsApproved(true);
        setSidebarUnlocked(true);
        if (onUnlockSidebar) {
          onUnlockSidebar();
        }
        setInputMode('idle');
        // Carousel will be hidden after setup complete
      } catch (error) {
        appendMessage({
          id: `approve-error-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            error?.response?.data?.detail || 'Campaign approval failed. Please try again or adjust the concept.',
        });
      } finally {
        setIsTyping(false);
      }
    },
    [appendMessage, currentOrg, onCampaignCreated, onUnlockSidebar],
  );

  const handleCampaignAction = useCallback(
    async (actionId, payload) => {
      if (actionId === 'approve') {
        await handleCampaignApproval(payload);
        return;
      }

      if (actionId === 'refine') {
        setPendingAction({ type: 'refine', campaign: payload });
        appendMessage({
          id: `refine-prompt-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            'Tell me what you would like to adjust. For example, you can focus on a new audience, shift tone, or highlight a particular product.',
        });
        setInputMode('campaign-feedback');
        return;
      }

      if (actionId === 'combine') {
        setPendingAction({ type: 'combine', campaign: payload });
        appendMessage({
          id: `combine-prompt-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            'Describe how you would like to combine or remix ideas. Mention the key elements you want carried forward.',
        });
        setInputMode('campaign-feedback');
        return;
      }

      if (actionId === 'new') {
        setPendingAction({ type: 'new' });
        appendMessage({
          id: `new-prompt-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            'Share the new direction or angle you want. I will generate a fresh campaign concept tailored to that brief.',
        });
        setInputMode('new-campaign');
      }
    },
    [appendMessage, handleCampaignApproval],
  );

  const handleAction = useCallback(
    async (actionId, payload) => {
      if (actionId === 'connect-linkedin') {
        if (!user) {
          appendMessage({
            id: `no-user-${Date.now()}`,
            role: 'assistant',
            variant: 'text',
            content: 'Please sign in again to continue.',
          });
          return;
        }

        try {
          const authStart = await axios.get(
            `${BACKEND_URL}/api/linkedin/auth/start`,
            { params: { user_id: user.id } },
          );
          const authUrl = authStart.data?.auth_url;
          if (!authUrl) {
            throw new Error('LinkedIn authorization URL missing.');
          }

          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          const popup = window.open(
            authUrl,
            'LinkedIn Authorization',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
          );

          if (!popup) {
            appendMessage({
              id: `popup-blocked-${Date.now()}`,
              role: 'assistant',
              variant: 'text',
              content:
                'Please allow popups in your browser for LinkedIn authentication.',
            });
            return;
          }

          appendMessage({
            id: `linkedin-await-${Date.now()}`,
            role: 'assistant',
            variant: 'text',
            content: 'Waiting for LinkedIn to confirm the connection.',
          });

          const statusPoll = setInterval(async () => {
            const connected = await fetchLinkedInStatus();
            if (connected) {
              clearInterval(statusPoll);
              popup.close();
              handleLinkedInConnected();
            }
          }, 1500);
        } catch (error) {
          appendMessage({
            id: `linkedin-error-${Date.now()}`,
            role: 'assistant',
            variant: 'text',
            content:
              error?.response?.data?.detail ||
              'There was an issue starting the LinkedIn flow. Please try again.',
          });
        }
        return;
      }

      if (actionId === 'confirm-brand') {
        if (currentOrg && brandAnalysis) {
          await generateCampaignPreviews(currentOrg.id, brandAnalysis);
        }
        return;
      }

      if (actionId === 'regenerate-brand') {
        if (currentOrg?.id) {
          try {
            appendMessage({
              id: `brand-retry-${Date.now()}`,
              role: 'assistant',
              variant: 'text',
              content: 'Re-running the brand analysis with a deeper pass.',
            });
            setIsTyping(true);
            const analysis = await addWebsiteMaterialAndAnalyze(
              currentOrg.id,
              currentOrg.website,
            );
            setBrandAnalysis(analysis);
            await generateCampaignPreviews(currentOrg.id, analysis);
          } catch (error) {
            appendMessage({
              id: `brand-retry-error-${Date.now()}`,
              role: 'assistant',
              variant: 'text',
              content:
                error?.message ||
                'Unable to regenerate brand analysis. Please try again later.',
            });
          } finally {
            setIsTyping(false);
          }
        }
        return;
      }

      await handleCampaignAction(actionId, payload);
    },
    [
      user,
      appendMessage,
      fetchLinkedInStatus,
      handleLinkedInConnected,
      currentOrg,
      brandAnalysis,
      generateCampaignPreviews,
      addWebsiteMaterialAndAnalyze,
      handleCampaignAction,
    ],
  );

  const handleWebsiteSubmission = useCallback(
    async (input) => {
      const normalized = normalizeUrl(input);
      if (!normalized) {
        appendMessage({
          id: `invalid-url-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content: 'That does not look like a valid URL. Please share the full website address.',
        });
        return;
      }

      appendMessage({
        id: `website-ack-${Date.now()}`,
        role: 'assistant',
        variant: 'text',
        content: 'Scanning your website for brand cues and messaging signals. This may take a few moments.',
      });

      try {
        setIsTyping(true);
        const brandInfo = await discoverBrandAttributes(normalized);
        const organization = await ensureOrganization(
          brandInfo?.normalizedUrl || normalized,
          brandInfo?.title,
        );
        const analysis = await addWebsiteMaterialAndAnalyze(
          organization.id,
          normalized,
        );
        setBrandAnalysis(analysis);

        const brandCardData = {
          title: brandInfo.title || organization.name,
          description:
            analysis?.key_messages?.slice(0, 2).join(' • ') ||
            brandInfo.description ||
            'Brand summary',
          colorPalette: brandInfo.colorPalette || [],
          fontFamilies: brandInfo.fontFamilies || [],
          imagery: brandInfo.imagery || [],
          toneKeywords: analysis?.brand_tone || brandInfo.toneKeywords || [],
          keywordSummary: brandInfo.keywordSummary || [],
          contentExcerpt:
            analysis?.value_propositions?.slice(0, 2).join(' • ') ||
            brandInfo.contentExcerpt,
          normalizedUrl: brandInfo.normalizedUrl || normalized,
          websiteUrl: normalized,
        };
        setBrandInfo(brandCardData);

        setBrandDiscovered(true);
        setCurrentStep('campaigns');
        // Don't auto-advance - let user see the Brand Identity Card first
        // setCarouselIndex(2); // Removed auto-advance
        appendMessage({
          id: `brand-confirm-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            'Here is your brand identity summary. Would you like to keep this version or regenerate with another scan?',
          actions: [
            { id: 'confirm-brand', label: 'Keep Identity', intent: 'primary' },
            { id: 'regenerate-brand', label: 'Regenerate' },
          ],
        });

        setInputMode('idle');
        setSetupError(null); // Clear any previous errors
      } catch (error) {
        const errorMessage = error?.message || 'Unable to analyze the website. Please verify the URL or try again later.';
        setSetupError(errorMessage);
        appendMessage({
          id: `website-error-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content: errorMessage,
        });
        setInputMode('website');
        throw error; // Re-throw so carousel handler can catch it
      } finally {
        setIsTyping(false);
      }
    },
    [
      appendMessage,
      discoverBrandAttributes,
      ensureOrganization,
      addWebsiteMaterialAndAnalyze,
    ],
  );

  const handleCampaignFeedback = useCallback(
    async (feedback) => {
      if (!currentOrg) {
        return;
      }
      if (!pendingAction) {
        return;
      }

      appendMessage({
        id: `feedback-ack-${Date.now()}`,
        role: 'assistant',
        variant: 'text',
        content: 'Understood. Generating an updated campaign concept based on your guidance.',
      });

      try {
        setIsTyping(true);
        const suggestionName =
          pendingAction.type === 'new'
            ? `Custom Campaign ${campaignPreviews.length + 1}`
            : `${pendingAction.campaign.name} – Refined`;

        const response = await axios.post(
          `${BACKEND_URL}/api/brand/campaign-previews`,
          {
            org_id: currentOrg.id,
            count: 1,
            suggestions: [
              {
                name: suggestionName,
                description: feedback,
                focus: feedback,
              },
            ],
          },
        );

        const newCampaign = response.data?.campaigns?.[0];
        if (newCampaign) {
          const updated = [...campaignPreviews, newCampaign];
          setCampaignPreviews(updated);
          replaceCampaignMessage(updated);
        } else {
          appendMessage({
            id: `feedback-fallback-${Date.now()}`,
            role: 'assistant',
            variant: 'text',
            content: 'Unable to generate a new concept with that feedback. Please try again with additional detail.',
          });
        }
      } catch (error) {
        appendMessage({
          id: `feedback-error-${Date.now()}`,
          role: 'assistant',
          variant: 'text',
          content:
            error?.response?.data?.detail ||
            'Campaign refinement failed. Please try again.',
        });
      } finally {
        setIsTyping(false);
        setInputMode('idle');
        setPendingAction(null);
      }
    },
    [
      appendMessage,
      currentOrg,
      pendingAction,
      campaignPreviews,
      replaceCampaignMessage,
    ],
  );

  const handleSubmit = useCallback(
    async (input) => {
      appendMessage(buildUserMessage(input));

      if (inputMode === 'website') {
        await handleWebsiteSubmission(input);
        return;
      }

      if (inputMode === 'campaign-feedback' || inputMode === 'new-campaign') {
        await handleCampaignFeedback(input);
        return;
      }
    },
    [appendMessage, handleWebsiteSubmission, inputMode, handleCampaignFeedback],
  );

  useEffect(() => {
    const bootstrap = async () => {
      if (!user) {
        return;
      }
      const connected = await fetchLinkedInStatus();
      if (connected) {
        setLinkedinConnected(true);
        setCurrentStep('brand');
        setCarouselIndex(1);
      }
    };
    bootstrap();
  }, [user, fetchLinkedInStatus]);

  // Auto-advance carousel when steps complete (but not brand step - let user review)
  useEffect(() => {
    if (linkedinConnected && carouselIndex === 0) {
      setCarouselIndex(1);
    }
  }, [linkedinConnected, carouselIndex]);

  // Don't auto-advance from brand step - user needs to see Brand Identity Card
  // useEffect(() => {
  //   if (brandDiscovered && carouselIndex === 1) {
  //     setCarouselIndex(2);
  //   }
  // }, [brandDiscovered, carouselIndex]);

  useEffect(() => {
    if (campaignsGenerated && carouselIndex === 2) {
      setCarouselIndex(3);
    }
  }, [campaignsGenerated, carouselIndex]);

  const handleCarouselLinkedInConnect = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setIsTyping(true);
      const authStart = await axios.get(
        `${BACKEND_URL}/api/linkedin/auth/start`,
        { params: { user_id: user.id } },
      );
      const authUrl = authStart.data?.auth_url;
      if (!authUrl) {
        throw new Error('LinkedIn authorization URL missing.');
      }

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        authUrl,
        'LinkedIn Authorization',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );

      if (!popup) {
        return;
      }

      const statusPoll = setInterval(async () => {
        const connected = await fetchLinkedInStatus();
        if (connected) {
          clearInterval(statusPoll);
          popup.close();
          handleLinkedInConnected();
        }
      }, 1500);
    } catch (error) {
      console.error('LinkedIn connection error:', error);
    } finally {
      setIsTyping(false);
    }
  }, [user, handleLinkedInConnected, fetchLinkedInStatus]);

  const handleCarouselWebsiteSubmit = useCallback(
    async (websiteUrl) => {
      setSetupError(null);
      await handleWebsiteSubmission(websiteUrl);
      // Error is handled inside handleWebsiteSubmission and set via setSetupError
    },
    [handleWebsiteSubmission],
  );

  const handleCarouselCampaignAction = useCallback(
    async (actionType, campaign) => {
      await handleCampaignAction(actionType, campaign);
    },
    [handleCampaignAction],
  );

  const handleCampaignUpdate = useCallback((updatedCampaign) => {
    // Update the campaign in the previews list
    setCampaignPreviews((prev) =>
      prev.map((camp) => (camp.id === updatedCampaign.id ? updatedCampaign : camp))
    );
    // Also update in messages if campaign is displayed there
    if (campaignMessageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === campaignMessageId && msg.campaigns
            ? {
                ...msg,
                campaigns: msg.campaigns.map((camp) =>
                  camp.id === updatedCampaign.id ? updatedCampaign : camp
                ),
              }
            : msg
        )
      );
    }
  }, [campaignMessageId]);

  const handleBrandContinue = useCallback(() => {
    // Move to campaigns step after user reviews brand identity
    setCarouselIndex(2);
    // Trigger campaign generation if brand is discovered
    if (currentOrg && brandAnalysis) {
      generateCampaignPreviews(currentOrg.id, brandAnalysis);
    }
  }, [currentOrg, brandAnalysis, generateCampaignPreviews]);

  const setupComplete = campaignsApproved;

  return (
    <>
      {!setupComplete ? (
        <SetupCarousel
          linkedinConnected={linkedinConnected}
          brandDiscovered={brandDiscovered}
          campaignsGenerated={campaignsGenerated}
          campaignsApproved={campaignsApproved}
          brandInfo={brandInfo}
          campaigns={campaignPreviews}
          onLinkedInConnect={handleCarouselLinkedInConnect}
          onWebsiteSubmit={handleCarouselWebsiteSubmit}
          onCampaignAction={handleCarouselCampaignAction}
          isLoading={isTyping}
          carouselIndex={carouselIndex}
          onCarouselIndexChange={setCarouselIndex}
          error={setupError}
          onBrandContinue={handleBrandContinue}
          onCampaignUpdate={handleCampaignUpdate}
          orgId={currentOrg?.id}
          userId={user?.id}
        />
      ) : (
        <>
          <ChatContainer
            messages={messages}
            onSubmit={handleSubmit}
            onAction={handleAction}
            isTyping={isTyping}
            inputDisabled={isTyping}
            placeholder={placeholder}
            showMobileMenu={sidebarUnlocked}
            onMobileMenuClick={() => setMobileMenuOpen(true)}
          />
          {/* Floating Chat Input - Only shown after setup is complete */}
          <FloatingChatInput
            onSubmit={handleSubmit}
            inputDisabled={isTyping}
            placeholder={placeholder}
            value={inputValue}
            setValue={setInputValue}
          />
        </>
      )}
      <MobileNavDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
};

export default ChatExperience;

