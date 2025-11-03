import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

const PaymentForm = ({ onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    console.log('💳 [PaymentForm] Starting payment confirmation...');

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/settings?payment=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('❌ [PaymentForm] Payment error:', error);
        setErrorMessage(error.message);
        setProcessing(false);
        if (onError) onError(error);
      } else {
        console.log('✅ [PaymentForm] Payment successful!');
        setProcessing(false);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('❌ [PaymentForm] Unexpected error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setProcessing(false);
      if (onError) onError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {errorMessage && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          'Subscribe Now'
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By subscribing, you agree to our terms and authorize us to charge your payment method.
      </p>
    </form>
  );
};

export default PaymentForm;









