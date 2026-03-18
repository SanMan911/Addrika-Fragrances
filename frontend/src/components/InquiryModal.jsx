import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, LogIn, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { fetchProducts } from '../services/productService';
import { packageSizes } from '../mockData';
import { toast as sonnerToast } from 'sonner';
import axios from 'axios';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const HCAPTCHA_SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001';

// Country codes for the dropdown - using unique keys (code + country abbreviation)
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
  { code: '+82', country: 'South Korea', flag: '🇰🇷', key: '+82-KR' },
  { code: '+86', country: 'China', flag: '🇨🇳', key: '+86-CN' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', key: '+977-NP' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', key: '+880-BD' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', key: '+94-LK' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', key: '+92-PK' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', key: '+27-ZA' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', key: '+234-NG' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', key: '+254-KE' },
];

const InquiryModal = ({ isOpen, onClose, type }) => {
  const captchaRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Fetch products for dropdown
  const [fragrances, setFragrances] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  useEffect(() => {
    const loadProducts = async () => {
      if (isOpen && fragrances.length === 0) {
        setLoadingProducts(true);
        try {
          const products = await fetchProducts();
          setFragrances(products);
        } catch (error) {
          console.error('Failed to load products:', error);
        } finally {
          setLoadingProducts(false);
        }
      }
    };
    loadProducts();
  }, [isOpen, fragrances.length]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    countryCode: '+91-IN',
    phone: '',
    company: '',
    fragrance: '',
    packageSize: '',
    quantity: '',
    message: '',
    // Distributor-specific fields
    businessType: '',
    region: '',
    experience: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [errors, setErrors] = useState({});

  // Auto-fill email when user is logged in
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }));
    }
  }, [isAuthenticated, user]);

  // Validation functions
  const validateName = (name) => {
    // Only allow letters, spaces, and basic punctuation (no special characters)
    const nameRegex = /^[a-zA-Z\s.'-]+$/;
    if (!name.trim()) return 'Full name is required';
    if (!nameRegex.test(name)) return 'Name should contain only letters (no special characters)';
    if (name.length < 2) return 'Name must be at least 2 characters';
    return '';
  };

  const validatePhone = (phone) => {
    // Only allow numbers (no special symbols)
    const phoneRegex = /^[0-9]+$/;
    if (!phone.trim()) return 'Phone number is required';
    if (!phoneRegex.test(phone)) return 'Phone should contain only numbers (no special symbols)';
    if (phone.length < 6 || phone.length > 15) return 'Phone number must be 6-15 digits';
    return '';
  };

  const validateQuantity = (quantity) => {
    if (!quantity) return 'Quantity is required';
    const numRegex = /^[0-9]+$/;
    if (!numRegex.test(quantity)) return 'Quantity should contain only numbers';
    if (parseInt(quantity) < 1) return 'Quantity must be at least 1';
    return '';
  };

  const validateMessage = (message) => {
    if (!message) return ''; // Optional field
    
    // Check for URLs/hyperlinks
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.(com|org|net|io|co|in|edu|gov)[^\s]*)/gi;
    if (urlRegex.test(message)) return 'Links/URLs are not allowed in the message';
    
    // Check for email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(message)) return 'Email addresses are not allowed in the message';
    
    return '';
  };

  const validateForm = () => {
    const newErrors = {};
    
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;
    
    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;
    
    // Only validate product fields for non-distributor inquiries
    if (type !== 'distributor') {
      const quantityError = validateQuantity(formData.quantity);
      if (quantityError) newErrors.quantity = quantityError;
      
      if (!formData.fragrance) newErrors.fragrance = 'Please select a fragrance';
      if (!formData.packageSize) newErrors.packageSize = 'Please select a package size';
    }
    
    // Distributor-specific validations
    if (type === 'distributor') {
      if (!formData.company) newErrors.company = 'Company/Business name is required';
      if (!formData.businessType) newErrors.businessType = 'Please select your business type';
      if (!formData.region) newErrors.region = 'Please specify your target region';
    }
    
    const messageError = validateMessage(formData.message);
    if (messageError) newErrors.message = messageError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      sonnerToast.error('Please login to submit an inquiry');
      return;
    }
    
    if (!validateForm()) {
      sonnerToast.error('Please fix the errors in the form');
      return;
    }
    
    if (!captchaToken) {
      sonnerToast.error('Please complete the captcha verification');
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Build the request body based on inquiry type
      const requestBody = {
        name: formData.name.trim(),
        email: formData.email,
        phone: `${formData.countryCode.split('-')[0]} ${formData.phone}`,
        company: formData.company || '',
        message: formData.message.trim(),
        inquiryType: type
      };

      // Add product fields for non-distributor inquiries
      if (type !== 'distributor') {
        requestBody.fragrance = formData.fragrance;
        requestBody.packageSize = formData.packageSize;
        requestBody.quantity = parseInt(formData.quantity);
      }

      // Add distributor-specific fields
      if (type === 'distributor') {
        requestBody.businessType = formData.businessType;
        requestBody.region = formData.region;
        requestBody.experience = formData.experience || '';
      }

      const response = await axios.post(
        `${BACKEND_URL}/api/inquiries?captcha_token=${encodeURIComponent(captchaToken)}`, 
        requestBody
      );

      if (response.data) {
        sonnerToast.success(type === 'distributor' ? 'Partnership Inquiry Received!' : 'Inquiry Received!', {
          description: "Thank you for your interest. We'll get back to you shortly.",
        });
        onClose();
        setFormData({
          name: '',
          email: user?.email || '',
          countryCode: '+91-IN',
          phone: '',
          company: '',
          fragrance: '',
          packageSize: '',
          quantity: '',
          message: '',
          businessType: '',
          region: '',
          experience: ''
        });
        setCaptchaToken('');
        setErrors({});
        if (captchaRef.current) {
          captchaRef.current.resetCaptcha();
        }
      }
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      sonnerToast.error('Submission Failed', {
        description: error.response?.data?.detail || 'Please try again later or contact us directly.',
      });
      setCaptchaToken('');
      if (captchaRef.current) {
        captchaRef.current.resetCaptcha();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLoginClick = () => {
    onClose();
    navigate('/login', { state: { from: window.location.pathname } });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
      <div 
        className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 flex items-center justify-between p-6 border-b z-10"
          style={{ backgroundColor: 'var(--cream)' }}
        >
          <div>
            <h3 
              className="text-2xl font-bold font-serif"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              {type === 'retail' ? 'Purchase Inquiry' : type === 'distributor' ? 'Partnership Inquiry' : 'Wholesale Inquiry'}
            </h3>
            <p style={{ color: 'var(--text-subtle)' }}>
              {type === 'retail' ? 'Fill in the details below to place your order' : type === 'distributor' ? 'Become a regional distributor for Addrika' : 'Get in touch for bulk orders'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/50"
            style={{ transition: 'background-color 0.3s ease' }}
          >
            <X size={24} style={{ color: 'var(--japanese-indigo)' }} />
          </button>
        </div>

        {/* Login Required Message */}
        {!isAuthenticated ? (
          <div className="p-8 text-center">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'var(--cream)' }}
            >
              <LogIn size={36} style={{ color: 'var(--japanese-indigo)' }} />
            </div>
            <h4 
              className="text-xl font-bold mb-3"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Login Required
            </h4>
            <p className="mb-6" style={{ color: 'var(--text-subtle)' }}>
              Please login or create an account to submit {type === 'distributor' ? 'a partnership' : 'a wholesale'} inquiry. 
              This helps us serve you better and keep track of your requests.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLoginClick}
                className="text-white font-semibold"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <LogIn size={18} className="mr-2" />
                Login / Sign Up
              </Button>
            </div>
          </div>
        ) : (
          /* Form - Only shown when authenticated */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Full Name */}
            <div>
              <Label htmlFor="name" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                Full Name *
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter your full name (letters only)"
                className={`w-full ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Email (locked/readonly) */}
            <div>
              <Label htmlFor="email" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                Email * <span className="text-xs text-gray-400">(from your account)</span>
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  readOnly
                  disabled
                  className="w-full bg-gray-100 cursor-not-allowed pr-10"
                />
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email is auto-filled from your account and cannot be changed</p>
            </div>

            {/* Company Name - Required for distributor, Optional otherwise */}
            <div>
              <Label htmlFor="company" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                {type === 'distributor' ? 'Company/Business Name *' : 'Company Name (Optional)'}
              </Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder={type === 'distributor' ? 'Your registered business name' : 'Your company or business name'}
                className={`w-full ${errors.company ? 'border-red-500' : ''}`}
                required={type === 'distributor'}
              />
              {errors.company && <p className="text-red-500 text-sm mt-1">{errors.company}</p>}
            </div>

            {/* Distributor-specific fields */}
            {type === 'distributor' && (
              <>
                {/* Business Type */}
                <div>
                  <Label htmlFor="businessType" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                    Business Type *
                  </Label>
                  <Select value={formData.businessType} onValueChange={(value) => handleChange('businessType', value)}>
                    <SelectTrigger className={errors.businessType ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select your business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retailer">Retail Store Owner</SelectItem>
                      <SelectItem value="wholesaler">Wholesaler/Distributor</SelectItem>
                      <SelectItem value="supermarket">Supermarket/Hypermarket</SelectItem>
                      <SelectItem value="ecommerce">E-commerce Seller</SelectItem>
                      <SelectItem value="temple">Temple/Religious Institution</SelectItem>
                      <SelectItem value="corporate">Corporate/Gifting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.businessType && <p className="text-red-500 text-sm mt-1">{errors.businessType}</p>}
                </div>

                {/* Target Region */}
                <div>
                  <Label htmlFor="region" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                    Target Region/City *
                  </Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => handleChange('region', e.target.value)}
                    placeholder="e.g., Delhi NCR, Mumbai, South India, etc."
                    className={`w-full ${errors.region ? 'border-red-500' : ''}`}
                    required
                  />
                  {errors.region && <p className="text-red-500 text-sm mt-1">{errors.region}</p>}
                </div>

                {/* Experience */}
                <div>
                  <Label htmlFor="experience" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                    Industry Experience (Optional)
                  </Label>
                  <Select value={formData.experience} onValueChange={(value) => handleChange('experience', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New to the industry</SelectItem>
                      <SelectItem value="1-3">1-3 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Country Code + Phone */}
            <div>
              <Label className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                Phone (Pref. Arattai/WhatsApp) *
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="mb-1 block text-xs text-gray-500">Country Code</Label>
                  <Select value={formData.countryCode} onValueChange={(value) => handleChange('countryCode', value)}>
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
                  <Label className="mb-1 block text-xs text-gray-500">Phone Number</Label>
                  <Input
                    id="phone"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formData.phone}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      handleChange('phone', value);
                    }}
                    placeholder="Numbers only (e.g., 9876543210)"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                </div>
              </div>
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* Product Selection - Only for non-distributor inquiries */}
            {type !== 'distributor' && (
              <>
                {/* Fragrance Selection */}
                <div>
                  <Label htmlFor="fragrance" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                    Select Fragrance *
                  </Label>
                  <Select value={formData.fragrance} onValueChange={(value) => handleChange('fragrance', value)}>
                    <SelectTrigger className={errors.fragrance ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Choose a fragrance" />
                    </SelectTrigger>
                    <SelectContent>
                      {fragrances.map((fragrance) => (
                        <SelectItem key={fragrance.id} value={fragrance.name}>
                          {fragrance.name} - {fragrance.subtitle}
                        </SelectItem>
                      ))}
                      <SelectItem value="mixed">Mixed Selection</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.fragrance && <p className="text-red-500 text-sm mt-1">{errors.fragrance}</p>}
                </div>

                {/* Package Size & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="packageSize" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                      Package Size *
                    </Label>
                    <Select value={formData.packageSize} onValueChange={(value) => handleChange('packageSize', value)}>
                      <SelectTrigger className={errors.packageSize ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {packageSizes.map((pkg, index) => (
                          <SelectItem key={index} value={pkg.weight}>
                            {pkg.weight} - {pkg.sticks}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.packageSize && <p className="text-red-500 text-sm mt-1">{errors.packageSize}</p>}
                  </div>
                  <div>
                    <Label htmlFor="quantity" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                      Quantity *
                    </Label>
                    <Input
                      id="quantity"
                      type="text"
                      inputMode="numeric"
                      required
                      value={formData.quantity}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleChange('quantity', value);
                      }}
                      placeholder="Number of packs (numbers only)"
                      className={errors.quantity ? 'border-red-500' : ''}
                    />
                    {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Additional Message */}
            <div>
              <Label htmlFor="message" className="mb-2 block" style={{ color: 'var(--text-dark)' }}>
                {type === 'distributor' ? 'Tell Us About Your Business (Optional)' : 'Additional Message (Optional)'}
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder={type === 'distributor' 
                  ? "Share your current distribution network, storage facilities, and why you'd like to partner with Addrika..."
                  : "Any special requirements or questions? (No links or email addresses allowed)"}
                rows={4}
                className={errors.message ? 'border-red-500' : ''}
              />
              {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
              <p className="text-xs text-gray-500 mt-1">Note: Links, URLs, and email addresses are not allowed</p>
            </div>

            {/* hCaptcha */}
            <div className="flex justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken('')}
                onError={() => {
                  setCaptchaToken('');
                  sonnerToast.error('Captcha error. Please try again.');
                }}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !captchaToken}
                className="flex-1 text-white font-semibold"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InquiryModal;
