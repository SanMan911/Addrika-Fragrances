'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { Suspense } from 'react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processGoogleCallback, isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for session_id in URL hash or query params
      const hash = window.location.hash;
      let sessionId = searchParams.get('session_id');
      
      // Check hash for session_id
      if (!sessionId && hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        sessionId = hashParams.get('session_id');
      }
      
      if (sessionId) {
        try {
          const result = await processGoogleCallback(sessionId);
          if (result.success) {
            router.push('/account');
          } else {
            setError(result.error || 'Authentication failed');
            setProcessing(false);
          }
        } catch (err) {
          setError('An error occurred during authentication');
          setProcessing(false);
        }
      } else {
        setError('No session ID found');
        setProcessing(false);
      }
    };

    if (!isAuthenticated) {
      handleCallback();
    } else {
      router.push('/account');
    }
  }, [searchParams, processGoogleCallback, isAuthenticated, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h1 className="text-xl font-bold text-[#2B3A4A] mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href="/login" className="text-[#D4AF37] hover:underline">
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
