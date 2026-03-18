/**
 * Retailer Authentication Context
 * Manages retailer login state and session
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RetailerAuthContext = createContext(null);

export const useRetailerAuth = () => {
  const context = useContext(RetailerAuthContext);
  if (!context) {
    throw new Error('useRetailerAuth must be used within RetailerAuthProvider');
  }
  return context;
};

export const RetailerAuthProvider = ({ children }) => {
  const [retailer, setRetailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('retailer_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/retailer-auth/validate`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.retailer) {
          setRetailer(data.retailer);
        } else {
          localStorage.removeItem('retailer_token');
        }
      } else {
        localStorage.removeItem('retailer_token');
      }
    } catch (err) {
      console.error('Session check failed:', err);
      localStorage.removeItem('retailer_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/retailer-auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store token
      if (data.token) {
        localStorage.setItem('retailer_token', data.token);
      }

      setRetailer(data.retailer);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('retailer_token');
      await fetch(`${API_URL}/api/retailer-auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('retailer_token');
      setRetailer(null);
    }
  };

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('retailer_token');
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
  }, []);

  const value = {
    retailer,
    loading,
    error,
    isAuthenticated: !!retailer,
    login,
    logout,
    fetchWithAuth,
    checkSession
  };

  return (
    <RetailerAuthContext.Provider value={value}>
      {children}
    </RetailerAuthContext.Provider>
  );
};

export default RetailerAuthContext;
