import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load admin user on mount
  useEffect(() => {
    if (token) {
      // Verify token is valid (optional - you could add a /auth/verify endpoint)
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/auth/login`, {
        email,
        password,
      });

      const { access_token, user } = response.data;
      setToken(access_token);
      setAdminUser(user);
      localStorage.setItem('admin_token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return { success: true };
    } catch (error) {
      console.error('Admin login failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const logout = () => {
    setToken(null);
    setAdminUser(null);
    localStorage.removeItem('admin_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    adminUser,
    token,
    login,
    logout,
    loading,
    isAuthenticated: !!token,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};










