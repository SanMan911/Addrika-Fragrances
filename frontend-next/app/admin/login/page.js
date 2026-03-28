'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F0E8]">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] hover:opacity-70">
            <ArrowLeft size={20} />
            <span>Back to Store</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          <div className="w-24" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-red-600">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-600">
                <ShieldCheck size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-red-600 mb-2">Admin Portal</h1>
              <p className="text-gray-500">
                {step === 1 
                  ? 'Enter your admin credentials'
                  : 'Enter the verification code sent to your email'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="admin@email.com"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 ${errors.email ? 'border-red-500' : 'border-gray-200'}`}
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin PIN *</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        name="pin"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.pin}
                        onChange={handleInputChange}
                        placeholder="Enter PIN"
                        className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 ${errors.pin ? 'border-red-500' : 'border-gray-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.pin && <p className="text-red-500 text-sm mt-1">{errors.pin}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">
                      Enter the 6-digit code sent to<br />
                      <span className="font-medium">{emailMasked}</span>
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Security Code *</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                    />
                    <p className="text-xs mt-2 text-center text-gray-500">Code expires in 5 minutes</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { setStep(1); setOtp(''); }}
                    className="w-full text-sm text-[#D4AF37] underline"
                  >
                    ← Back to login
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={loading || (step === 2 && otp.length !== 6)}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Please wait...' : (step === 1 ? 'Send Security Code' : 'Verify & Login')}
              </button>
            </form>

            {/* Footer */}
            <div className="text-center mt-6 space-y-2">
              <p className="text-xs text-gray-500">This is a secure admin-only area.</p>
              <Link href="/admin/forgot-password" className="text-sm font-medium text-red-600 hover:underline">
                Forgot PIN?
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
