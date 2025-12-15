import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Suppress non-critical network errors from external services
(() => {
  // Filter out known non-critical errors
  const originalError = console.error;
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    
    // Suppress PostHog analytics errors (likely from browser extension)
    if (errorMessage.includes('posthog.com') || errorMessage.includes('POSTHOG')) {
      return;
    }
    
    // Suppress Stripe network errors (non-critical, Stripe will retry)
    if (errorMessage.includes('stripe.com') || errorMessage.includes('stripe.network') || 
        errorMessage.includes('STRIPE') || errorMessage.includes('Failed to load resource')) {
      // Only suppress if it's a network error, not actual Stripe errors
      if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || errorMessage.includes('ERR_NETWORK_CHANGED')) {
        return;
      }
    }
    
    // Suppress browser extension and Stripe iframe errors
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('listener indicated an asynchronous response')) {
      return;
    }
    
    // Suppress Stripe iframe communication errors (harmless)
    if ((errorMessage.includes('stripe.com') || errorMessage.includes('stripe.network')) &&
        (errorMessage.includes('message channel') || errorMessage.includes('asynchronous response'))) {
      return;
    }
    
    // Suppress CSP font violation warnings (fonts are allowed, these are just warnings)
    if (errorMessage.includes('Content Security Policy') && 
        errorMessage.includes('font-src')) {
      return;
    }
    
    // Call original error handler for all other errors
    originalError.apply(console, args);
  };

  // Suppress unhandled promise rejections from external services
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || String(event.reason || '');
    const errorStack = event.reason?.stack || '';
    const fullError = errorMessage + ' ' + errorStack;
    
    // Suppress PostHog errors
    if (fullError.includes('posthog') || fullError.includes('POSTHOG')) {
      event.preventDefault();
      return;
    }
    
    // Suppress Stripe network errors (including undefined errors from Stripe SDK)
    if (fullError.includes('stripe') || fullError.includes('STRIPE') || 
        fullError.includes('stripe.com') || fullError.includes('stripe.network')) {
      // Suppress network errors, undefined promise rejections, and iframe communication errors from Stripe
      if (fullError.includes('ERR_NAME_NOT_RESOLVED') || 
          fullError.includes('ERR_NETWORK_CHANGED') ||
          errorMessage === 'undefined' ||
          !errorMessage ||
          fullError.includes('message channel') ||
          fullError.includes('asynchronous response')) {
        event.preventDefault();
        return;
      }
    }
    
    // Suppress browser extension and Stripe iframe errors
    if (fullError.includes('message channel closed') || 
        fullError.includes('asynchronous response') ||
        fullError.includes('listener indicated')) {
      event.preventDefault();
      return;
    }
  }, { passive: true });

  // Suppress network errors in the console
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const warningMessage = args.join(' ');
    
    // Suppress known non-critical warnings
    if (warningMessage.includes('posthog') || 
        warningMessage.includes('stripe.network') ||
        warningMessage.includes('message channel')) {
      return;
    }
    
    originalWarn.apply(console, args);
  };
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // Temporarily disabled StrictMode for Stripe Embedded Checkout
  // React.StrictMode causes double-mounting which conflicts with Stripe
  <App />
);
