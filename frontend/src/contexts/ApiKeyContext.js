import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ApiKeyContext = createContext();

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within ApiKeyProvider');
  }
  return context;
};

export const ApiKeyProvider = ({ children }) => {
  const { user } = useAuth();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [requiredKeyType, setRequiredKeyType] = useState(null);
  const [onKeyConfigured, setOnKeyConfigured] = useState(null);

  const checkApiKey = useCallback(async (keyType) => {
    if (!user) return false;

    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/settings/api-keys/check?user_id=${user.id}&key_type=${keyType}`
      );
      return response.data.available;
    } catch (error) {
      console.error('Error checking API key:', error);
      return false;
    }
  }, [user]);

  const requireApiKey = useCallback(async (keyType, callback) => {
    const available = await checkApiKey(keyType);
    
    if (!available) {
      setRequiredKeyType(keyType);
      setOnKeyConfigured(() => callback);
      setShowApiKeyModal(true);
      return false;
    }
    
    // API key is available, execute callback
    if (callback) callback();
    return true;
  }, [checkApiKey]);

  const handleModalClose = () => {
    setShowApiKeyModal(false);
    setRequiredKeyType(null);
    setOnKeyConfigured(null);
  };

  const handleKeySaved = () => {
    if (onKeyConfigured) {
      onKeyConfigured();
    }
    handleModalClose();
  };

  const value = {
    checkApiKey,
    requireApiKey,
    showApiKeyModal,
    setShowApiKeyModal,
    requiredKeyType,
    handleModalClose,
    handleKeySaved
  };

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
};
