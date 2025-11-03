import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ApiKeyProvider, useApiKey } from '@/contexts/ApiKeyContext';
import ApiKeyModal from '@/components/ApiKeyModal';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Pricing from '@/pages/Pricing';
import '@/App.css';

// Direct import to avoid lazy loading issues
import LinkedPilotDashboard from '@/pages/linkedpilot/LinkedPilotDashboard';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { showApiKeyModal, requiredKeyType, handleModalClose, handleKeySaved } = useApiKey();

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
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
  return (
    <AuthProvider>
      <ApiKeyProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ApiKeyProvider>
    </AuthProvider>
  );
}

export default App;