'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Country codes
const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳', key: '+91-IN' },
  { code: '+1', country: 'USA', flag: '🇺🇸', key: '+1-US' },
  { code: '+44', country: 'UK', flag: '🇬🇧', key: '+44-GB' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', key: '+971-AE' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { registerWithOTP, isAuthenticated, isLoading, checkAuth } = useAuth();
  
  const [step, setStep] = useState(1); // 1: form, 2: OTP, 3: complete
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [formData, setFormData] = useState({
    salutation: '',
    name: '',
    email: '',
    password: '',
    gender: '',
    dateOfBirth: '',
    countryCode: '+91-IN',
    phone: '',
    otp: '',
    pincode: '',
    address: '',
    landmark: '',
    city: '',
    state: ''
  });
  
  const [errors, setErrors] = useState({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/account');
    }
  }, [isAuthenticated, isLoading, router]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const capitalizeWords = (str) => {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    
    if (name === 'name') {
      filteredValue = capitalizeWords(value.replace(/[^a-zA-Z\s.'-]/g, ''));
    } else if (name === 'phone') {
      filteredValue = value.replace(/[^0-9]/g, '');
    } else if (name === 'email') {
      filteredValue = value.replace(/[^a-zA-Z0-9@.\-_]/g, '').toLowerCase();
    } else if (name === 'otp') {
      filteredValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    } else if (name === 'pincode') {
      filteredValue = value.replace(/[^0-9]/g, '').slice(0, 6);
      if (filteredValue.length === 6) {
        setTimeout(() => handlePincodeLookup(filteredValue), 100);
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: filteredValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePincodeLookup = useCallback(async (pincode) => {
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        setFormData(prev => ({
          ...prev,
          city: capitalizeWords(postOffice.District || ''),
          state: capitalizeWords(postOffice.State || '')
        }));
        toast.success(`Found: ${postOffice.District}, ${postOffice.State}`);
      } else {
        toast.error('Invalid PIN code');
      }
    } catch (error) {
      toast.error('Could not fetch location');
    }
  }, []);

  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.salutation) newErrors.salutation = 'Title is required';
    if (!formData.name.trim() || formData.name.length < 2) newErrors.name = 'Valid name is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.email.match(/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)) {
      newErrors.email = 'Valid email is required';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.phone || formData.phone.length < 10) {
      newErrors.phone = 'Valid phone number is required';
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      newErrors.pincode = 'Valid 6-digit PIN code is required';
    }
    if (!formData.address || formData.address.length < 5) {
      newErrors.address = 'Address is required';
    }
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = async () => {
    if (!validateStep1()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send OTP');
      }
      
      if (data.dev_otp) {
        toast.info(`DEV MODE: Your OTP is ${data.dev_otp}`, { duration: 10000 });
        setFormData(prev => ({ ...prev, otp: data.dev_otp }));
      } else {
        toast.success('OTP sent to your email!');
      }
      
      setOtpSent(true);
      setStep(2);
      setResendTimer(60);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      setErrors({ otp: 'Please enter 6-digit OTP' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp: formData.otp })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Invalid OTP');
      }
      
      toast.success('Email verified!');
      setOtpVerified(true);
      setStep(3);
    } catch (error) {
      toast.error(error.message);
      setErrors({ otp: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await registerWithOTP({
        email: formData.email,
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone,
        country_code: formData.countryCode.split('-')[0],
        salutation: formData.salutation,
        gender: formData.gender,
        date_of_birth: formData.dateOfBirth,
        otp: formData.otp,
        address: formData.address.trim(),
        landmark: formData.landmark?.trim() || null,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode
      });
      
      if (result.success) {
        router.push('/account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (step === 1) {
      await handleSendOTP();
    } else if (step === 2) {
      await handleVerifyOTP();
    } else if (step === 3) {
      await handleRegister();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputStyles = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white'
  };

  const selectStyles = {
    ...inputStyles,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23999'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px'
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-lg">
          <div 
            className="rounded-2xl p-8"
            style={{ 
              background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
            }}
          >
            {/* Title */}
            <div className="text-center mb-6">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <UserPlus className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <h1 
                className="text-2xl font-bold text-white mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Create Account
              </h1>
              <p className="text-gray-400 text-sm">
                {step === 1 && "Join us for a seamless shopping experience"}
                {step === 2 && "Enter the OTP sent to your email"}
                {step === 3 && "Complete your registration"}
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Registration Form */}
              {step === 1 && (
                <>
                  {/* Title & Name */}
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
                      <select
                        name="salutation"
                        value={formData.salutation}
                        onChange={(e) => {
                          const title = e.target.value;
                          let gender = formData.gender;
                          if (title === 'Mr.') gender = 'Male';
                          else if (title === 'Mrs.' || title === 'Ms.') gender = 'Female';
                          setFormData(prev => ({ ...prev, salutation: title, gender }));
                        }}
                        className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        style={selectStyles}
                        required
                      >
                        <option value="" className="bg-[#1a252f]">Select</option>
                        <option value="Mr." className="bg-[#1a252f]">Mr.</option>
                        <option value="Mrs." className="bg-[#1a252f]">Mrs.</option>
                        <option value="Ms." className="bg-[#1a252f]">Ms.</option>
                        <option value="Dr." className="bg-[#1a252f]">Dr.</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Full Name *</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                      {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                    </div>
                  </div>

                  {/* Gender & DOB */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Gender *</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        style={selectStyles}
                        required
                      >
                        <option value="" className="bg-[#1a252f]">Select</option>
                        <option value="Male" className="bg-[#1a252f]">Male</option>
                        <option value="Female" className="bg-[#1a252f]">Female</option>
                        <option value="Other" className="bg-[#1a252f]">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        style={inputStyles}
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        className="w-full h-11 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Min 6 characters"
                        className="w-full h-11 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Phone *</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                        className="w-28 h-11 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        style={selectStyles}
                      >
                        {countryCodes.map(c => (
                          <option key={c.key} value={c.key} className="bg-[#1a252f]">{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Phone number"
                        className="flex-1 h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                        style={inputStyles}
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  {/* Address Section */}
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 className="text-sm font-semibold text-white mb-3">Billing Address</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">PIN Code *</label>
                        <input
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          placeholder="6-digit PIN code"
                          maxLength={6}
                          className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                          style={inputStyles}
                        />
                        {errors.pincode && <p className="text-red-400 text-xs mt-1">{errors.pincode}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Street Address *</label>
                        <input
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="House/Flat No., Building, Street"
                          className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                          style={inputStyles}
                        />
                        {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Landmark (Optional)</label>
                        <input
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          placeholder="Near ABC Hospital"
                          className="w-full h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                          style={inputStyles}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">City *</label>
                          <input
                            name="city"
                            value={formData.city}
                            readOnly
                            placeholder="Auto-filled"
                            className="w-full h-11 rounded-lg px-3 text-sm placeholder-gray-600"
                            style={{ ...inputStyles, opacity: 0.7 }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">State *</label>
                          <input
                            name="state"
                            value={formData.state}
                            readOnly
                            placeholder="Auto-filled"
                            className="w-full h-11 rounded-lg px-3 text-sm placeholder-gray-600"
                            style={{ ...inputStyles, opacity: 0.7 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: OTP Verification */}
              {step === 2 && (
                <div className="text-center py-4">
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ background: 'rgba(212,175,55,0.15)' }}
                  >
                    <Mail size={36} className="text-[#D4AF37]" />
                  </div>
                  <p className="text-gray-400 mb-6">
                    We&apos;ve sent a verification code to<br />
                    <strong className="text-white">{formData.email}</strong>
                  </p>
                  
                  <input
                    name="otp"
                    value={formData.otp}
                    onChange={handleInputChange}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full h-14 rounded-xl text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-600"
                    style={inputStyles}
                  />
                  {errors.otp && <p className="text-red-400 text-sm mt-2">{errors.otp}</p>}
                  
                  <p className="text-sm text-gray-500 mt-6">
                    Didn&apos;t receive the code?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-gray-400">Resend in {resendTimer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setStep(1); setOtpSent(false); }}
                        className="font-semibold text-[#D4AF37] hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Step 3: Complete Registration */}
              {step === 3 && (
                <div className="text-center py-4">
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ background: 'rgba(16,185,129,0.15)' }}
                  >
                    <CheckCircle size={36} className="text-green-500" />
                  </div>
                  <h3 
                    className="text-xl font-semibold text-white mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Email Verified!
                  </h3>
                  <p className="text-gray-400 mb-6">Click below to complete your registration</p>
                  
                  <div 
                    className="rounded-xl p-4 text-left text-sm space-y-2"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <p className="text-gray-300"><span className="text-gray-500">Name:</span> {formData.salutation} {formData.name}</p>
                    <p className="text-gray-300"><span className="text-gray-500">Email:</span> {formData.email}</p>
                    <p className="text-gray-300"><span className="text-gray-500">Phone:</span> {formData.countryCode.split('-')[0]} {formData.phone}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
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
                  step === 1 ? 'Send OTP' :
                  step === 2 ? 'Verify OTP' :
                  'Complete Registration'
                )}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-[#D4AF37] hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
