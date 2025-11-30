import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { CreditCard, Zap, Crown, CheckCircle2, X } from 'lucide-react';
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

  const fetchSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/billing/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentHistory(response.data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const handleUpgrade = () => setShowCheckout(true);

  const handleCheckoutSuccess = async () => {
    setShowCheckout(false);
    setLoading(true);
    
    // Poll for activation
    let retries = 0;
    const maxRetries = 5;
    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/billing/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.user_subscription?.subscription_tier === 'pro') {
        break;
      }
      retries++;
    }
    
    await Promise.all([fetchSubscriptionStatus(), fetchPaymentHistory()]);
    setLoading(false);
    alert('🎉 Welcome to Pro! Your subscription is active.');
  };

  const handleCancelSubscription = async (immediate = false) => {
    if (!window.confirm('Are you sure you want to cancel?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${BACKEND_URL}/api/billing/cancel-subscription?immediate=${immediate}`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.all([fetchSubscriptionStatus(), fetchPaymentHistory()]);
      setLoading(false);
      alert('Subscription cancelled successfully.');
    } catch (error) {
      setLoading(false);
      console.error('Error cancelling:', error);
      alert('Failed to cancel subscription.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPro = subscriptionStatus?.user_subscription?.subscription_tier === 'pro' && 
                subscriptionStatus?.user_subscription?.subscription_status === 'active';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Current Plan Card */}
      <div className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-serif italic text-foreground">Current Plan</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${isPro ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
            </div>
            <p className="text-muted-foreground font-light">
              {isPro ? 'You have access to all professional features.' : 'Upgrade to unlock unlimited AI content generation.'}
            </p>
          </div>

          {isPro ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-primary">
                <Crown className="w-5 h-5" />
                <span className="font-medium">$30/month</span>
              </div>
              {subscriptionStatus?.stripe_details?.cancel_at_period_end ? (
                <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">Cancels at period end</span>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCancelSubscription(false)}
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Cancel Subscription
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={handleUpgrade}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl px-8 h-12 shadow-lg hover:shadow-xl transition-all"
            >
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">AI Usage</h3>
              <p className="text-xs text-muted-foreground">Monthly token consumption</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="text-foreground font-medium">
                {subscriptionStatus?.user_subscription?.ai_tokens_used?.toLocaleString() || 0} / {subscriptionStatus?.user_subscription?.ai_tokens_limit?.toLocaleString() || 0}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((subscriptionStatus?.user_subscription?.ai_tokens_used || 0) / (subscriptionStatus?.user_subscription?.ai_tokens_limit || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Payment Method</h3>
              <p className="text-xs text-muted-foreground">Manage your billing details</p>
            </div>
          </div>

          {isPro ? (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-5 bg-background rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  CARD
                </div>
                <span className="text-sm text-foreground/80">•••• •••• •••• 4242</span>
              </div>
              <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-2">
              No active payment method
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-medium text-foreground">Payment History</h3>
        </div>
        <div className="divide-y divide-border/50">
          {paymentHistory.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No payment history available</div>
          ) : (
            paymentHistory.map((payment) => (
              <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/70 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${payment.status === 'succeeded' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {payment.status === 'succeeded' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{payment.description || 'Subscription Payment'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(payment.created * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">${(payment.amount / 100).toFixed(2)}</p>
                  <p className={`text-xs capitalize ${payment.status === 'succeeded' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {payment.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <EmbeddedCheckout 
        isOpen={showCheckout} 
        onClose={() => setShowCheckout(false)} 
        onSuccess={handleCheckoutSuccess}
        user={user}
      />
    </div>
  );
};

export default BillingView;
