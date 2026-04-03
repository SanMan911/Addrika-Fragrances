'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Not authenticated');
      
      const data = await response.json();
      setUser(data.user);
      
      // Check if admin
      try {
        const adminCheck = await fetch(`${API_URL}/api/admin/check`, {
          credentials: 'include'
        });
        const adminData = await adminCheck.json();
        setIsAdmin(adminData.is_admin);
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

  // Login with email/username + password
  const login = async (identifier, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }
      
      const data = await response.json();
      setUser(data.user);
      
      if (data.session_token) {
        localStorage.setItem('addrika_session_token', data.session_token);
      }
      
      // Check admin status
      try {
        const adminCheck = await fetch(`${API_URL}/api/admin/check`, {
          credentials: 'include'
        });
        const adminData = await adminCheck.json();
        setIsAdmin(adminData.is_admin);
      } catch (e) {
        setIsAdmin(false);
      }
      
      toast.success('Login successful!');
      return { success: true, user: data.user };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Send OTP for registration
  const sendOTP = async (email) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send OTP');
      }
      
      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Verify OTP
  const verifyOTP = async (email, otp) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid OTP');
      }
      
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Register with OTP verification
  const registerWithOTP = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }
      
      const data = await response.json();
      setUser(data.user);
      
      if (data.session_token) {
        localStorage.setItem('addrika_session_token', data.session_token);
      }
      
      toast.success('Registration successful!');
      return { success: true, user: data.user };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Google OAuth login
  const loginWithGoogle = () => {
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Process Google OAuth callback
  const processGoogleCallback = async (sessionId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/google/session?session_id=${sessionId}`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google login failed');
      }
      
      const data = await response.json();
      setUser(data.user);
      
      if (data.session_token) {
        localStorage.setItem('addrika_session_token', data.session_token);
      }
      
      await checkAuth();
      toast.success('Google login successful!');
      return { success: true, user: data.user };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Admin login - Step 1: Initiate (sends OTP)
  const adminLoginInitiate = async (email, pin) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/login/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, pin })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Admin login failed');
      }
      
      const data = await response.json();
      return { 
        success: true, 
        token_id: data.token_id,
        email_masked: data.email_masked,
        message: data.message 
      };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Admin login - Step 2: Verify OTP
  const adminLoginVerifyOTP = async (tokenId, otp) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token_id: tokenId, otp })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'OTP verification failed');
      }
      
      const data = await response.json();
      setUser(data.user);
      setIsAdmin(true);
      
      if (data.session_token) {
        localStorage.setItem('addrika_session_token', data.session_token);
      }
      
      toast.success('Admin login successful!');
      return { success: true, user: data.user };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Legacy admin login (returns requires_otp for 2FA flow)
  const adminLogin = async (email, pin) => {
    const initResult = await adminLoginInitiate(email, pin);
    if (!initResult.success) {
      return initResult;
    }
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
      const response = await fetch(`${API_URL}/api/admin/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: oldPin, newPassword: newPin })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to change PIN');
      }
      
      toast.success('PIN changed successfully!');
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
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
      const response = await fetch(`${API_URL}/api/user/orders`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.orders || [];
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
    register: registerWithOTP,
    sendOTP,
    verifyOTP,
    registerWithOTP,
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
}
