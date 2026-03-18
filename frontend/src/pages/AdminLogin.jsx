import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminLogin = () => {
  const navigate = useNavigate();
  const { adminLogin, adminLoginVerifyOTP, isAuthenticated, isLoading, isAdmin } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Admin 2FA state
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
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate]);

  // Apply dark mode on mount (admin pages default to dark)
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('admin_dark_mode');
    // Default to dark mode if no preference saved
    const isDark = savedDarkMode !== null ? savedDarkMode === 'true' : true;
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const validateEmail = (email) => {
    if (!email || !email.trim()) return 'Email is required';
    const emailFormatRegex = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailFormatRegex.test(email)) return 'Invalid email format';
    return '';
  };

  const validateForm = () => {
    const newErrors = {};
    
    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;
    
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
      // Step 2: Verify OTP
      if (otp.length !== 6) {
        toast.error('Please enter 6-digit OTP');
        return;
      }
      
      setLoading(true);
      try {
        const result = await adminLoginVerifyOTP(tokenId, otp);
        if (result.success) {
          navigate('/admin', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleBack = () => {
    setStep(1);
    setTokenId('');
    setEmailMasked('');
    setOtp('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" 
               style={{ borderColor: '#dc2626', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-subtle)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--cream)' }}>
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            <ArrowLeft size={20} />
            <span>Back to Store</span>
          </button>
          <a href="/" className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            ADDRIKA
          </a>
          <div className="w-24" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8" style={{ border: '2px solid #dc2626' }}>
            {/* Title */}
            <div className="text-center mb-8">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: '#dc2626' }}
              >
                <ShieldCheck size={32} className="text-white" />
              </div>
              <h1 
                className="text-2xl font-bold mb-2"
                style={{ color: '#dc2626' }}
              >
                Admin Portal
              </h1>
              <p style={{ color: 'var(--text-subtle)' }}>
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
                  {/* Email */}
                  <div>
                    <Label htmlFor="email">Admin Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="email"
                        name="email"
                        type="text"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="admin@email.com"
                        className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                        data-testid="admin-email-input"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  {/* PIN */}
                  <div>
                    <Label htmlFor="pin">Admin PIN *</Label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="pin"
                        name="pin"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.pin}
                        onChange={handleInputChange}
                        placeholder="Enter PIN"
                        className={`pl-10 pr-10 ${errors.pin ? 'border-red-500' : ''}`}
                        data-testid="admin-pin-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.pin && <p className="text-red-500 text-sm mt-1">{errors.pin}</p>}
                  </div>
                </>
              ) : (
                <>
                  {/* OTP Verification */}
                  <div className="text-center mb-4">
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      Enter the 6-digit code sent to<br />
                      <span className="font-medium">{emailMasked}</span>
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="otp">Security Code *</Label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="otp"
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        className="pl-10 text-center text-2xl tracking-widest font-mono"
                        maxLength={6}
                        data-testid="admin-otp-input"
                      />
                    </div>
                    <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-subtle)' }}>
                      Code expires in 5 minutes
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-full text-sm underline"
                    style={{ color: 'var(--metallic-gold)' }}
                  >
                    ← Back to login
                  </button>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || (step === 2 && otp.length !== 6)}
                className="w-full py-6 text-white font-semibold"
                style={{ backgroundColor: '#dc2626' }}
                data-testid="admin-submit-btn"
              >
                {loading ? 'Please wait...' : (
                  step === 1 ? 'Send Security Code' : 'Verify & Login'
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center mt-6">
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                This is a secure admin-only area.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
