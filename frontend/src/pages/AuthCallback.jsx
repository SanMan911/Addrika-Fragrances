import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { processGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Get session_id from URL fragment
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (sessionId) {
        const result = await processGoogleCallback(sessionId);
        
        if (result.success) {
          // Clear the hash and redirect to account
          window.history.replaceState(null, '', window.location.pathname);
          navigate('/account', { replace: true, state: { user: result.user } });
        } else {
          navigate('/login', { replace: true });
        }
      } else {
        // No session_id, redirect to login
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [processGoogleCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
      <div className="text-center">
        <div 
          className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }}
        />
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
          Completing Sign In...
        </h2>
        <p style={{ color: 'var(--text-subtle)' }}>
          Please wait while we authenticate your account
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
