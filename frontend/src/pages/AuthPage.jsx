import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { toast } from 'sonner';
import axios from 'axios';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Country codes for the dropdown
const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳', key: '+91-IN' },
  { code: '+1', country: 'USA', flag: '🇺🇸', key: '+1-US' },
  { code: '+1', country: 'Canada', flag: '🇨🇦', key: '+1-CA' },
  { code: '+44', country: 'UK', flag: '🇬🇧', key: '+44-GB' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', key: '+971-AE' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', key: '+966-SA' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', key: '+65-SG' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', key: '+60-MY' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', key: '+61-AU' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', key: '+49-DE' },
  { code: '+33', country: 'France', flag: '🇫🇷', key: '+33-FR' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', key: '+81-JP' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', key: '+977-NP' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', key: '+880-BD' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', key: '+94-LK' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', key: '+92-PK' },
];

// Inner component that uses reCAPTCHA
const AuthForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, isAdmin, checkAuth } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();
  
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register'
  const [registerStep, setRegisterStep] = useState(1); // 1: form, 2: otp verification
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [formData, setFormData] = useState({
    salutation: '',
    gender: '',  // Male, Female, Other
    email: '',
    password: '',
    name: '',
    username: '',  // Unique login name/user ID chosen by user
    loginIdentifier: '',  // For login: can be email or username
    countryCode: '+91-IN',
    phone: '',
    alternatePhone: '',  // Optional alternate phone number
    dateOfBirth: '',  // YYYY-MM-DD format
    dateOfMarriage: '',  // YYYY-MM-DD format (optional, for gift codes)
    otp: '',
    // Address fields for registration (all required)
    address: '',
    landmark: '',  // Nearby landmark for delivery
    city: '',
    state: '',
    pincode: ''
  });
  
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  const isLoginMode = authMode === 'login';
  const [errors, setErrors] = useState({});

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        const from = location.state?.from || '/account';
        navigate(from, { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate, location]);

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Reset state when switching modes
  useEffect(() => {
    setOtpSent(false);
    setOtpVerified(false);
    setRegisterStep(1);
    setErrors({});
  }, [authMode]);

  // Validation functions
  const validateName = (name) => {
    if (!name || !name.trim()) return 'Full name is required';
    const nameRegex = /^[a-zA-Z\s.'-]+$/;
    if (!nameRegex.test(name)) return 'Name should contain only letters';
    if (name.length < 2) return 'Name must be at least 2 characters';
    return '';
  };

  const validateEmail = (email) => {
    if (!email || !email.trim()) return 'Email is required';
    const emailCharRegex = /^[a-zA-Z0-9@.\-_]+$/;
    if (!emailCharRegex.test(email)) return 'Email can only contain letters, numbers, @, ., -, _';
    const emailFormatRegex = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailFormatRegex.test(email)) return 'Invalid email format';
    return '';
  };

  const validatePhone = (phone) => {
    if (!phone) return '';
    const phoneRegex = /^[0-9]+$/;
    if (!phoneRegex.test(phone)) return 'Phone should contain only numbers';
    if (phone.length < 6 || phone.length > 15) return 'Phone number must be 6-15 digits';
    return '';
  };

  const validateForm = () => {
    const newErrors = {};
    
    // For login mode, validate loginIdentifier (email or username)
    if (isLoginMode) {
      if (!formData.loginIdentifier || !formData.loginIdentifier.trim()) {
        newErrors.loginIdentifier = 'Email or Username is required';
      }
    } else {
      // Registration mode - validate email
      const emailError = validateEmail(formData.email);
      if (emailError) newErrors.email = emailError;
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (authMode === 'register') {
      const nameError = validateName(formData.name);
      if (nameError) newErrors.name = nameError;
      
      const phoneError = validatePhone(formData.phone);
      if (phoneError) newErrors.phone = phoneError;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Capitalize first letter of each word, lowercase the rest
  const capitalizeWords = (str) => {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    
    if (name === 'name') {
      // Filter and capitalize name (first letter upper, rest lower)
      filteredValue = capitalizeWords(value.replace(/[^a-zA-Z\s.'-]/g, ''));
    } else if (name === 'phone') {
      filteredValue = value.replace(/[^0-9]/g, '');
    } else if (name === 'email') {
      filteredValue = value.replace(/[^a-zA-Z0-9@.\-_]/g, '').toLowerCase();
    } else if (name === 'otp') {
      filteredValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    } else if (name === 'address' || name === 'landmark') {
      // Capitalize address and landmark fields
      filteredValue = capitalizeWords(value);
    } else if (name === 'pincode') {
      filteredValue = value.replace(/[^0-9]/g, '').slice(0, 6);
      // Auto-trigger lookup when 6 digits are entered
      if (filteredValue.length === 6) {
        // Use setTimeout to ensure state is updated first
        setTimeout(() => handlePincodeLookup(filteredValue), 100);
      } else {
        // Clear city and state if pincode is incomplete
        setFormData(prev => ({ ...prev, city: '', state: '' }));
      }
    } else if (name === 'loginIdentifier') {
      // Allow email or username format - lowercase, alphanumeric + @._-
      filteredValue = value.replace(/[^a-zA-Z0-9@.\-_]/g, '').toLowerCase();
    }
    
    setFormData(prev => ({ ...prev, [name]: filteredValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Pincode lookup to auto-fill city and state
  const handlePincodeLookup = useCallback(async (pincode) => {
    const pincodeToLookup = pincode || formData.pincode;
    if (!pincodeToLookup || pincodeToLookup.length !== 6) return;
    
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeToLookup}`);
      const data = await response.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        const city = capitalizeWords(postOffice.District || postOffice.Name || '');
        const state = capitalizeWords(postOffice.State || '');
        
        // Ensure we have valid values before setting
        if (city && state) {
          setFormData(prev => ({
            ...prev,
            city: city,
            state: state
          }));
          setErrors(prev => ({ ...prev, city: '', state: '', pincode: '' }));
          toast.success(`Found: ${city}, ${state}`);
        } else {
          // Handle case where API returned success but missing data
          setFormData(prev => ({
            ...prev,
            city: city || prev.city,
            state: state || prev.state
          }));
          if (!city || !state) {
            toast.warning('Partial data received. Please verify city and state.');
          }
        }
      } else {
        toast.error('Invalid PIN code. Please check and try again.');
        setErrors(prev => ({ ...prev, pincode: 'Invalid PIN code' }));
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
      toast.error('Could not fetch location. Please try again.');
    }
  }, [formData.pincode]);

  const getRecaptchaToken = useCallback(async (action) => {
    if (!executeRecaptcha) {
      console.log('reCAPTCHA not ready');
      return null;
    }
    try {
      const token = await executeRecaptcha(action);
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  }, [executeRecaptcha]);

  const handleSendOTP = async () => {
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    
    // Validate other required fields before sending OTP
    const nameError = validateName(formData.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }
    
    if (!formData.password || formData.password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }
    
    // Validate title (now required)
    if (!formData.salutation) {
      setErrors({ salutation: 'Please select your title' });
      return;
    }
    
    // Validate gender (now required)
    if (!formData.gender) {
      setErrors({ gender: 'Please select your gender' });
      return;
    }
    
    // Validate date of birth (now required)
    if (!formData.dateOfBirth) {
      setErrors({ dateOfBirth: 'Date of birth is required' });
      return;
    }
    
    // Validate phone (now required)
    const phoneError = validatePhone(formData.phone);
    if (!formData.phone) {
      setErrors({ phone: 'Phone number is required' });
      return;
    }
    if (phoneError) {
      setErrors({ phone: phoneError });
      return;
    }
    
    // Validate address fields
    if (!formData.pincode || formData.pincode.length !== 6) {
      setErrors({ pincode: 'Valid 6-digit PIN code is required' });
      return;
    }
    if (!formData.address || formData.address.trim().length < 5) {
      setErrors({ address: 'Street address is required (min 5 characters)' });
      return;
    }
    if (!formData.city || formData.city.trim().length < 2) {
      setErrors({ city: 'City is required' });
      return;
    }
    if (!formData.state || formData.state.trim().length < 2) {
      setErrors({ state: 'State is required' });
      return;
    }
    
    setLoading(true);
    
    try {
      // OTP verification is secure enough - no reCAPTCHA needed for registration
      const response = await axios.post(
        `${API_URL}/api/auth/send-otp`,
        { email: formData.email }
      );
      
      if (response.data.dev_otp) {
        toast.info(`DEV MODE: Your OTP is ${response.data.dev_otp}`, { duration: 10000 });
        setFormData(prev => ({ ...prev, otp: response.data.dev_otp }));
      } else {
        toast.success('OTP sent to your email!');
      }
      
      setOtpSent(true);
      setRegisterStep(2);
      setResendTimer(60);
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to send OTP';
      toast.error(message);
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
      const response = await axios.post(`${API_URL}/api/auth/verify-otp`, {
        email: formData.email,
        otp: formData.otp
      });
      
      toast.success('Email verified!');
      setOtpVerified(true);
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid OTP';
      toast.error(message);
      setErrors({ otp: message });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setOtpSent(false);
    setRegisterStep(1);
    setFormData(prev => ({ ...prev, otp: '' }));
  };

  const handleRegisterSubmit = async () => {
    if (!otpVerified) {
      toast.error('Please verify your email first');
      return;
    }
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/auth/register-with-otp`, {
        email: formData.email,
        password: formData.password,
        name: formData.name.trim(),
        username: formData.username?.trim() || null,  // Unique login name
        phone: formData.phone,  // Now required
        country_code: formData.countryCode.split('-')[0],
        alternate_phone: formData.alternatePhone || null,  // Optional alternate phone
        salutation: formData.salutation || null,
        gender: formData.gender || null,
        date_of_birth: formData.dateOfBirth || null,  // YYYY-MM-DD format
        date_of_marriage: formData.dateOfMarriage || null,  // Optional, for gift codes
        otp: formData.otp,
        // Address fields (all required)
        address: formData.address.trim(),
        landmark: formData.landmark?.trim() || null,  // Nearby landmark
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode
      }, { withCredentials: true });
      
      toast.success('Registration successful!');
      await checkAuth();
      
      const from = location.state?.from || '/account';
      navigate(from, { replace: true });
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (authMode === 'register') {
      if (!otpSent) {
        await handleSendOTP();
      } else if (!otpVerified) {
        await handleVerifyOTP();
      } else {
        await handleRegisterSubmit();
      }
      return;
    }
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Use loginIdentifier for user login (can be email or username)
      const result = await login(formData.loginIdentifier, formData.password);
      if (result.success) {
        const from = location.state?.from || '/account';
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" 
               style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
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
            <span>Back</span>
          </button>
          <a href="/" className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            ADDRIKA
          </a>
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8" style={{ border: '1px solid var(--border)' }}>
            {/* Title */}
            <div className="text-center mb-8">
              <h1 
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                {isLoginMode ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p style={{ color: 'var(--text-subtle)' }}>
                {isLoginMode 
                  ? 'Sign in to view your orders and more' 
                  : authMode === 'register' && otpVerified
                    ? 'Complete your registration'
                    : authMode === 'register' && otpSent
                      ? 'Enter the OTP sent to your email'
                      : 'Join us for a seamless shopping experience'}
              </p>
            </div>

            {/* Google Login Button - REMOVED */}
            {/* Social login removed per user request */}

            {/* Registration Progress Steps */}
            {authMode === 'register' && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${registerStep >= 1 ? 'bg-[var(--japanese-indigo)]' : 'bg-gray-300'}`}>
                  {otpSent ? <CheckCircle size={16} /> : '1'}
                </div>
                <div className={`w-12 h-1 ${otpSent ? 'bg-[var(--japanese-indigo)]' : 'bg-gray-200'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${registerStep >= 2 && otpVerified ? 'bg-[var(--japanese-indigo)]' : registerStep >= 2 ? 'bg-[var(--metallic-gold)]' : 'bg-gray-300'}`}>
                  {otpVerified ? <CheckCircle size={16} /> : '2'}
                </div>
                <div className={`w-12 h-1 ${otpVerified ? 'bg-[var(--japanese-indigo)]' : 'bg-gray-200'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${otpVerified ? 'bg-[var(--japanese-indigo)]' : 'bg-gray-300'}`}>
                  3
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Registration - Step 1: Email + Name */}
              {authMode === 'register' && !otpSent && (
                <>
                  {/* Row 1: Title, Full Name */}
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-1">
                      <Label htmlFor="salutation">Title *</Label>
                      <select
                        id="salutation"
                        name="salutation"
                        value={formData.salutation}
                        onChange={(e) => {
                          const title = e.target.value;
                          // Auto-set gender based on title
                          let autoGender = formData.gender;
                          if (title === 'Mr.') autoGender = 'Male';
                          else if (title === 'Mrs.' || title === 'Ms.') autoGender = 'Female';
                          setFormData(prev => ({ ...prev, salutation: title, gender: autoGender }));
                        }}
                        className="w-full h-9 rounded-md border border-input bg-white dark:bg-slate-700 dark:text-gray-100 px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="register-salutation-select"
                        required
                      >
                        <option value="" className="dark:bg-slate-700">--</option>
                        <option value="Mr." className="dark:bg-slate-700">Mr.</option>
                        <option value="Mrs." className="dark:bg-slate-700">Mrs.</option>
                        <option value="Ms." className="dark:bg-slate-700">Ms.</option>
                        <option value="Dr." className="dark:bg-slate-700">Dr.</option>
                        <option value="Prof." className="dark:bg-slate-700">Prof.</option>
                      </select>
                    </div>
                    
                    <div className="col-span-5">
                      <Label htmlFor="name">Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Enter your full name (letters only)"
                          className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                          data-testid="register-name-input"
                        />
                      </div>
                      {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                    </div>
                  </div>

                  {/* Row 2: Gender, Date of Birth, Date of Marriage */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="gender">Gender *</Label>
                      <select
                        id="gender"
                        name="gender"
                        value={formData.gender}
                        onChange={(e) => {
                          const gender = e.target.value;
                          // Auto-update title if not already set or if it conflicts
                          let autoTitle = formData.salutation;
                          if (!autoTitle || (gender === 'Male' && (autoTitle === 'Mrs.' || autoTitle === 'Ms.')) || 
                              (gender === 'Female' && autoTitle === 'Mr.')) {
                            if (gender === 'Male') autoTitle = 'Mr.';
                            else if (gender === 'Female') autoTitle = 'Ms.';
                            else autoTitle = '';
                          }
                          setFormData(prev => ({ ...prev, gender, salutation: autoTitle }));
                        }}
                        className="w-full h-9 rounded-md border border-input bg-white dark:bg-slate-700 dark:text-gray-100 px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="register-gender-select"
                        required
                      >
                        <option value="" className="dark:bg-slate-700">Select</option>
                        <option value="Male" className="dark:bg-slate-700">Male</option>
                        <option value="Female" className="dark:bg-slate-700">Female</option>
                        <option value="Other" className="dark:bg-slate-700">Other</option>
                      </select>
                      {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split('T')[0]}
                        className={`${errors.dateOfBirth ? 'border-red-500' : ''}`}
                        data-testid="register-dob-input"
                        required
                      />
                      {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="dateOfMarriage">Anniversary (Optional)</Label>
                      <Input
                        id="dateOfMarriage"
                        name="dateOfMarriage"
                        type="date"
                        value={formData.dateOfMarriage}
                        onChange={handleInputChange}
                        className="w-full"
                        data-testid="register-dom-input"
                        title="For special gift codes on your anniversary"
                      />
                      <p className="text-xs text-gray-500 mt-0.5">For gift codes</p>
                    </div>
                  </div>

                  {/* Username field */}
                  <div>
                    <Label htmlFor="username">Username (Optional)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                      <Input
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={async (e) => {
                          const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                          setFormData(prev => ({ ...prev, username: value }));
                          setUsernameAvailable(null);
                          
                          // Check availability after 500ms debounce
                          if (value.length >= 3) {
                            setCheckingUsername(true);
                            try {
                              const res = await axios.get(`${API_URL}/api/auth/check-username/${value}`);
                              setUsernameAvailable(res.data.available);
                              if (!res.data.available && res.data.error) {
                                setErrors(prev => ({ ...prev, username: res.data.error }));
                              } else {
                                setErrors(prev => ({ ...prev, username: null }));
                              }
                            } catch (err) {
                              console.error('Username check failed:', err);
                            } finally {
                              setCheckingUsername(false);
                            }
                          }
                        }}
                        placeholder="Choose a unique username"
                        className={`pl-8 ${errors.username ? 'border-red-500' : usernameAvailable === true ? 'border-green-500' : ''}`}
                        data-testid="register-username-input"
                      />
                      {checkingUsername && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Checking...</span>
                      )}
                      {!checkingUsername && usernameAvailable === true && formData.username.length >= 3 && (
                        <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Letters, numbers, underscores only. Min 3 chars.</p>
                    {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                    {usernameAvailable === false && !errors.username && (
                      <p className="text-red-500 text-sm mt-1">Username already taken</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="email"
                        name="email"
                        type="text"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                        data-testid="auth-email-input"
                      />
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                      ⚠️ Email cannot be changed after registration. Used for order updates.
                    </p>
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Min 6 characters"
                        className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                        data-testid="auth-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                  </div>

                  {/* Phone Numbers Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone *</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Select value={formData.countryCode} onValueChange={(value) => setFormData(prev => ({ ...prev, countryCode: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Code">
                                {countryCodes.find(c => c.key === formData.countryCode)?.flag} {formData.countryCode.split('-')[0]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {countryCodes.map((country) => (
                                <SelectItem key={country.key} value={country.key}>
                                  {country.flag} {country.code} ({country.country})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Input
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="Numbers only"
                            inputMode="numeric"
                            className={errors.phone ? 'border-red-500' : ''}
                            data-testid="register-phone-input"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        ⚠️ Phone cannot be changed after registration.
                      </p>
                      {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                    </div>
                    
                    <div>
                      <Label>Alternate Phone (Optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                          id="alternatePhone"
                          name="alternatePhone"
                          value={formData.alternatePhone}
                          onChange={handleInputChange}
                          placeholder="Alternate number"
                          inputMode="numeric"
                          className="pl-9"
                          data-testid="register-alternate-phone-input"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">For delivery backup</p>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--japanese-indigo)' }}>
                      Billing Address
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="pincode">PIN Code *</Label>
                        <Input
                          id="pincode"
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          placeholder="6-digit PIN code"
                          maxLength={6}
                          inputMode="numeric"
                          className={errors.pincode ? 'border-red-500' : ''}
                          data-testid="register-pincode-input"
                        />
                        {errors.pincode && <p className="text-red-500 text-sm mt-1">{errors.pincode}</p>}
                        <p className="text-xs text-gray-500 mt-1">City & State will auto-fill from PIN code</p>
                      </div>
                      
                      <div>
                        <Label htmlFor="address">Street Address *</Label>
                        <Input
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="House/Flat No., Building, Street"
                          className={errors.address ? 'border-red-500' : ''}
                          data-testid="register-address-input"
                        />
                        {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                      </div>
                      
                      <div>
                        <Label htmlFor="landmark">Nearby Landmark (Optional)</Label>
                        <Input
                          id="landmark"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          placeholder="e.g., Near ABC Hospital, Opposite XYZ Mall"
                          data-testid="register-landmark-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">Helps with easier delivery</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            readOnly
                            placeholder="Auto-filled from PIN"
                            className={`${errors.city ? 'border-red-500' : ''} ${formData.city ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'} cursor-not-allowed`}
                            data-testid="register-city-input"
                          />
                          {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                        </div>
                        <div>
                          <Label htmlFor="state">State *</Label>
                          <Input
                            id="state"
                            name="state"
                            value={formData.state}
                            readOnly
                            placeholder="Auto-filled from PIN"
                            className={`${errors.state ? 'border-red-500' : ''} ${formData.state ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'} cursor-not-allowed`}
                            data-testid="register-state-input"
                          />
                          {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security note */}
                  <p className="text-xs text-center text-gray-500">
                    We'll send a verification code to your email
                  </p>
                </>
              )}

              {/* Registration - Step 2: OTP Verification */}
              {authMode === 'register' && otpSent && !otpVerified && (
                <>
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--cream)] flex items-center justify-center mx-auto mb-4">
                      <Mail size={32} style={{ color: 'var(--japanese-indigo)' }} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      We've sent a verification code to<br />
                      <strong style={{ color: 'var(--japanese-indigo)' }}>{formData.email}</strong>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="otp">Enter 6-digit OTP *</Label>
                    <Input
                      id="otp"
                      name="otp"
                      value={formData.otp}
                      onChange={handleInputChange}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      className={`text-center text-2xl tracking-widest ${errors.otp ? 'border-red-500' : ''}`}
                      data-testid="otp-input"
                    />
                    {errors.otp && <p className="text-red-500 text-sm mt-1 text-center">{errors.otp}</p>}
                  </div>

                  <p className="text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Didn't receive the code?{' '}
                    {resendTimer > 0 ? (
                      <span>Resend in {resendTimer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        className="font-semibold hover:underline"
                        style={{ color: 'var(--japanese-indigo)' }}
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                </>
              )}

              {/* Registration - Step 3: Review & Complete */}
              {authMode === 'register' && otpVerified && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                    Email Verified!
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-subtle)' }}>
                    Click below to complete your registration
                  </p>
                  <div className="bg-[var(--cream)] rounded-lg p-4 text-left mb-4 text-sm space-y-1">
                    <p><strong>Name:</strong> {formData.salutation} {formData.name}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    {formData.phone && <p><strong>Phone:</strong> {formData.countryCode.split('-')[0]} {formData.phone}</p>}
                    {formData.alternatePhone && <p><strong>Alt Phone:</strong> {formData.countryCode.split('-')[0]} {formData.alternatePhone}</p>}
                    {formData.dateOfBirth && <p><strong>DOB:</strong> {(() => {
                      const date = new Date(formData.dateOfBirth);
                      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                      return `${String(date.getDate()).padStart(2, '0')}${months[date.getMonth()]}${date.getFullYear()}`;
                    })()}</p>}
                    {formData.dateOfMarriage && <p><strong>Anniversary:</strong> {(() => {
                      const date = new Date(formData.dateOfMarriage);
                      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                      return `${String(date.getDate()).padStart(2, '0')}${months[date.getMonth()]}${date.getFullYear()}`;
                    })()}</p>}
                  </div>
                </div>
              )}

              {/* Login Form */}
              {isLoginMode && (
                <>
                  <div>
                    <Label htmlFor="loginIdentifier">Email or Username *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="loginIdentifier"
                        name="loginIdentifier"
                        type="text"
                        value={formData.loginIdentifier}
                        onChange={handleInputChange}
                        placeholder="Enter email or username"
                        className={`pl-10 ${errors.loginIdentifier ? 'border-red-500' : ''}`}
                        data-testid="auth-email-input"
                      />
                    </div>
                    {errors.loginIdentifier && <p className="text-red-500 text-sm mt-1">{errors.loginIdentifier}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                        data-testid="auth-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                  </div>
                  
                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--metallic-gold)' }}
                      data-testid="forgot-password-link"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-6 text-white font-semibold"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
                data-testid="auth-submit-btn"
              >
                {loading ? 'Please wait...' : (
                  isLoginMode ? 'Sign In' : 
                  !otpSent ? 'Send OTP' :
                  !otpVerified ? 'Verify OTP' :
                  'Complete Registration'
                )}
              </Button>
            </form>

            {/* Toggle Mode */}
            <div className="text-center mt-6 space-y-2">
              {!(authMode === 'register' && (otpSent || otpVerified)) && (
                <p style={{ color: 'var(--text-subtle)' }}>
                  {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setErrors({});
                      setFormData({
                        email: '',
                        password: '',
                        name: '',
                        loginIdentifier: '',
                        countryCode: '+91-IN',
                        phone: '',
                        pin: '',
                        otp: ''
                      });
                    }}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--japanese-indigo)' }}
                    data-testid="toggle-auth-mode"
                  >
                    {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              )}
              
              {authMode === 'register' && (otpSent || otpVerified) && (
                <p style={{ color: 'var(--text-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpVerified(false);
                      setRegisterStep(1);
                      setFormData(prev => ({ ...prev, otp: '' }));
                    }}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--japanese-indigo)' }}
                  >
                    ← Start Over
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Main component with reCAPTCHA Provider
const AuthPage = () => {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <AuthForm />
    </GoogleReCaptchaProvider>
  );
};

export default AuthPage;
