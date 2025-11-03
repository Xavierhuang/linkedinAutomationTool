import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Disable browser console logging for security (can be reverted later)
(() => {
  try {
    const noop = () => {};
    // eslint-disable-next-line no-console
    console.log = noop;
    // eslint-disable-next-line no-console
    console.info = noop;
    // eslint-disable-next-line no-console
    console.debug = noop;
    // eslint-disable-next-line no-console
    console.warn = noop;
    // eslint-disable-next-line no-console
    console.error = noop;
  } catch (e) {
    // ignore
  }
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);










