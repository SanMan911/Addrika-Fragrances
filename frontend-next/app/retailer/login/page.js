'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Eye, EyeOff, Lock, User, CheckCircle2 } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function WaitlistComingSoon() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    gst_number: '',
    city: '',
    message: '',
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name || !form.contact_name || !form.email || !form.phone) {
      toast.error('Please fill business name, contact, email & phone');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.gst_number) delete payload.gst_number;
      if (!payload.city) delete payload.city;
      if (!payload.message) delete payload.message;
      const res = await fetch(`${API_URL}/api/retailer-auth/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'Submission failed');
      }
      setSubmitted(true);
      toast.success("You're on the list — we'll be in touch!");
    } catch (e) {
      toast.error(typeof e.message === 'string' ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A]"
        data-testid="retailer-waitlist-success"
      >
        <div className="w-full max-w-md p-8 rounded-xl shadow-2xl bg-[#F5F0E8] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-green-600">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A] mb-2">You&apos;re on the list!</h1>
          <p className="text-gray-600 mb-5">
            Thank you for your interest in becoming an Addrika retail partner.
            Our team will review your details and reach out shortly.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-lg bg-[#2B3A4A] text-white font-medium hover:bg-[#1e3a52]"
          >
            Back to Addrika
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A] py-10"
      data-testid="retailer-portal-disabled"
    >
      <div className="w-full max-w-lg p-7 rounded-xl shadow-2xl bg-[#F5F0E8]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-[#D4AF37]">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">
            Retailer Portal Coming Soon
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Onboarding by invitation. Join our waitlist and our team will
            reach out to begin your retailer KYC.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3" data-testid="waitlist-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Business Name*"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-business-name"
            />
            <input
              type="text"
              placeholder="Contact Name*"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-contact-name"
            />
            <input
              type="email"
              placeholder="Email*"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-email"
            />
            <input
              type="tel"
              placeholder="Phone*"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-phone"
            />
            <input
              type="text"
              placeholder="GST Number (optional)"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none uppercase"
              data-testid="waitlist-gst"
              maxLength={15}
            />
            <input
              type="text"
              placeholder="City (optional)"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-city"
            />
          </div>
          <textarea
            placeholder="Tell us about your business (optional)"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none min-h-[80px]"
            maxLength={1000}
            data-testid="waitlist-message"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-[#2B3A4A] text-white font-medium hover:bg-[#1e3a52] disabled:opacity-50"
            data-testid="waitlist-submit"
          >
            {submitting ? 'Submitting…' : 'Join the Waitlist'}
          </button>
          <p className="text-xs text-center text-gray-500">
            By submitting you agree to be contacted by the Addrika team at
            contact.us@centraders.com.
          </p>
          <div className="text-center">
            <Link href="/" className="text-sm text-[#2B3A4A] underline hover:text-[#D4AF37]">
              Back to Addrika
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RetailerLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useRetailerAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(null); // null=loading, true/false known

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/retailer-auth/portal-status`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!cancelled) setPortalEnabled(Boolean(data.enabled));
      } catch {
        if (!cancelled) setPortalEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/retailer/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!identifier || !password) {
      toast.error('Please enter email/username and password');
      return;
    }
    setLoading(true);
    const result = await login(identifier, password);
    setLoading(false);
    if (result.success) {
      toast.success('Login successful!');
      router.push('/retailer/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };
  if (isLoading || portalEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A]">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!portalEnabled) {
    return <WaitlistComingSoon />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A]">
      <div className="w-full max-w-md p-8 rounded-xl shadow-2xl bg-[#F5F0E8]">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-[#D4AF37]">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Retailer Portal</h1>
          <p className="text-gray-500">Sign in to manage your store</p>
        </div>
        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              Email or Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or username"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                data-testid="retailer-identifier-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                data-testid="retailer-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2B3A4A] text-white rounded-xl font-semibold hover:bg-[#1a252f] transition-colors disabled:opacity-50"
            data-testid="retailer-login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <a 
              href="mailto:contact.us@centraders.com" 
              className="font-medium text-[#D4AF37] hover:underline"
            >
              Contact Admin
            </a>
          </p>
        </div>
        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs text-gray-500">Addrika Retailer Portal</p>
          <Link href="/" className="text-xs text-[#D4AF37] hover:underline">
            Visit Main Store
          </Link>
        </div>
      </div>
    </div>
  );
}
