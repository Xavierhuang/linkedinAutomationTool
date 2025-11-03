import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Zap, FileText, TrendingUp, AlertCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const UsageWidget = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsage();
    }
  }, [user]);

  const fetchUsage = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/billing/subscription-status`);
      setUsage(response.data.user_subscription);
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) {
    return null;
  }

  const isProUser = usage.subscription_tier === 'pro';
  const tokenPercentage = (usage.ai_tokens_used / usage.ai_tokens_limit) * 100;
  const postPercentage = usage.post_limit_per_month === -1 
    ? 0 
    : (usage.posts_this_month / usage.post_limit_per_month) * 100;

  const showWarning = !isProUser && (tokenPercentage > 80 || postPercentage > 80);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Your Usage
        </h3>
        <div
          className={`px-2 py-1 text-xs font-semibold rounded-full ${
            isProUser
              ? 'bg-purple-100 text-purple-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {isProUser ? 'PRO' : 'FREE'}
        </div>
      </div>

      {showWarning && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-orange-800 font-medium">
              You're running low on resources
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard/billing'}
              className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-white text-xs h-7"
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* AI Tokens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">AI Tokens</span>
            </div>
            <span className="text-xs text-gray-600">
              {usage.ai_tokens_used.toLocaleString()} / {usage.ai_tokens_limit.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                tokenPercentage > 90
                  ? 'bg-red-500'
                  : tokenPercentage > 70
                  ? 'bg-orange-500'
                  : 'bg-purple-600'
              }`}
              style={{ width: `${Math.min(tokenPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Posts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Posts</span>
            </div>
            <span className="text-xs text-gray-600">
              {usage.posts_this_month} /{' '}
              {usage.post_limit_per_month === -1 ? '∞' : usage.post_limit_per_month}
            </span>
          </div>
          {usage.post_limit_per_month !== -1 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  postPercentage > 90
                    ? 'bg-red-500'
                    : postPercentage > 70
                    ? 'bg-orange-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(postPercentage, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {!isProUser && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">Upgrade to Pro</span>
          </div>
          <ul className="space-y-1 mb-3">
            <li className="text-xs text-gray-600">• 10,000 AI tokens/month</li>
            <li className="text-xs text-gray-600">• Unlimited posts</li>
            <li className="text-xs text-gray-600">• Priority support</li>
          </ul>
          <Button
            onClick={() => window.location.href = '/dashboard/billing'}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
          >
            Upgrade - $49/month
          </Button>
        </div>
      )}
    </div>
  );
};

export default UsageWidget;










