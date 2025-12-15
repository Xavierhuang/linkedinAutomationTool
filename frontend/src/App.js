import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ApiKeyProvider, useApiKey } from '@/contexts/ApiKeyContext';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SettingsButton } from '@/components/SettingsButton';
import ApiKeyModal from '@/components/ApiKeyModal';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Pricing from '@/pages/Pricing';

// Direct import to avoid lazy loading issues
import LinkedPilotDashboard from '@/pages/linkedpilot/LinkedPilotDashboard';
import OnboardingFlow from '@/pages/linkedpilot/components/onboarding/OnboardingFlow';
import TextEditorPage from '@/pages/linkedpilot/components/TextEditorPage';

// 21st.dev Toolbar (development only)
import { TwentyFirstToolbar } from '@21st-extension/toolbar-react';
import { ReactPlugin } from '@21st-extension/react';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Redirect to onboarding only if user hasn't completed it AND not already on onboarding page
  if (!user.onboarding_completed && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }

  return children;
};

// Separate route component for onboarding that redirects old users to dashboard
const OnboardingRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [hasOrgs, setHasOrgs] = React.useState(null);
  const [checkingOrgs, setCheckingOrgs] = React.useState(true);
  const hasCheckedRef = React.useRef(false);

  React.useEffect(() => {
    // Only check once per user ID to prevent infinite polling
    if (!user || hasCheckedRef.current === user.id) {
      if (!user) {
        setCheckingOrgs(false);
      }
      return;
    }

    const checkOrganizations = async () => {
      try {
        const axios = (await import('axios')).default;
        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        const token = localStorage.getItem('token');
        const response = await axios.get(`${BACKEND_URL}/api/organizations`, {
          params: { user_id: user.id },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const orgs = Array.isArray(response.data) ? response.data : [];
        setHasOrgs(orgs.length > 0);
        hasCheckedRef.current = user.id; // Mark as checked for this user ID
      } catch (error) {
        // Silently fail - don't block onboarding if API call fails
        console.warn('Error checking organizations (non-blocking):', error);
        setHasOrgs(false);
        hasCheckedRef.current = user.id; // Mark as checked even on error
      } finally {
        setCheckingOrgs(false);
      }
    };

    checkOrganizations();
  }, [user?.id]); // Only depend on user.id, not the entire user object

  if (loading || checkingOrgs) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user has already completed onboarding, redirect to dashboard
  // Note: We allow users with organizations to still access onboarding if they haven't completed it
  // This allows them to complete onboarding even if they have existing organizations
  if (user.onboarding_completed) {
    return <Navigate to="/dashboard" />;
  }
  
  // If user has organizations but hasn't completed onboarding, allow them to continue onboarding
  // This prevents users from being stuck if they have orgs but onboarding_completed is false

  return children;
};

const AppContent = () => {
  const { showApiKeyModal, requiredKeyType, handleModalClose, handleKeySaved } = useApiKey();

  return (
    <>
      <ThemeToggle />
      <SettingsButton />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingFlow />
            </OnboardingRoute>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <LinkedPilotDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/text-editor/:projectId?"
          element={
            <ProtectedRoute>
              <TextEditorPage />
            </ProtectedRoute>
          }
        />
      </Routes>

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={handleModalClose}
        keyType={requiredKeyType}
        onSaved={handleKeySaved}
      />
    </>
  );
};

function App() {
  let toolbar = null;
  // if (process.env.NODE_ENV === 'development') {
  //   toolbar = <TwentyFirstToolbar config={{ plugins: [ReactPlugin] }} />;
  // }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ApiKeyProvider>
          <BrowserRouter>
            <AppContent />
            {toolbar}
          </BrowserRouter>
        </ApiKeyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;