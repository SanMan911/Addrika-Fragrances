import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        withCredentials: true
      });
      
      setUser(response.data.user);
      // Check if admin
      try {
        const adminCheck = await axios.get(`${API_URL}/api/admin/check`, {
          withCredentials: true
        });
        setIsAdmin(adminCheck.data.is_admin);
      } catch (e) {
        setIsAdmin(false);
      }
    } catch (error) {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Register with email/password
  const register = async (email, password, name, phone = null, captchaToken = null) => {
    try {
      const url = captchaToken 
        ? `${API_URL}/api/auth/register?captcha_token=${encodeURIComponent(captchaToken)}`
        : `${API_URL}/api/auth/register`;
      
      const response = await axios.post(url, 
        { email, password, name, phone },
        { withCredentials: true }
      );

      setUser(response.data.user);
      if (response.data.session_token) {
        localStorage.setItem('addrika_session_token', response.data.session_token);
      }
      toast.success('Registration successful!');
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Login with email or username + password
  const login = async (identifier, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, 
        { identifier, password },
        { withCredentials: true }
      );

      const userData = response.data.user;
      setUser(userData);
      
      if (response.data.session_token) {
        localStorage.setItem('addrika_session_token', response.data.session_token);
      }
      
      // Check if admin after login
      try {
        const adminCheck = await axios.get(`${API_URL}/api/admin/check`, {
          withCredentials: true
        });
        setIsAdmin(adminCheck.data.is_admin);
      } catch (e) {
        setIsAdmin(false);
      }
      
      toast.success('Login successful!');
      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Google OAuth login
  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Process Google OAuth callback
  const processGoogleCallback = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/google/session?session_id=${sessionId}`,
        {},
        { withCredentials: true }
      );

      setUser(response.data.user);
      if (response.data.session_token) {
        localStorage.setItem('addrika_session_token', response.data.session_token);
      }
      
      await checkAuth();
      
      toast.success('Google login successful!');
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.detail || 'Google login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Admin login with PIN - Step 1: Initiate (sends OTP)
  const adminLoginInitiate = async (email, pin) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/login/initiate`,
        { email, pin },
        { withCredentials: true }
      );

      return { 
        success: true, 
        token_id: response.data.token_id,
        email_masked: response.data.email_masked,
        message: response.data.message 
      };
    } catch (error) {
      const message = error.response?.data?.detail || 'Admin login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Admin login with PIN - Step 2: Verify OTP
  const adminLoginVerifyOTP = async (tokenId, otp) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/login/verify-otp`,
        { token_id: tokenId, otp },
        { withCredentials: true }
      );

      setUser(response.data.user);
      setIsAdmin(true);
      if (response.data.session_token) {
        localStorage.setItem('addrika_session_token', response.data.session_token);
      }
      
      toast.success('Admin login successful!');
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.detail || 'OTP verification failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Legacy admin login (for backwards compatibility)
  const adminLogin = async (email, pin) => {
    // First initiate 2FA
    const initResult = await adminLoginInitiate(email, pin);
    if (!initResult.success) {
      return initResult;
    }
    // Return with requires_otp flag so frontend knows to show OTP input
    return {
      success: true,
      requires_otp: true,
      token_id: initResult.token_id,
      email_masked: initResult.email_masked,
      message: initResult.message
    };
  };

  // Change admin PIN
  const changeAdminPin = async (oldPin, newPin) => {
    try {
      await axios.post(
        `${API_URL}/api/admin/change-password`,
        {
          currentPassword: oldPin,
          newPassword: newPin
        },
        { withCredentials: true }
      );

      toast.success('PIN changed successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to change PIN';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem('addrika_session_token');
      toast.success('Logged out successfully');
    }
  };

  // Get user orders
  const getUserOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/orders`, {
        withCredentials: true
      });
      return response.data.orders || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  };

  const value = {
    user,
    isLoading,
    isAdmin,
    isAuthenticated: !!user,
    register,
    login,
    loginWithGoogle,
    processGoogleCallback,
    adminLogin,
    adminLoginInitiate,
    adminLoginVerifyOTP,
    changeAdminPin,
    logout,
    getUserOrders,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
