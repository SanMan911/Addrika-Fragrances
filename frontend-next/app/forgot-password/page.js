'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Lock, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Enter phone, 2: Verify OTP, 3: Reset password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, country_code: '+91' })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to initiate recovery');
      }
      
      setRecoveryToken(data.recovery_token);
      setMaskedEmail(data.email_masked);
      setStep(2);
      setSuccess('OTP sent to your registered email');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, recovery_token: recoveryToken })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to verify OTP');
      }
      
      setStep(3);
      setSuccess('OTP verified! Now set your new password');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_token: recoveryToken, new_password: newPassword })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Login
        </Link>
        
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h1 className="text-2xl font-bold text-[#2B3A4A] mb-2">Forgot Password?</h1>
            <p className="text-gray-500 text-sm">
              {step === 1 && "Enter your registered mobile number to recover your account"}
              {step === 2 && `Enter the OTP sent to ${maskedEmail}`}
              {step === 3 && "Create a new password for your account"}
            </p>
          </div>
          
          {/* Progress Steps */}
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full transition-all ${
                  s === step ? 'bg-[#D4AF37] w-8' : 
                  s < step ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}
          
          {/* Step 1: Enter Phone */}
          {step === 1 && (
            <form onSubmit={handleInitiate}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your 10-digit mobile number"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                    maxLength={10}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  We&apos;ll send an OTP to your registered email address
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full py-3 bg-[#D4AF37] text-[#2B3A4A] rounded-xl font-semibold hover:bg-[#c9a432] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
              </button>
            </form>
          )}
          
          {/* Step 2: Verify OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none text-center text-2xl tracking-widest"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  OTP expires in 10 minutes
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 bg-[#D4AF37] text-[#2B3A4A] rounded-xl font-semibold hover:bg-[#c9a432] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify OTP'}
              </button>
              
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}
                className="w-full mt-3 py-3 text-gray-600 hover:text-[#2B3A4A] transition-colors text-sm"
              >
                Use a different number
              </button>
            </form>
          )}
          
          {/* Step 3: Reset Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3 bg-[#D4AF37] text-[#2B3A4A] rounded-xl font-semibold hover:bg-[#c9a432] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
        
        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Remember your password?{' '}
          <Link href="/login" className="text-[#D4AF37] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
