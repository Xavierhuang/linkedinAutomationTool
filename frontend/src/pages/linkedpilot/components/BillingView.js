import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { CreditCard, Zap, TrendingUp, AlertCircle, Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmbeddedCheckout from './EmbeddedCheckout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BillingView = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
      fetchPaymentHistory();
    }
  }, [user]);

  // Debug: Track showCheckout state changes
  useEffect(() => {
    console.log(`🟦 [BillingView] showCheckout changed to: ${showCheckout}`);
  }, [showCheckout]);

  const fetchSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/billing/subscription-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('📊 [BillingView] Subscription status received:', JSON.stringify(response.data, null, 2));
      console.log('   - Tier:', response.data.user_subscription?.subscription_tier);
      console.log('   - Cancel at period end:', response.data.stripe_details?.cancel_at_period_end);
      setSubscriptionStatus(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/billing/payment-history`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPaymentHistory(response.data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const handleUpgrade = () => {
    console.log('🟦 [BillingView] handleUpgrade called - opening checkout modal');
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = async () => {
    console.log('🟦 [BillingView] handleCheckoutSuccess - closing checkout modal');
    setShowCheckout(false);
    setLoading(true);
    
    // Wait for webhooks to process (they usually take 1-3 seconds)
    console.log('⏳ [BillingView] Waiting for subscription to activate...');
    
    // Retry up to 5 times with 2-second intervals
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`🔄 [BillingView] Checking subscription status (attempt ${retries + 1}/${maxRetries})`);
      await fetchSubscriptionStatus();
      
      // Check if subscription is now active
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/billing/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.subscription_tier === 'pro') {
        console.log('✅ [BillingView] Subscription confirmed as Pro!');
        break;
      }
      
      retries++;
    }
    
    await fetchPaymentHistory();
    setLoading(false);
    
    // Show success message
    alert('🎉 Welcome to Pro! Your subscription is now active.');
  };

  const handleCancelSubscription = async (immediate = false) => {
    const message = immediate 
      ? 'TESTING MODE: This will immediately cancel your subscription. Continue?' 
      : 'Are you sure you want to cancel your subscription? You will still have access until the end of the billing period.';
    
    if (!window.confirm(message)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/billing/cancel-subscription?immediate=${immediate}`, 
        {}, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log('⏳ [BillingView] Waiting for subscription cancellation to process...');
      
      // Wait for webhooks to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('🔄 [BillingView] Fetching updated subscription status...');
      // Refresh subscription status
      await fetchSubscriptionStatus();
      await fetchPaymentHistory();
      console.log('✅ [BillingView] Subscription data refreshed');
      setLoading(false);
      
      const successMsg = immediate 
        ? '✅ Subscription cancelled immediately! You can now test the embedded checkout.' 
        : 'Subscription cancelled. You will have access until the end of your billing period.';
      
      alert(successMsg);
    } catch (error) {
      setLoading(false);
      console.error('Error cancelling subscription:', error);
      alert(`Failed to cancel subscription: ${error.response?.data?.detail || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const currentTier = subscriptionStatus?.user_subscription?.subscription_tier || 'free';
  const subStatus = subscriptionStatus?.user_subscription?.subscription_status || 'inactive';
  
  // User is considered Pro only if tier is 'pro' AND status is 'active'
  const isProUser = currentTier === 'pro' && subStatus === 'active';
  
  console.log(`🔍 [BillingView] User status - Tier: ${currentTier}, Status: ${subStatus}, Is Pro: ${isProUser}`);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your subscription and view usage statistics
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Current Plan */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Current Plan</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {isProUser ? 'Professional features unlocked' : 'Start with our free plan'}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full font-semibold ${
                  isProUser
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isProUser ? 'PRO' : 'FREE'}
              </div>
            </div>

            {isProUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Crown className="w-5 h-5 text-purple-600" />
                  <span className="text-gray-900 font-medium">$30/month</span>
                </div>
                {subscriptionStatus?.stripe_details && (
                  <div className="text-sm text-gray-600">
                    <p>
                      Next billing date:{' '}
                      {new Date(
                        subscriptionStatus.stripe_details.current_period_end * 1000
                      ).toLocaleDateString()}
                    </p>
                    {subscriptionStatus.stripe_details.cancel_at_period_end && (
                      <p className="text-orange-600 font-medium mt-2">
                        Subscription will be cancelled at the end of the billing period
                      </p>
                    )}
                  </div>
                )}
                {!subscriptionStatus?.stripe_details?.cancel_at_period_end && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCancelSubscription(false)}
                      variant="outline"
                      className="border-red-600 text-red-600 hover:bg-red-50"
                    >
                      Cancel Subscription
                    </Button>
                    <Button
                      onClick={() => handleCancelSubscription(true)}
                      variant="outline"
                      className="border-orange-600 text-orange-600 hover:bg-orange-50 text-xs"
                      title="For testing: Immediately cancel and reset to Free tier"
                    >
                      ⚡ Test: Cancel Now
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show cancellation message if user was Pro but cancelled */}
                {currentTier === 'pro' && subStatus === 'cancelled' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-orange-800 font-medium">
                      Your subscription has been cancelled
                    </p>
                    <p className="text-sm text-orange-600 mt-1">
                      You've been downgraded to the free plan. Subscribe again to regain Pro features.
                    </p>
                  </div>
                )}
                <p className="text-gray-600">
                  You're currently on the free plan. Upgrade to Pro for unlimited access.
                </p>
                <Button
                  onClick={handleUpgrade}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Upgrade to Pro - $30/month
                </Button>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Tokens */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Tokens</h3>
                  <p className="text-xs text-gray-600">This month</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {subscriptionStatus?.user_subscription?.ai_tokens_used?.toLocaleString() || 0}
                  </span>
                  <span className="text-sm text-gray-600">
                    / {subscriptionStatus?.user_subscription?.ai_tokens_limit?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        ((subscriptionStatus?.user_subscription?.ai_tokens_used || 0) /
                          (subscriptionStatus?.user_subscription?.ai_tokens_limit || 1)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                {((subscriptionStatus?.user_subscription?.ai_tokens_used || 0) /
                  (subscriptionStatus?.user_subscription?.ai_tokens_limit || 1)) *
                  100 >
                  80 && !isProUser && (
                  <p className="text-xs text-orange-600 font-medium">
                    You're running low on AI tokens. Consider upgrading to Pro.
                  </p>
                )}
              </div>
            </div>

            {/* Posts */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Posts Created</h3>
                  <p className="text-xs text-gray-600">This month</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {subscriptionStatus?.user_subscription?.posts_this_month || 0}
                  </span>
                  <span className="text-sm text-gray-600">
                    /{' '}
                    {subscriptionStatus?.user_subscription?.post_limit_per_month === -1
                      ? '∞'
                      : subscriptionStatus?.user_subscription?.post_limit_per_month || 0}
                  </span>
                </div>
                {subscriptionStatus?.user_subscription?.post_limit_per_month !== -1 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          ((subscriptionStatus?.user_subscription?.posts_this_month || 0) /
                            (subscriptionStatus?.user_subscription?.post_limit_per_month || 1)) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature Comparison */}
          {!isProUser && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Upgrade to Pro
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Free Plan</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      1,000 AI tokens/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      50 posts/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      2 active campaigns
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-purple-300">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-purple-600" />
                    Pro Plan - $30/month
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                      <Check className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      10,000 AI tokens/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                      <Check className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      Unlimited posts
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                      <Check className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      Unlimited campaigns
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                      <Check className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      Priority support
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                      <Check className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      Advanced analytics
                    </li>
                  </ul>
                  <Button
                    onClick={handleUpgrade}
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Upgrade Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          {isProUser && paymentHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(payment.date * 1000).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {payment.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {payment.invoice_pdf && (
                            <a
                              href={payment.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-900"
                            >
                              Download PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Checkout Modal */}
      <EmbeddedCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        user={user}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
};

export default BillingView;

