import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Log API URL for debugging
if (!process.env.REACT_APP_BACKEND_URL) {
  console.warn('[AuthContext] REACT_APP_BACKEND_URL not set, using default: http://localhost:8000');
}
console.log('[AuthContext] Using API:', API);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });
          setUser(response.data.user);
          setToken(storedToken);
        } catch (error) {
          console.error('Failed to fetch user:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const signup = async (email, password, full_name) => {
    try {
      const response = await axios.post(`${API}/auth/signup`, {
        email,
        password,
        full_name
      });
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed'
      };
    }
  };

  const login = async (email, password) => {
    try {
      console.log('[AuthContext] Attempting login to:', `${API}/auth/login`);
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });
      console.log('[AuthContext] Login response:', response.data);
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      console.error('[AuthContext] Error response:', error.response?.data);
      console.error('[AuthContext] Error status:', error.response?.status);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Login failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });
        setUser(response.data.user);
        return response.data.user;
      } catch (error) {
        console.error('Failed to refresh user:', error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        return null;
      }
    }
    return null;
  };

  const value = {
    user,
    token,
    loading,
    signup,
    login,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};