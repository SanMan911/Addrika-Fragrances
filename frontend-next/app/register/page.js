'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
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
            <span>Back</span>
          </Link>
          <Link href="/" className="text-xl font-bold text-[#2B3A4A]">ADDRIKA</Link>
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#2B3A4A] mb-2">Create Account</h1>
              <p className="text-gray-500 text-sm">
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
                  className={`w-3 h-3 rounded-full transition-all ${
                    s === step ? 'bg-[#D4AF37] w-8' : 
                    s < step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Registration Form */}
              {step === 1 && (
                <>
                  {/* Title & Name */}
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
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
                        className="w-full h-10 rounded-lg border border-gray-200 px-2 text-sm"
                        required
                      >
                        <option value="">--</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Dr.">Dr.</option>
                      </select>
                    </div>
                    <div className="col-span-5">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        className={`w-full h-10 rounded-lg border px-3 text-sm ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
                      />
                      {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                  </div>

                  {/* Gender & DOB */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Gender *</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full h-10 rounded-lg border border-gray-200 px-2 text-sm"
                        required
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        className={`w-full h-10 pl-9 pr-3 rounded-lg border text-sm ${errors.email ? 'border-red-500' : 'border-gray-200'}`}
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Min 6 characters"
                        className={`w-full h-10 pl-9 pr-10 rounded-lg border text-sm ${errors.password ? 'border-red-500' : 'border-gray-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                        className="w-24 h-10 rounded-lg border border-gray-200 px-2 text-sm"
                      >
                        {countryCodes.map(c => (
                          <option key={c.key} value={c.key}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Phone number"
                        className={`flex-1 h-10 rounded-lg border px-3 text-sm ${errors.phone ? 'border-red-500' : 'border-gray-200'}`}
                      />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  {/* Address Section */}
                  <div className="pt-3 border-t">
                    <h3 className="text-sm font-semibold text-[#2B3A4A] mb-3">Billing Address</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code *</label>
                        <input
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          placeholder="6-digit PIN code"
                          maxLength={6}
                          className={`w-full h-10 rounded-lg border px-3 text-sm ${errors.pincode ? 'border-red-500' : 'border-gray-200'}`}
                        />
                        {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Street Address *</label>
                        <input
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="House/Flat No., Building, Street"
                          className={`w-full h-10 rounded-lg border px-3 text-sm ${errors.address ? 'border-red-500' : 'border-gray-200'}`}
                        />
                        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Landmark (Optional)</label>
                        <input
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          placeholder="Near ABC Hospital"
                          className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">City *</label>
                          <input
                            name="city"
                            value={formData.city}
                            readOnly
                            placeholder="Auto-filled"
                            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
                          <input
                            name="state"
                            value={formData.state}
                            readOnly
                            placeholder="Auto-filled"
                            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm bg-gray-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: OTP Verification */}
              {step === 2 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[#F5F0E8] flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-[#2B3A4A]" />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    We&apos;ve sent a verification code to<br />
                    <strong className="text-[#2B3A4A]">{formData.email}</strong>
                  </p>
                  
                  <input
                    name="otp"
                    value={formData.otp}
                    onChange={handleInputChange}
                    placeholder="000000"
                    maxLength={6}
                    className={`w-full h-12 rounded-lg border text-center text-2xl tracking-widest ${errors.otp ? 'border-red-500' : 'border-gray-200'}`}
                  />
                  {errors.otp && <p className="text-red-500 text-sm mt-1">{errors.otp}</p>}
                  
                  <p className="text-sm text-gray-500 mt-4">
                    Didn&apos;t receive the code?{' '}
                    {resendTimer > 0 ? (
                      <span>Resend in {resendTimer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setStep(1); setOtpSent(false); }}
                        className="font-semibold text-[#2B3A4A] hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Step 3: Complete Registration */}
              {step === 3 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">Email Verified!</h3>
                  <p className="text-sm text-gray-600 mb-4">Click below to complete your registration</p>
                  
                  <div className="bg-[#F5F0E8] rounded-lg p-4 text-left text-sm space-y-1">
                    <p><strong>Name:</strong> {formData.salutation} {formData.name}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Phone:</strong> {formData.countryCode.split('-')[0]} {formData.phone}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#2B3A4A] text-white rounded-xl font-semibold hover:bg-[#1a252f] transition-colors disabled:opacity-50"
              >
                {loading ? 'Please wait...' : (
                  step === 1 ? 'Send OTP' :
                  step === 2 ? 'Verify OTP' :
                  'Complete Registration'
                )}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="text-center mt-6">
              <p className="text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-[#2B3A4A] hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
