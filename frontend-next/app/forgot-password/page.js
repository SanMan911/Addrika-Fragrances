'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Lock, ArrowLeft, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Enter phone, 2: Verify OTP, 3: Reset password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
        body: JSON.stringify({ recovery_token: recoveryToken, otp })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid OTP');
      }
      
      setRecoveryToken(data.recovery_token);
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
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
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

  const inputStyles = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white'
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-md">
          <div 
            className="rounded-2xl p-8"
            style={{ 
              background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <KeyRound className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <h1 
                className="text-2xl font-bold text-white mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Forgot Password?
              </h1>
              <p className="text-gray-400 text-sm">
                {step === 1 && "Enter your registered mobile number to recover your account"}
                {step === 2 && `Enter the OTP sent to ${maskedEmail}`}
                {step === 3 && "Create a new password for your account"}
              </p>
            </div>
            
            {/* Progress Steps */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: s === step ? '2rem' : '0.5rem',
                    background: s === step ? '#D4AF37' : s < step ? '#10B981' : 'rgba(255,255,255,0.2)'
                  }}
                />
              ))}
            </div>
            
            {/* Error/Success Messages */}
            {error && (
              <div 
                className="mb-6 p-4 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div 
                className="mb-6 p-4 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}
            
            {/* Step 1: Enter Phone */}
            {step === 1 && (
              <form onSubmit={handleInitiate}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit mobile number"
                      className="w-full h-12 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                      style={inputStyles}
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || phone.length !== 10}
                  className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Please wait...
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            )}
            
            {/* Step 2: Verify OTP */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full h-14 rounded-xl text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-600"
                    style={inputStyles}
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify OTP'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}
                  className="w-full mt-3 py-3 rounded-xl text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to phone entry
                </button>
              </form>
            )}
            
            {/* Step 3: Reset Password */}
            {step === 3 && (
              <form onSubmit={handleResetPassword}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full h-12 pl-12 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full h-12 pl-12 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            )}
            
            {/* Back to Login */}
            <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Link 
                href="/login" 
                className="text-gray-400 hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
