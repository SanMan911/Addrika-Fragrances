'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Eye, EyeOff, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const router = useRouter();
  const { adminLogin, adminLoginVerifyOTP, isAuthenticated, isLoading, isAdmin } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [step, setStep] = useState(1); // 1: email+pin, 2: otp verification
  const [tokenId, setTokenId] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otp, setOtp] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    pin: ''
  });
  
  const [errors, setErrors] = useState({});

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      router.push('/admin');
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.match(/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)) {
      newErrors.email = 'Valid email is required';
    }
    if (!formData.pin) {
      newErrors.pin = 'PIN is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    if (name === 'email') {
      filteredValue = value.replace(/[^a-zA-Z0-9@.\-_]/g, '').toLowerCase();
    }
    setFormData(prev => ({ ...prev, [name]: filteredValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!validateForm()) return;
      
      setLoading(true);
      try {
        const result = await adminLogin(formData.email, formData.pin);
        if (result.success && result.requires_otp) {
          setTokenId(result.token_id);
          setEmailMasked(result.email_masked);
          setStep(2);
          toast.success('OTP sent to your email!');
        }
      } finally {
        setLoading(false);
      }
    } else {
      if (otp.length !== 6) {
        toast.error('Please enter 6-digit OTP');
        return;
      }
      
      setLoading(true);
      try {
        const result = await adminLoginVerifyOTP(tokenId, otp);
        if (result.success) {
          router.push('/admin');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const inputStyles = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

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
            href="/" 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Store</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div 
            className="rounded-2xl p-8 bg-slate-800 border border-slate-700"
            style={{ 
              boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
            }}
          >
            {/* Title */}
            <div className="text-center mb-8">
              <div 
                className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center bg-red-600"
              >
                <ShieldCheck size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Admin Portal
              </h1>
              <p className="text-slate-400">
                {step === 1 
                  ? 'Enter your admin credentials'
                  : 'Enter the verification code sent to your email'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Admin Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="admin@email.com"
                        className="w-full h-12 pl-12 pr-4 rounded-xl text-sm bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500"
                        data-testid="admin-email-input"
                      />
                    </div>
                    {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Admin PIN *</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        name="pin"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.pin}
                        onChange={handleInputChange}
                        placeholder="Enter PIN"
                        className="w-full h-12 pl-12 pr-12 rounded-xl text-sm bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500"
                        data-testid="admin-pin-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.pin && <p className="text-red-400 text-sm mt-1">{errors.pin}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <p className="text-sm text-slate-400">
                      Enter the 6-digit code sent to<br />
                      <span className="font-medium text-amber-500">{emailMasked}</span>
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Security Code *</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-600"
                      maxLength={6}
                      data-testid="admin-otp-input"
                    />
                    <p className="text-xs mt-2 text-center text-slate-500">Code expires in 5 minutes</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { setStep(1); setOtp(''); }}
                    className="w-full text-sm text-amber-500 hover:text-amber-400 hover:underline"
                  >
                    ← Back to login
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={loading || (step === 2 && otp.length !== 6)}
                className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                data-testid="admin-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Please wait...
                  </>
                ) : (
                  step === 1 ? 'Send Security Code' : 'Verify & Login'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="text-center mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-3">This is a secure admin-only area.</p>
              <Link 
                href="/admin/forgot-password" 
                className="text-sm font-medium text-red-400 hover:text-red-300 hover:underline"
              >
                Forgot PIN?
              </Link>
            </div>
          </div>
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
