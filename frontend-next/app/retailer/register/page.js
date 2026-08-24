'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Upload, CheckCircle2, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import {
  titleCase,
  lowerEmail,
  COUNTRY_CODES,
  GST_REGEX,
  normalizeGstInput,
} from '../../../lib/formHelpers';
import BRAND from '../../../lib/brand.config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const MAX_CERT_MB = 8;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function RetailerRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useRetailerAuth();
  const [submitting, setSubmitting] = useState(false);
  const [gstStatus, setGstStatus] = useState({ state: 'idle' });
  const [certFile, setCertFile] = useState(null);
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    country_code: '+91',
    phone: '',
    gst_number: '',
    city: '',
    state: '',
    address: '',
    pincode: '',
    password: '',
    confirm_password: '',
  });

  // If already logged in, bounce
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/retailer/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  // Live GST verify (same as waitlist)
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
          setGstStatus({
            state: 'failed',
            error: data?.error || 'GST not verified',
            provider_down: Boolean(data?.provider_down),
          });
          if (data?.state) {
            setForm((f) => ({ ...f, state: f.state || data.state }));
          }
          return;
        }
        setGstStatus({ state: 'verified', legal_name: data.legal_name });
        setForm((f) => ({
          ...f,
          business_name: f.business_name || data.business_name || '',
          city: f.city || data.city || '',
          state: f.state || data.state || '',
        }));
      } catch {
        if (!cancelled) setGstStatus({ state: 'failed', error: 'Lookup unavailable', provider_down: true });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.gst_number]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      toast.error('GST certificate must be PDF, JPG, PNG or WebP');
      e.target.value = '';
      return;
    }
    if (f.size > MAX_CERT_MB * 1024 * 1024) {
      toast.error(`GST certificate must be under ${MAX_CERT_MB} MB`);
      e.target.value = '';
      return;
    }
    setCertFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    // Field validation
    if (!GST_REGEX.test((form.gst_number || '').toUpperCase())) {
      toast.error('Please enter a valid 15-character GSTIN');
      return;
    }
    if (gstStatus.state === 'failed' && !gstStatus.provider_down) {
      toast.error('GSTIN could not be verified with GSTN records. Please double-check.');
      return;
    }
    if (gstStatus.state !== 'verified' && !gstStatus.provider_down) {
      toast.error('Please wait for GSTIN verification to complete.');
      return;
    }
    if (!form.business_name || !form.contact_name || !form.email || !form.phone) {
      toast.error('Please fill business, contact, email and phone');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (!certFile) {
      toast.error('Please upload your GST certificate (PDF or image)');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('business_name', form.business_name);
      fd.append('contact_name', form.contact_name);
      fd.append('email', lowerEmail(form.email));
      fd.append('country_code', form.country_code);
      fd.append('phone', form.phone);
      fd.append('gst_number', (form.gst_number || '').toUpperCase());
      fd.append('password', form.password);
      if (form.city) fd.append('city', form.city);
      if (form.state) fd.append('state', form.state);
      if (form.address) fd.append('address', form.address);
      if (form.pincode) fd.append('pincode', form.pincode);
      fd.append('gst_certificate', certFile);

      const res = await fetch(`${API_URL}/api/retailer-auth/register`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const ctype = res.headers.get('content-type') || '';
      const data = ctype.includes('application/json')
        ? await res.json().catch(() => ({}))
        : { detail: (await res.text().catch(() => '')).slice(0, 200) };
      if (!res.ok) {
        throw new Error(data.detail || `Registration failed (HTTP ${res.status})`);
      }
      // Persist session token & refresh auth state, then land on pending
      if (data.token && typeof window !== 'undefined') {
        try { localStorage.setItem('retailer_token', data.token); } catch { /* ignore */ }
      }
      toast.success('Registration submitted — your account is under review');
      await checkAuth();
      router.replace('/retailer/pending');
    } catch (err) {
      const msg = typeof err.message === 'string' ? err.message : 'Registration failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A]">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A] py-10" data-testid="retailer-register-page">
      <div className="w-full max-w-2xl p-7 rounded-2xl shadow-2xl bg-[#F5F0E8]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-[#D4AF37]">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Retailer Registration</h1>
          <p className="text-gray-600 text-sm mt-1">
            Register with your GSTIN and certificate — you&apos;ll be able to
            sign in immediately and view your dashboard once our team
            approves your KYC.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" data-testid="retailer-register-form">
          {/* Step 1 — GST */}
          <div className="rounded-lg p-4 border-2 border-[#D4AF37]/40 bg-white/60">
            <label className="block text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mb-2">
              Step 1 · Your GSTIN <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="22AAAAA0000A1Z5"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: normalizeGstInput(e.target.value) })}
              className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#D4AF37] outline-none uppercase font-mono tracking-wider bg-white text-[#2B3A4A] ${
                gstStatus.state === 'verified' ? 'border-emerald-500 bg-emerald-50' :
                gstStatus.state === 'failed' ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              data-testid="register-gst"
              maxLength={15}
              required
              autoFocus
            />
            {gstStatus.state === 'looking' && (
              <p className="mt-1.5 text-xs text-gray-500" data-testid="register-gst-status">Verifying GSTIN…</p>
            )}
            {gstStatus.state === 'verified' && (
              <p className="mt-1.5 text-xs text-emerald-700 font-medium" data-testid="register-gst-status">
                ✓ Verified · {gstStatus.legal_name || 'Business details auto-filled below'}
              </p>
            )}
            {gstStatus.state === 'failed' && gstStatus.provider_down && (
              <p className="mt-1.5 text-xs text-amber-700" data-testid="register-gst-status">
                ⚠ Verification temporarily unavailable — you can still submit; we&apos;ll re-verify shortly.
              </p>
            )}
            {gstStatus.state === 'failed' && !gstStatus.provider_down && (
              <p className="mt-1.5 text-xs text-red-700 font-medium" data-testid="register-gst-status">
                ✗ Could not verify this GSTIN with GSTN records. Please double-check the number.
              </p>
            )}
          </div>

          {/* Step 2 — Details */}
          <div
            className={`transition-opacity duration-300 space-y-3 ${
              GST_REGEX.test((form.gst_number || '').toUpperCase())
                ? 'opacity-100'
                : 'opacity-40 pointer-events-none'
            }`}
          >
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-2">
              Step 2 · Business & contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Business Name*"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: titleCase(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-business-name"
              />
              <input
                type="text"
                placeholder="Contact Name*"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: titleCase(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-contact-name"
              />
              <input
                type="email"
                placeholder="Email*"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: lowerEmail(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none lowercase"
                data-testid="register-email"
              />
              <div className="flex">
                <select
                  value={form.country_code}
                  onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                  className="px-2 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-white text-[#2B3A4A] text-sm focus:outline-none"
                  data-testid="register-country-code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone*"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                  className="flex-1 px-3 py-2 rounded-r-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                  data-testid="register-phone"
                />
              </div>
              <input
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: titleCase(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-city"
              />
              <input
                type="text"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: titleCase(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-state"
              />
              <input
                type="text"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-pincode"
              />
              <input
                type="text"
                placeholder="Address (optional)"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none sm:col-span-1"
                data-testid="register-address"
              />
            </div>

            {/* Step 3 — Password */}
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-3">
              Step 3 · Choose a password
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                placeholder="Password (min 8 chars)*"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-password"
                minLength={8}
              />
              <input
                type="password"
                placeholder="Confirm Password*"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-confirm-password"
                minLength={8}
              />
            </div>

            {/* Step 4 — GST cert upload */}
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-3">
              Step 4 · Upload GST certificate <span className="text-red-600">*</span>
            </p>
            {certFile ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50" data-testid="register-cert-selected">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#2B3A4A] truncate">{certFile.name}</p>
                    <p className="text-xs text-gray-600">{(certFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCertFile(null)}
                  className="p-1 rounded hover:bg-emerald-100"
                  data-testid="register-cert-remove"
                >
                  <X className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-lg border-2 border-dashed border-gray-400 hover:border-[#D4AF37] hover:bg-white/60 cursor-pointer transition" data-testid="register-cert-dropzone">
                <Upload className="w-6 h-6 text-[#2B3A4A]" />
                <span className="text-sm font-medium text-[#2B3A4A]">Click to upload GST certificate</span>
                <span className="text-xs text-gray-500">PDF, JPG, PNG or WebP · up to {MAX_CERT_MB} MB</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={onFileChange}
                  className="hidden"
                  data-testid="register-cert-input"
                />
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#2B3A4A] text-white font-semibold hover:bg-[#1a252f] disabled:opacity-50 transition"
            data-testid="register-submit"
          >
            {submitting ? 'Submitting registration…' : 'Register & go to Under Review'}
          </button>

          <div className="text-center space-y-2 text-sm">
            <p className="text-gray-600">
              Already registered?{' '}
              <Link href="/retailer/login" className="text-[#D4AF37] font-medium hover:underline" data-testid="register-login-link">
                Sign in
              </Link>
            </p>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              Your GSTIN is auto-verified against GSTN records via Appyflow.
            </p>
            <Link href="/" className="inline-block text-xs text-[#2B3A4A] underline hover:text-[#D4AF37] mt-1">
              Back to {BRAND.name}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
