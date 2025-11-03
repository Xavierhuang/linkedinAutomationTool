import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { X, Crown } from 'lucide-react';
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

const PaymentElementCheckout = ({ isOpen, onClose, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (isOpen) {
      console.log('🟢 [PaymentElementCheckout] Modal opened, initializing...');
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

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Crown className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Upgrade to Pro</h2>
              <p className="text-sm text-gray-600">$30/month</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading payment form...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
                {error}
              </div>
              <button
                onClick={initializePayment}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="ml-4 text-gray-600 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          ) : clientSecret && stripePromise ? (
            <div>
              <Elements stripe={stripePromise} options={options}>
                <PaymentForm 
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  Secure payment powered by <span className="font-semibold">Stripe</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              Initializing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentElementCheckout;
