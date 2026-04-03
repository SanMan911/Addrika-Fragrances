'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

// Country codes
const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳', key: '+91-IN' },
  { code: '+1', country: 'USA', flag: '🇺🇸', key: '+1-US' },
  { code: '+44', country: 'UK', flag: '🇬🇧', key: '+44-GB' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', key: '+971-AE' },
];

export default function ForgotUsernameClient() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [formData, setFormData] = useState({
    countryCode: '+91-IN',
    phone: ''
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;
    
    if (name === 'phone') {
      filteredValue = value.replace(/[^0-9]/g, '');
    }
    
    setFormData(prev => ({ ...prev, [name]: filteredValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.phone || formData.phone.length < 10) {
      newErrors.phone = 'Valid phone number is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          country_code: formData.countryCode.split('-')[0]
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to retrieve username');
      }
      
      setMaskedEmail(data.email_masked);
      setSent(true);
      toast.success('Username sent to your email!');
    } catch (error) {
      toast.error(error.message);
      setErrors({ phone: error.message });
    } finally {
      setLoading(false);
    }
  };

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
        <div className="w-full max-w-md">
          <div 
            className="rounded-2xl p-8"
            style={{ 
              background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
            }}
          >
            {/* Back Link */}
            <Link 
              href="/login" 
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>

            {!sent ? (
              <>
                {/* Title */}
                <div className="text-center mb-6">
                  <div 
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(212,175,55,0.15)' }}
                  >
                    <Phone className="w-8 h-8 text-[#D4AF37]" />
                  </div>
                  <h1 
                    className="text-2xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Forgot Username?
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Enter your registered phone number to receive your username via email
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Registered Phone Number *
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                        className="w-28 h-12 rounded-xl px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                        style={selectStyles}
                        data-testid="forgot-username-country-code"
                      >
                        {countryCodes.map(c => (
                          <option key={c.key} value={c.key} className="bg-[#1a252f]">{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Phone number"
                          className="w-full h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] placeholder-gray-500"
                          style={inputStyles}
                          data-testid="forgot-username-phone-input"
                        />
                      </div>
                    </div>
                    {errors.phone && <p className="text-red-400 text-sm mt-2">{errors.phone}</p>}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ 
                      background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                      color: '#1a1a2e'
                    }}
                    data-testid="forgot-username-submit-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Username'
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-4">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: 'rgba(16,185,129,0.15)' }}
                >
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 
                  className="text-xl font-semibold text-white mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Username Sent!
                </h2>
                <p className="text-gray-400 mb-4">
                  We&apos;ve sent your username to your registered email address.
                </p>
                <div 
                  className="rounded-xl p-4 mb-6"
                  style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
                >
                  <div className="flex items-center justify-center gap-2 text-[#D4AF37]">
                    <Mail size={18} />
                    <span className="font-medium">{maskedEmail}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-6">
                  Please check your inbox (and spam folder) for an email from Addrika.
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full py-4 rounded-xl font-semibold transition-all text-center"
                  style={{ 
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e'
                  }}
                  data-testid="back-to-login-btn"
                >
                  Back to Login
                </Link>
              </div>
            )}

            {/* Help Text */}
            <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-gray-400 text-sm">
                Remember your username?{' '}
                <Link href="/login" className="font-semibold text-[#D4AF37] hover:underline">
                  Sign In
                </Link>
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Need help?{' '}
                <Link href="/contact" className="text-[#D4AF37] hover:underline">
                  Contact Support
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
