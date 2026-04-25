'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Eye, EyeOff, Lock, User, CheckCircle2, ChevronDown } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
import { titleCase, lowerEmail, COUNTRY_CODES, GST_REGEX } from '../../../lib/formHelpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function WaitlistComingSoon() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gstStatus, setGstStatus] = useState({ state: 'idle' }); // idle | looking | verified | failed
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    country_code: '+91',
    phone: '',
    gst_number: '',
    city: '',
    state: '',
    message: '',
  });

  // Auto-prefill business name + city + state when a complete valid GSTIN is typed
  useEffect(() => {
    const gst = (form.gst_number || '').toUpperCase();
    if (!GST_REGEX.test(gst)) {
      if (gstStatus.state !== 'idle') setGstStatus({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setGstStatus({ state: 'looking' });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/retailer-auth/waitlist/gst-lookup/${gst}`
        );
        if (cancelled) return;
        const data = await res.json();
        if (!data || data.verified === false) {
          setGstStatus({ state: 'failed', error: data?.error || 'GST not verified' });
          // Still prefill state from GSTIN prefix
          if (data?.state) {
            setForm((f) => ({ ...f, state: f.state || data.state }));
          }
          return;
        }
        setGstStatus({ state: 'verified', legal_name: data.legal_name });
        setForm((f) => ({
          ...f,
          // Only prefill empty fields — never overwrite user-typed values
          business_name: f.business_name || data.business_name || '',
          city: f.city || data.city || '',
          state: f.state || data.state || '',
        }));
      } catch {
        if (!cancelled) setGstStatus({ state: 'failed', error: 'Lookup unavailable' });
      }
    }, 400); // debounce
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.gst_number]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!GST_REGEX.test((form.gst_number || '').toUpperCase())) {
      toast.error('GST is required — please enter a valid 15-character GSTIN');
      return;
    }
    if (!form.business_name || !form.contact_name || !form.email || !form.phone) {
      toast.error('Please fill business name, contact, email & WhatsApp');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      payload.email = lowerEmail(payload.email);
      payload.gst_number = (payload.gst_number || '').toUpperCase();
      if (!payload.city) delete payload.city;
      if (!payload.state) delete payload.state;
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
          {/* Step 1 — GST first. Required, drives autofill. */}
          <div className="rounded-lg p-4 border-2 border-[#D4AF37]/40 bg-white/60">
            <label className="block text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mb-2">
              Step 1 · Your GSTIN <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="22AAAAA0000A1Z5"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase().slice(0, 15) })}
              className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#D4AF37] outline-none uppercase font-mono tracking-wider ${
                gstStatus.state === 'verified' ? 'border-emerald-500 bg-emerald-50' :
                gstStatus.state === 'failed' ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
              }`}
              data-testid="waitlist-gst"
              maxLength={15}
              required
              autoFocus
              pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
              title="Enter a valid 15-character GSTIN"
            />
            {gstStatus.state === 'looking' && (
              <p className="mt-1.5 text-xs text-gray-500" data-testid="gst-lookup-status">
                Verifying GSTIN with GSTN records…
              </p>
            )}
            {gstStatus.state === 'verified' && (
              <p
                className="mt-1.5 text-xs text-emerald-700 font-medium"
                data-testid="gst-lookup-status"
              >
                ✓ Verified · {gstStatus.legal_name || 'Business details auto-filled below'}
              </p>
            )}
            {gstStatus.state === 'failed' && (
              <p
                className="mt-1.5 text-xs text-amber-700"
                data-testid="gst-lookup-status"
              >
                Could not auto-verify — you can still continue; we&apos;ll verify manually.
              </p>
            )}
            {gstStatus.state === 'idle' && (
              <p className="mt-1.5 text-xs text-gray-500">
                We&apos;ll auto-fill your business name, city &amp; state from GSTN records.
              </p>
            )}
          </div>

          {/* Step 2 — Business details (revealed once a valid GSTIN is entered) */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              GST_REGEX.test((form.gst_number || '').toUpperCase())
                ? 'opacity-100 max-h-[1000px]'
                : 'opacity-40 pointer-events-none max-h-[1000px]'
            }`}
            aria-hidden={!GST_REGEX.test((form.gst_number || '').toUpperCase())}
          >
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mb-2 mt-2">
              Step 2 · Confirm &amp; complete
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Business Name*"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: titleCase(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-business-name"
            />
            <input
              type="text"
              placeholder="Contact Name*"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: titleCase(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-contact-name"
            />
            <input
              type="email"
              placeholder="Email*"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: lowerEmail(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none lowercase"
              data-testid="waitlist-email"
            />
            <div className="flex">
              <select
                value={form.country_code}
                onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                className="px-2 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-white text-sm focus:outline-none"
                data-testid="waitlist-country-code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="WhatsApp Number*"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })
                }
                className="flex-1 px-3 py-2 rounded-r-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
                data-testid="waitlist-phone"
              />
            </div>
            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: titleCase(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-city"
            />
            <input
              type="text"
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: titleCase(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#D4AF37] outline-none"
              data-testid="waitlist-state"
            />
            </div>
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
