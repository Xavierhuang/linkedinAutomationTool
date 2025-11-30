import React from 'react';
import { motion } from 'framer-motion';
import BrandIdentityCard from './BrandIdentityCard';
import CampaignCard from './CampaignCard';
import PostPreviewCard from './PostPreviewCard';

const MessageBubble = ({
  message,
  onAction,
  disabled,
}) => {
  if (!message) {
    return null;
  }

  const alignment = message.role === 'user' ? 'items-end' : 'items-start';
  const isUser = message.role === 'user';
  
  const bubbleClasses = isUser
    ? 'bg-white/30 text-black font-semibold self-end'
    : 'bg-white/10 text-white self-start';

  return (
    <motion.div
      className={`flex flex-col ${alignment} gap-3`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {message.variant === 'brand' ? (
        <BrandIdentityCard brand={message.brand} />
      ) : null}

      {message.variant === 'campaigns' && Array.isArray(message.campaigns) ? (
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {message.campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onAction={(actionType, campaignData) => onAction(actionType, campaignData || campaign)}
                disabled={false}
              />
            ))}
          </div>
        </div>
      ) : null}

      {message.variant === 'posts' ? (
        <PostPreviewCard posts={message.posts} />
      ) : null}

      {message.variant === 'text' && message.content ? (
        <div
          className={`max-w-[80%] ${bubbleClasses} px-3 py-2 rounded-xl shadow-md backdrop-blur-md`}
        >
          {message.content}
        </div>
      ) : null}

      {Array.isArray(message.actions) && message.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {message.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id, action.payload)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                action.intent === 'primary'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:scale-[1.02] shadow-lg shadow-blue-500/25'
                  : 'bg-white/10 text-white/90 hover:bg-white/15 border border-white/10'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
};

export default MessageBubble;

