import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Linkedin, Globe, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { FramerCarousel } from '@/components/ui/framer-carousel';
import BrandIdentityCard from './BrandIdentityCard';
import CampaignCard from './CampaignCard';
import designTokens from '@/designTokens';

// Step 1: LinkedIn Connection Card
const LinkedInStepCard = ({ onConnect, isConnected, isLoading }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[600px] flex flex-col items-center justify-center p-8"
    >
      <div
        className="w-full max-w-2xl rounded-3xl border backdrop-blur-2xl p-8"
        style={{
          borderColor: designTokens.colors.border.default,
          background: designTokens.colors.background.chat,
          boxShadow: designTokens.shadow.lg,
        }}
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: isConnected
                ? designTokens.colors.accent.greenGlow
                : 'rgba(255,255,255,0.1)',
              border: `1px solid ${designTokens.colors.border.light}`,
            }}
          >
            {isConnected ? (
              <CheckCircle2 className="w-10 h-10 text-black" />
            ) : (
              <Linkedin className="w-10 h-10 text-white" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {isConnected ? 'LinkedIn Connected' : 'Connect Your LinkedIn Account'}
            </h2>
            <p className="text-white/60 leading-relaxed max-w-md">
              {isConnected
                ? 'Your LinkedIn account is connected. We\'ll use this to publish content on your behalf once your campaign is approved.'
                : 'Connect your LinkedIn account so we can publish content on your behalf once your campaign is ready.'}
            </p>
          </div>

          {!isConnected && (
            <button
              type="button"
              onClick={onConnect}
              disabled={isLoading}
              className="px-8 py-4 rounded-full bg-white text-black font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Linkedin className="w-5 h-5" />
                  Connect LinkedIn
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Step 2: Brand Discovery Card
const BrandStepCard = ({ onWebsiteSubmit, brandInfo, isLoading, isCompleted, error, onContinue }) => {
  const [websiteUrl, setWebsiteUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (websiteUrl.trim()) {
      onWebsiteSubmit(websiteUrl.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[600px] flex flex-col items-center justify-center p-8"
    >
      <div
        className={`w-full rounded-3xl border backdrop-blur-2xl p-8 ${
          isCompleted ? 'max-w-7xl' : 'max-w-2xl'
        }`}
        style={{
          borderColor: designTokens.colors.border.default,
          background: designTokens.colors.background.chat,
          boxShadow: designTokens.shadow.lg,
        }}
      >
        {!isCompleted ? (
          <div className="flex flex-col items-center text-center space-y-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: `1px solid ${designTokens.colors.border.light}`,
              }}
            >
              <Globe className="w-10 h-10 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Discover Your Brand
              </h2>
              <p className="text-white/60 leading-relaxed max-w-md">
                Share your organization's website URL so we can automatically analyze your brand identity, colors, fonts, and messaging.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourcompany.com"
                disabled={isLoading}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 ${
                  error ? 'border-red-500/50' : 'border-white/20'
                }`}
              />
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={!websiteUrl.trim() || isLoading}
                className="w-full px-8 py-4 rounded-full bg-white text-black font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5" />
                    Analyze Website
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: designTokens.colors.accent.greenGlow,
                }}
              >
                <CheckCircle2 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Brand Discovered</h2>
                <p className="text-sm text-white/60">Your brand identity has been analyzed</p>
              </div>
            </div>
            {brandInfo && <BrandIdentityCard brand={brandInfo} />}
            {onContinue && (
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={onContinue}
                  className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  Continue to Campaigns
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Step 3: Campaign Generation Card
const CampaignStepCard = ({ campaigns, onAction, isLoading, isCompleted, onCampaignUpdate, orgId, userId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[600px] flex flex-col items-center justify-center p-8"
    >
      <div
        className="w-full max-w-5xl rounded-3xl border backdrop-blur-2xl p-8"
        style={{
          borderColor: designTokens.colors.border.default,
          background: designTokens.colors.background.chat,
          boxShadow: designTokens.shadow.lg,
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <p className="text-white/60">Generating campaign concepts...</p>
          </div>
        ) : isCompleted && campaigns.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: designTokens.colors.accent.greenGlow,
                }}
              >
                <CheckCircle2 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Campaigns Generated</h2>
                <p className="text-sm text-white/60">
                  Review and select your preferred campaign concept
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onAction={onAction}
                  disabled={false}
                  onUpdate={onCampaignUpdate}
                  orgId={orgId}
                  userId={userId}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-6 py-20">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: `1px solid ${designTokens.colors.border.light}`,
              }}
            >
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Generate Campaign Concepts
              </h2>
              <p className="text-white/60 leading-relaxed max-w-md">
                Campaign concepts will be generated automatically after brand discovery is complete.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Step 4: Approval Step Card
const ApproveStepCard = ({ isCompleted, campaigns, onAction, onCampaignUpdate, orgId, userId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[600px] flex flex-col items-center justify-center p-8"
    >
      <div
        className="w-full max-w-[210mm] rounded-3xl border backdrop-blur-2xl p-8"
        style={{
          borderColor: designTokens.colors.border.default,
          background: designTokens.colors.background.chat,
          boxShadow: designTokens.shadow.lg,
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-6 mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: isCompleted
                ? designTokens.colors.accent.greenGlow
                : 'rgba(255,255,255,0.1)',
              border: `1px solid ${designTokens.colors.border.light}`,
            }}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-10 h-10 text-black" />
            ) : (
              <Sparkles className="w-10 h-10 text-white" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {isCompleted ? 'Setup Complete!' : 'Approve Your Campaign'}
            </h2>
            <p className="text-white/60 leading-relaxed max-w-md">
              {isCompleted
                ? 'Your campaign has been approved and your first week of posts has been generated. You can now access all features in the sidebar.'
                : 'Select a campaign from below and click "Approve" to complete setup.'}
            </p>
          </div>
        </div>

        {/* Campaign Cards - A4 Size, Always Expanded */}
        {!isCompleted && campaigns && campaigns.length > 0 && (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onAction={onAction}
                disabled={false}
                onUpdate={onCampaignUpdate}
                orgId={orgId}
                userId={userId}
                forceExpanded={true}
                a4Size={true}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const SetupCarousel = ({
  linkedinConnected,
  brandDiscovered,
  campaignsGenerated,
  campaignsApproved,
  brandInfo,
  campaigns,
  onLinkedInConnect,
  onWebsiteSubmit,
  onCampaignAction,
  isLoading,
  carouselIndex,
  onCarouselIndexChange,
  error,
  onBrandContinue,
  onCampaignUpdate,
  orgId,
  userId,
}) => {
  const carouselItems = useMemo(
    () => [
      {
        id: 'linkedin',
        title: 'Connect LinkedIn',
        content: (
          <LinkedInStepCard
            onConnect={onLinkedInConnect}
            isConnected={linkedinConnected}
            isLoading={isLoading}
          />
        ),
        completed: linkedinConnected,
      },
      {
        id: 'brand',
        title: 'Discover Brand',
        content: (
          <BrandStepCard
            onWebsiteSubmit={onWebsiteSubmit}
            brandInfo={brandInfo}
            isLoading={isLoading}
            isCompleted={brandDiscovered}
            error={error}
            onContinue={brandDiscovered ? onBrandContinue : undefined}
          />
        ),
        completed: brandDiscovered,
      },
      {
        id: 'campaigns',
        title: 'Generate Campaigns',
        content: (
          <CampaignStepCard
            campaigns={campaigns}
            onAction={onCampaignAction}
            isLoading={isLoading && !campaignsGenerated}
            isCompleted={campaignsGenerated}
            onCampaignUpdate={onCampaignUpdate}
            orgId={orgId}
            userId={userId}
          />
        ),
        completed: campaignsGenerated,
      },
      {
        id: 'approve',
        title: 'Approve Campaign',
        content: (
          <ApproveStepCard
            isCompleted={campaignsApproved}
            campaigns={campaigns}
            onAction={onCampaignAction}
            onCampaignUpdate={onCampaignUpdate}
            orgId={orgId}
            userId={userId}
          />
        ),
        completed: campaignsApproved,
      },
    ],
    [
      linkedinConnected,
      brandDiscovered,
      campaignsGenerated,
      campaignsApproved,
      brandInfo,
      campaigns,
      onLinkedInConnect,
      onWebsiteSubmit,
      onCampaignAction,
      isLoading,
      onCampaignUpdate,
      orgId,
      userId,
    ],
  );

  const canGoNext = useMemo(() => {
    if (carouselIndex === 0) return linkedinConnected;
    if (carouselIndex === 1) return brandDiscovered;
    if (carouselIndex === 2) return campaignsGenerated;
    return false;
  }, [carouselIndex, linkedinConnected, brandDiscovered, campaignsGenerated]);

  const canGoPrevious = carouselIndex > 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center py-12 px-6 lg:px-8">
      <div className="w-full max-w-[95vw] lg:max-w-[90vw]">
        <FramerCarousel
          items={carouselItems}
          currentIndex={carouselIndex}
          onIndexChange={onCarouselIndexChange}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
        />
      </div>
    </div>
  );
};

export default SetupCarousel;

