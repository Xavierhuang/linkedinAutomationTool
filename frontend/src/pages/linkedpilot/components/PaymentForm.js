import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <div className="bg-card p-4 rounded-xl border border-border">
        <PaymentElement 
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
            },
          }}
        />
      </div>
      
      {errorMessage && (
        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-primary text-primary-foreground py-6 px-4 rounded-xl font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(136,217,231,0.1)] hover:shadow-[0_0_30px_rgba(136,217,231,0.2)]"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing Secure Payment...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Confirm Subscription
          </>
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center uppercase tracking-wide font-medium">
        Secured by Stripe • Cancel Anytime
      </p>
    </form>
  );
};

export default PaymentForm;
