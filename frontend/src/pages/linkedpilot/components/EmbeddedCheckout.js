import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { X, Crown, Loader2 } from 'lucide-react';
import axios from 'axios';
import PaymentForm from './PaymentForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Fetch Stripe publishable key from backend
let stripePromiseCache = null;
const getStripePromise = async () => {
  if (stripePromiseCache) return stripePromiseCache;
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/billing/stripe-config`);
    const publishableKey = response.data.publishableKey;
    if (publishableKey) {
      stripePromiseCache = loadStripe(publishableKey);
      return stripePromiseCache;
    }
  } catch (error) {
    console.error('Failed to fetch Stripe config:', error);
  }
  return null;
};

const DEFAULT_THEME = {
  background: '#1A1A1A',
  foreground: '#FFFFFF',
  primary: '#88D9E7',
  border: '#2A2A2A',
  muted: 'rgba(255,255,255,0.08)',
  destructive: '#EF4444'
};

const getCssColor = (variableName) => {
  if (typeof window === 'undefined') return null;
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(variableName);
  return value ? `hsl(${value.trim()})` : null;
};

const PaymentElementCheckout = ({ isOpen, onClose, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (isOpen) {
      console.log('🟢 [PaymentElementCheckout] Modal opened, initializing...');
      if (typeof window !== 'undefined') {
        const background = getCssColor('--card') || DEFAULT_THEME.background;
        const foreground = getCssColor('--foreground') || DEFAULT_THEME.foreground;
        const primary = getCssColor('--primary') || DEFAULT_THEME.primary;
        const border = getCssColor('--border') || DEFAULT_THEME.border;
        const muted = getCssColor('--muted') || DEFAULT_THEME.muted;
        const destructive = getCssColor('--destructive') || DEFAULT_THEME.destructive;
        setTheme({
          background,
          foreground,
          primary,
          border,
          muted,
          destructive
        });
      }
      initializePayment();
    } else {
      console.log('🔴 [PaymentElementCheckout] Modal closed, cleaning up...');
      setClientSecret('');
      setError('');
    }
  }, [isOpen]);

  const initializePayment = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📍 [PaymentElementCheckout] Loading Stripe...');

      // Load Stripe
      const promise = await getStripePromise();
      if (!promise) {
        setError('Stripe is not configured. Please contact support.');
        setLoading(false);
        return;
      }
      setStripePromise(promise);
      console.log('✅ [PaymentElementCheckout] Stripe loaded');

      // Create subscription and get client secret
      console.log('📍 [PaymentElementCheckout] Creating subscription...');
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${BACKEND_URL}/api/billing/create-subscription`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ [PaymentElementCheckout] Subscription created');
      setClientSecret(response.data.clientSecret);
      setLoading(false);
    } catch (err) {
      console.error('❌ [PaymentElementCheckout] Error:', err);
      setError(err.response?.data?.detail || 'Failed to initialize payment. Please try again.');
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    console.log('🎉 [PaymentElementCheckout] Payment successful!');
    onClose();
    if (onSuccess) {
      await onSuccess();
    }
  };

  const handlePaymentError = (error) => {
    console.error('❌ [PaymentElementCheckout] Payment failed:', error);
    setError(error.message || 'Payment failed. Please try again.');
  };

  if (!isOpen) return null;

  const prefersDark = typeof window !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : true;

  const options = {
    clientSecret,
    appearance: {
      theme: prefersDark ? 'night' : 'stripe',
      variables: {
        colorPrimary: theme.primary,
        colorBackground: theme.background,
        colorText: theme.foreground,
        colorDanger: theme.destructive,
        fontFamily: '"Inter", sans-serif',
        spacingUnit: '4px',
        borderRadius: '12px',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-foreground">Upgrade to Pro</h2>
              <p className="text-sm text-muted-foreground font-light">$30/month • Cancel anytime</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Initializing secure checkout...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-6 text-sm">
                {error}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={initializePayment}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="bg-muted hover:bg-muted/80 text-foreground px-6 py-2 rounded-full text-sm font-medium transition-colors border border-border"
                >
                  Close
                </button>
              </div>
            </div>
          ) : clientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm 
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" />
              <p>Preparing checkout...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentElementCheckout;
