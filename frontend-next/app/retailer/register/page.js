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
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState('');
  // IDSPay GST-registered email ownership proof
  const [idspay, setIdspay] = useState({ configured: false, required: false, ready: false });
  const [gstContact, setGstContact] = useState({ state: 'idle' });
  const [gstOtpCode, setGstOtpCode] = useState('');
  const [gstEmailVerified, setGstEmailVerified] = useState(false);
  const [onboardingSession, setOnboardingSession] = useState('');
  const [gstContactBusy, setGstContactBusy] = useState(false);
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
    alternate_phone: '',
    alternate_email: '',
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
        setGstStatus({ state: 'verified', legal_name: data.legal_name, trade_name: data.trade_name });
        setForm((f) => ({
          ...f,
          business_name: f.business_name || data.business_name || '',
          city: f.city || data.city || '',
          state: f.state || data.state || '',
          pincode: f.pincode || data.pincode || '',
          address: f.address || data.address || '',
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

  // Reset phone verification whenever the number or country code changes
  const requiresOtp = form.country_code === '+91';
  useEffect(() => {
    if (gstEmailVerified) return; // GST-registered contact is authoritative
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpCode('');
    setOtpDevHint('');
  }, [form.phone, form.country_code, gstEmailVerified]);

  // Is the IDSPay GST-contact provider wired on this backend?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/config`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setIdspay({
            configured: Boolean(data.configured),
            required: Boolean(data.required),
            ready: Boolean(data.ready),
          });
        }
      } catch { /* leave as not configured */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Any GSTIN change invalidates a previously verified GST email
  useEffect(() => {
    setGstContact({ state: 'idle' });
    setGstOtpCode('');
    setGstEmailVerified(false);
    setOnboardingSession('');
  }, [form.gst_number]);

  const fetchGstContact = async () => {
    setGstContactBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: (form.gst_number || '').toUpperCase(),
          email: lowerEmail(form.email),
          phone: form.phone,
          country_code: form.country_code,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setGstContact({ state: 'denied', message: data.detail });
        toast.error('Your mobile and email do not match this GSTIN');
        return;
      }
      if (!res.ok) throw new Error(data.detail || 'Could not fetch GST contact details');
      if (data.status === 'email_unavailable') {
        setGstContact({ state: 'email_unavailable', message: data.message, mobile_hint: data.mobile_hint });
        toast.info('No readable email on this GSTIN — our team will verify manually.');
        return;
      }
      setGstContact({
        state: 'otp_sent',
        challenge_id: data.challenge_id,
        email_hint: data.email_hint,
        mobile_hint: data.mobile_hint,
        mismatch: Boolean(data.mismatch),
        email_matches: data.email_matches,
        mobile_matches: data.mobile_matches,
      });
      toast.success(`Code sent to your GST-registered email ${data.email_hint}`);
    } catch (err) {
      toast.error(err.message || 'Could not fetch GST contact details');
    } finally {
      setGstContactBusy(false);
    }
  };

  const verifyGstEmailOtp = async () => {
    if ((gstOtpCode || '').length < 4) {
      toast.error('Enter the code emailed to your GST-registered address');
      return;
    }
    setGstContactBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: gstContact.challenge_id, code: gstOtpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Verification failed');
      setGstEmailVerified(true);
      setOnboardingSession(data.onboarding_session);
      setGstContact((s) => ({ ...s, state: 'verified', email_hint: data.email_hint }));
      // The GST-registered mobile, when IDSPay returns it unmasked, is authoritative.
      if (data.mobile) {
        const digits = String(data.mobile).replace(/\D/g, '').slice(-10);
        setForm((f) => ({ ...f, phone: digits }));
        setPhoneVerified(true);
      }
      toast.success('GST-registered email verified ✓');
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setGstContactBusy(false);
    }
  };

  const sendOtp = async () => {
    const digits = (form.phone || '').replace(/\D/g, '');
    if (requiresOtp && digits.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number first');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: form.country_code, phone: form.phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not send OTP');
      setOtpSent(true);
      if (data.dev_mode && data.dev_code) {
        setOtpDevHint(String(data.dev_code));
        toast.info(`Dev mode — your code is ${data.dev_code}`);
      } else {
        setOtpDevHint('');
        toast.success('OTP sent via SMS to your phone');
      }
    } catch (err) {
      toast.error(err.message || 'Could not send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if ((otpCode || '').length < 4) {
      toast.error('Enter the code sent to your phone');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: form.country_code, phone: form.phone, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Verification failed');
      setPhoneVerified(true);
      toast.success('Phone number verified ✓');
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onFileChange = (e) => {    const f = e.target.files?.[0];
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
    if (requiresOtp && !phoneVerified && !gstEmailVerified) {
      toast.error('Please verify your phone number via the SMS OTP first');
      return;
    }
    if (idspay.required && !gstEmailVerified) {
      toast.error('Please verify the email registered against your GSTIN first');
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
      if (form.alternate_phone) fd.append('alternate_phone', form.alternate_phone);
      if (form.alternate_email) fd.append('alternate_email', lowerEmail(form.alternate_email));
      if (onboardingSession) fd.append('onboarding_session', onboardingSession);
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
            {gstStatus.state === 'verified' && (gstStatus.legal_name || gstStatus.trade_name) && (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="register-gst-chips">
                {gstStatus.legal_name && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300"
                    data-testid="register-legal-name-chip"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="uppercase tracking-wide text-[10px] text-emerald-600">Legal Name</span>
                    {gstStatus.legal_name}
                  </span>
                )}
                {gstStatus.trade_name && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37]/10 text-[#2B3A4A] border border-[#D4AF37]/40"
                    data-testid="register-trade-name-chip"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span className="uppercase tracking-wide text-[10px] text-[#b8912e]">Trade Name</span>
                    {gstStatus.trade_name}
                  </span>
                )}
              </div>
            )}
            {GST_REGEX.test((form.gst_number || '').toUpperCase()) && (
              <p
                className="mt-2 text-xs font-medium text-[#2B3A4A] bg-[#D4AF37]/15 border border-[#D4AF37]/40 rounded-md px-2.5 py-1.5"
                data-testid="register-gst-is-login-id"
              >
                This GSTIN is your login ID — you&apos;ll sign in with{' '}
                <span className="font-mono tracking-wider">{(form.gst_number || '').toUpperCase()}</span>.
                Your email is used only for password recovery and invoices.
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
                readOnly={gstStatus.state === 'verified'}
                title={gstStatus.state === 'verified' ? 'Auto-filled from your GSTIN — locked' : undefined}
                className={`px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none ${gstStatus.state === 'verified' ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
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
                value={gstEmailVerified ? (gstContact.email_hint || form.email) : form.email}
                onChange={(e) => setForm({ ...form, email: lowerEmail(e.target.value) })}
                readOnly={gstEmailVerified}
                title={gstEmailVerified ? 'Verified from your GSTIN records — locked' : undefined}
                className={`px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none lowercase ${gstEmailVerified ? 'bg-gray-100 text-gray-600 cursor-not-allowed font-mono' : ''}`}
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
                  readOnly={gstEmailVerified && phoneVerified}
                  title={gstEmailVerified && phoneVerified ? 'From your GSTIN records — locked' : undefined}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-r-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none ${gstEmailVerified && phoneVerified ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                  data-testid="register-phone"
                />
              </div>

              {/* GST contact match + email-OTP ownership proof (IDSPay) */}
              {idspay.configured && (
                <div
                  className="sm:col-span-2 rounded-lg border border-[#2B3A4A]/25 bg-white/70 p-3"
                  data-testid="register-gst-contact-block"
                >
                  {gstEmailVerified ? (
                    <div data-testid="register-gst-email-verified">
                      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        GST-registered email verified · <span className="font-mono">{gstContact.email_hint}</span>
                      </p>
                      {gstContact.mismatch && (
                        <p className="mt-1.5 text-xs text-amber-700" data-testid="register-gst-mismatch-notice">
                          Note: {gstContact.mobile_matches === false ? 'the mobile number' : 'a detail'} you entered
                          differs from your GST records. We&apos;ve accepted it since you verified the registered
                          email — our team will review the difference.
                        </p>
                      )}
                    </div>
                  ) : gstContact.state === 'denied' ? (
                    <p className="text-xs text-red-700 font-medium" data-testid="register-gst-contact-denied">
                      ✗ {gstContact.message}
                    </p>
                  ) : gstContact.state === 'email_unavailable' ? (
                    <p className="text-xs text-amber-700" data-testid="register-gst-email-unavailable">
                      ⚠ {gstContact.message || 'The email registered against this GSTIN could not be read.'}
                      {' '}You can still submit — our team will verify your business manually.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider">
                          Verify GST contact {idspay.required && <span className="text-red-600">*</span>}
                        </span>
                        <button
                          type="button"
                          onClick={fetchGstContact}
                          disabled={gstContactBusy || !form.email || !form.phone}
                          title={!form.email || !form.phone ? 'Enter your email and phone first' : undefined}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                          data-testid="register-gst-contact-send"
                        >
                          {gstContactBusy
                            ? 'Working…'
                            : gstContact.state === 'otp_sent'
                              ? 'Resend code'
                              : 'Match & send code'}
                        </button>
                      </div>
                      {gstContact.state === 'otp_sent' ? (
                        <>
                          <div className="flex gap-2" data-testid="register-gst-otp-row">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Enter 6-digit code"
                              value={gstOtpCode}
                              onChange={(e) => setGstOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] tracking-widest font-mono focus:border-[#D4AF37] outline-none"
                              data-testid="register-gst-otp-code"
                            />
                            <button
                              type="button"
                              onClick={verifyGstEmailOtp}
                              disabled={gstContactBusy || gstOtpCode.length < 4}
                              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#D4AF37] text-white hover:opacity-90 disabled:opacity-50 transition"
                              data-testid="register-gst-otp-verify"
                            >
                              {gstContactBusy ? 'Verifying…' : 'Verify'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Code emailed to <span className="font-mono">{gstContact.email_hint}</span> — the address on
                            record against your GSTIN. It expires in 10 minutes.
                          </p>
                          {gstContact.mismatch && (
                            <p className="text-xs text-amber-700" data-testid="register-gst-mismatch-notice">
                              Heads up: some details you entered differ from your GST records.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">
                          We check your email and mobile against the contact registered on your GSTIN, then send a
                          code to that registered email to confirm you own the business.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Inline phone OTP verification (mandatory for +91) */}
              <div className="sm:col-span-2 rounded-lg p-3 border border-[#D4AF37]/40 bg-white/60" data-testid="register-otp-block">
                {gstEmailVerified ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700" data-testid="register-phone-verified">
                    <CheckCircle2 className="w-4 h-4" /> Verified via your GST-registered contact — no SMS needed
                  </p>
                ) : phoneVerified ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700" data-testid="register-phone-verified">
                    <CheckCircle2 className="w-4 h-4" /> Phone number verified
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider">
                        Verify phone {requiresOtp && <span className="text-red-600">*</span>}
                      </span>
                      <button
                        type="button"
                        onClick={sendOtp}
                        disabled={sendingOtp || !form.phone}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                        data-testid="register-send-otp"
                      >
                        {sendingOtp ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                    {otpSent && (
                      <div className="flex gap-2" data-testid="register-otp-input-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter 6-digit code"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] tracking-widest font-mono focus:border-[#D4AF37] outline-none"
                          data-testid="register-otp-code"
                        />
                        <button
                          type="button"
                          onClick={verifyOtp}
                          disabled={verifyingOtp || otpCode.length < 4}
                          className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#D4AF37] text-white hover:opacity-90 disabled:opacity-50 transition"
                          data-testid="register-verify-otp"
                        >
                          {verifyingOtp ? 'Verifying…' : 'Verify'}
                        </button>
                      </div>
                    )}
                    {otpDevHint && (
                      <p className="text-xs text-amber-700" data-testid="register-otp-dev-hint">
                        Dev mode (SMS not configured): use code <strong>{otpDevHint}</strong>
                      </p>
                    )}
                    {otpSent && !otpDevHint && (
                      <p className="text-xs text-gray-500">Enter the code we texted to {form.country_code} {form.phone}</p>
                    )}
                  </div>
                )}
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
              <input
                type="tel"
                placeholder="Alternate Mobile (optional)"
                value={form.alternate_phone}
                onChange={(e) => setForm({ ...form, alternate_phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none"
                data-testid="register-alternate-phone"
              />
              <input
                type="email"
                placeholder="Alternate Email (optional)"
                value={form.alternate_email}
                onChange={(e) => setForm({ ...form, alternate_email: lowerEmail(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none lowercase"
                data-testid="register-alternate-email"
              />
              <p className="sm:col-span-2 text-[11px] text-gray-500 -mt-1" data-testid="register-alternate-note">
                Add an alternate mobile & email if the owner and the day-to-day manager are different people.
              </p>
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
            disabled={submitting || (requiresOtp && !phoneVerified)}
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
              Your GSTIN is auto-verified against GSTN records.
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
