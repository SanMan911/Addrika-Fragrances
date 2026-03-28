'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const RetailerAuthContext = createContext();

export function useRetailerAuth() {
  const context = useContext(RetailerAuthContext);
  if (!context) {
    throw new Error('useRetailerAuth must be used within RetailerAuthProvider');
  }
  return context;
}

export function RetailerAuthProvider({ children }) {
  const [retailer, setRetailer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch with auth helper
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('retailer_token') 
      : null;
    
    const headers = {
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    return fetch(url, { ...options, credentials: 'include', headers });
  }, []);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer/me`);
      if (res.ok) {
        const data = await res.json();
        setRetailer(data.retailer || data);
        setIsAuthenticated(true);
      } else {
        setRetailer(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setRetailer(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login
  const login = async (identifier, password) => {
    try {
      const res = await fetch(`${API_URL}/api/retailer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      if (data.token) {
        localStorage.setItem('retailer_token', data.token);
      }
      
      setRetailer(data.retailer || data);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetchWithAuth(`${API_URL}/api/retailer/logout`, { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('retailer_token');
      setRetailer(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    retailer,
    isLoading,
    isAuthenticated,
    login,
    logout,
    fetchWithAuth,
    checkAuth
  };

  return (
    <RetailerAuthContext.Provider value={value}>
      {children}
    </RetailerAuthContext.Provider>
  );
}
