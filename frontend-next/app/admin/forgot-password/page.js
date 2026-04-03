'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/admin/forgot-pin/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to initiate recovery');
      }
      
      setRecoveryToken(data.recovery_token);
      setMaskedEmail(data.email_masked);
      setStep(2);
      setSuccess('Recovery OTP sent to your admin email');
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
      const res = await fetch(`${API_URL}/api/admin/forgot-pin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_token: recoveryToken, otp })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to verify OTP');
      }
      
      setStep(3);
      setSuccess('OTP verified! Now set your new PIN');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    
    if (newPin.length < 4) {
      setError('PIN must be at least 4 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/admin/forgot-pin/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_token: recoveryToken, new_pin: newPin })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset PIN');
      }
      
      setSuccess('PIN reset successful! Redirecting to admin login...');
      setTimeout(() => router.push('/admin/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Admin Header */}
      <header className="py-4 px-6 border-b border-slate-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="/images/logos/addrika-brand-name-gold-transparent.png" 
              alt="Addrika" 
              className="h-10 w-auto"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
            />
          </Link>
          <Link 
            href="/admin/login" 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Admin Login</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8 bg-slate-800 border border-slate-700" style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-600/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-600/30">
                <ShieldCheck className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Admin PIN Recovery</h1>
              <p className="text-slate-400 text-sm">
                {step === 1 && "Enter your admin email to recover your PIN"}
                {step === 2 && `Enter the OTP sent to ${maskedEmail}`}
                {step === 3 && "Create a new PIN for your admin account"}
              </p>
            </div>
            
            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step ? 'bg-red-500 w-8' : s < step ? 'bg-green-500 w-2' : 'bg-slate-600 w-2'
                  }`}
                />
              ))}
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-xl flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}
            
            {step === 1 && (
              <form onSubmit={handleInitiate}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500"
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Recovery OTP'}
                </button>
              </form>
            )}
            
            {step === 2 && (
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-600"
                    maxLength={6}
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify OTP'}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}
                  className="w-full mt-3 py-3 text-slate-400 hover:text-red-400 text-sm"
                >
                  Use a different email
                </button>
              </form>
            )}
            
            {step === 3 && (
              <form onSubmit={handleResetPin}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">New PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Enter new PIN"
                      className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500"
                      minLength={4}
                      required
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirm PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Confirm new PIN"
                      className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500"
                      minLength={4}
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !newPin || !confirmPin}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset PIN'}
                </button>
              </form>
            )}
          </div>
          
          <p className="text-center text-slate-500 text-sm mt-6">
            Remember your PIN?{' '}
            <Link href="/admin/login" className="text-red-400 hover:underline">Admin Login</Link>
          </p>
        </div>
      </main>

      {/* Admin Footer */}
      <footer className="py-4 px-6 border-t border-slate-700">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Centsibl Traders. Admin Portal.
          </p>
        </div>
      </footer>
    </div>
  );
}
