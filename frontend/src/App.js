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

  React.useEffect(() => {
    const checkOrganizations = async () => {
      if (!user) {
        setCheckingOrgs(false);
        return;
      }

      try {
        const axios = (await import('axios')).default;
        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        const response = await axios.get(`${BACKEND_URL}/api/organizations`, {
          params: { user_id: user.id },
        });
        const orgs = Array.isArray(response.data) ? response.data : [];
        setHasOrgs(orgs.length > 0);
      } catch (error) {
        console.error('Error checking organizations:', error);
        setHasOrgs(false);
      } finally {
        setCheckingOrgs(false);
      }
    };

    checkOrganizations();
  }, [user]);

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

  // If user has already completed onboarding OR has existing organizations, redirect to dashboard
  // Onboarding should only appear once for new users without organizations
  if (user.onboarding_completed || hasOrgs) {
    return <Navigate to="/dashboard" />;
  }

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