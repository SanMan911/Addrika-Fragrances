'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Upload, CheckCircle2, FileText, X, Clock, AlertTriangle } from 'lucide-react';
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

const INPUT = 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none';

export default function RetailerRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useRetailerAuth();
  const [submitting, setSubmitting] = useState(false);
  const [gstStatus, setGstStatus] = useState({ state: 'idle' });
  const [certFile, setCertFile] = useState(null);
  const [deferCert, setDeferCert] = useState(false);

  // GST-registered contact confirmation → email OTP
  const [preview, setPreview] = useState({ state: 'idle' });
  const [contactMode, setContactMode] = useState(null); // confirm | update_mobile | fallback
  const [otp, setOtp] = useState({ state: 'idle' });
  const [otpCode, setOtpCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [onboardingSession, setOnboardingSession] = useState('');
  const [busy, setBusy] = useState(false);

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

  const gstValid = GST_REGEX.test((form.gst_number || '').toUpperCase());
  // The GST record could not be read → the applicant types their own contact
  // and we verify ownership of that email instead.
  const needsTypedContact = preview.state === 'unavailable' || preview.state === 'email_unavailable';
  // The record's mobile was unreadable (masked) → we still need a number from them.
  const needsTypedMobile =
    (preview.state === 'available' && !preview.mobile_usable) || contactMode === 'update_mobile';

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/retailer/dashboard');
  }, [isLoading, isAuthenticated, router]);

  // Live GSTIN verification + autofill (Deepvue)
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
        const res = await fetch(`${API_URL}/api/retailer-auth/waitlist/gst-lookup/${gst}`);
        if (cancelled) return;
        const data = await res.json();
        if (!data || data.verified === false) {
          setGstStatus({
            state: 'failed',
            error: data?.error || 'GST not verified',
            provider_down: Boolean(data?.provider_down),
          });
          if (data?.state) setForm((f) => ({ ...f, state: f.state || data.state }));
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

  // Any GSTIN change invalidates everything downstream
  useEffect(() => {
    setPreview({ state: 'idle' });
    setContactMode(null);
    setOtp({ state: 'idle' });
    setOtpCode('');
    setEmailVerified(false);
    setOnboardingSession('');
  }, [form.gst_number]);

  const loadPreview = useCallback(async (gst) => {
    setPreview({ state: 'loading' });
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin: gst }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setPreview({ state: 'already_registered', message: data.detail });
        return;
      }
      if (!res.ok) {
        setPreview({ state: 'unavailable', reason: 'provider_unavailable' });
        return;
      }
      if (data.status === 'available') {
        setPreview({
          state: 'available',
          email_hint: data.email_hint,
          mobile_hint: data.mobile_hint,
          mobile_usable: Boolean(data.mobile_usable),
        });
        return;
      }
      if (data.status === 'email_unavailable') {
        setPreview({ state: 'email_unavailable', mobile_hint: data.mobile_hint });
        return;
      }
      setPreview({ state: 'unavailable', reason: data.reason });
    } catch {
      setPreview({ state: 'unavailable', reason: 'provider_unavailable' });
    }
  }, []);

  // Once the GSTIN is verified, fetch the masked contact on record
  useEffect(() => {
    if (gstStatus.state !== 'verified' && !(gstStatus.state === 'failed' && gstStatus.provider_down)) return;
    if (!gstValid || preview.state !== 'idle') return;
    loadPreview((form.gst_number || '').toUpperCase());
  }, [gstStatus.state, gstStatus.provider_down, gstValid, preview.state, form.gst_number, loadPreview]);

  const sendOtp = async (mode) => {
    const digits = (form.phone || '').replace(/\D/g, '');
    if (mode === 'update_mobile' && digits.length !== 10) {
      toast.error('Enter your new 10-digit mobile number');
      return;
    }
    if (mode === 'fallback' && (!form.email || digits.length < 10)) {
      toast.error('Enter your email address and a 10-digit mobile number');
      return;
    }
    if (mode === 'confirm' && needsTypedMobile && digits.length !== 10) {
      toast.error('Enter your 10-digit mobile number');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gstin: (form.gst_number || '').toUpperCase(),
          mode,
          email: lowerEmail(form.email) || null,
          phone: digits || null,
          country_code: form.country_code,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setOtp({ state: 'denied', message: data.detail });
        toast.error('Your mobile and email do not match this GSTIN');
        return;
      }
      if (!res.ok) throw new Error(data.detail || 'Could not send the verification code');
      setContactMode(mode);
      setOtp({
        state: 'sent',
        challenge_id: data.challenge_id,
        target_hint: data.target_hint,
        target: data.target,
        mismatch: Boolean(data.mismatch),
      });
      toast.success(`Code sent to ${data.target_hint}`);
    } catch (err) {
      toast.error(err.message || 'Could not send the verification code');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if ((otpCode || '').length < 4) {
      toast.error('Enter the code we emailed you');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/gst-contact/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: otp.challenge_id, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Verification failed');
      setEmailVerified(true);
      setOnboardingSession(data.onboarding_session);
      setOtp((s) => ({ ...s, state: 'verified', target_hint: data.email_hint || s.target_hint }));
      if (data.mobile && contactMode === 'confirm') {
        setForm((f) => ({ ...f, phone: String(data.mobile).replace(/\D/g, '').slice(-10) }));
      }
      toast.success('Email verified ✓');
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

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
    setDeferCert(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!gstValid) {
      toast.error('Please enter a valid 15-character GSTIN');
      return;
    }
    if (gstStatus.state === 'failed' && !gstStatus.provider_down) {
      toast.error('GSTIN could not be verified with GSTN records. Please double-check.');
      return;
    }
    if (!emailVerified) {
      toast.error('Please verify your email with the code we sent');
      return;
    }
    if (!form.business_name || !form.contact_name || !form.phone) {
      toast.error('Please fill business name, contact name and mobile number');
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
    if (!certFile && !deferCert) {
      toast.error('Upload your GST certificate, or tick "submit it later"');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('business_name', form.business_name);
      fd.append('contact_name', form.contact_name);
      fd.append('email', lowerEmail(form.email) || 'pending@aarohmm.invalid');
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
      fd.append('onboarding_session', onboardingSession);
      if (certFile) fd.append('gst_certificate', certFile);
      else fd.append('defer_gst_certificate', 'true');

      const res = await fetch(`${API_URL}/api/retailer-auth/register`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const ctype = res.headers.get('content-type') || '';
      const data = ctype.includes('application/json')
        ? await res.json().catch(() => ({}))
        : { detail: (await res.text().catch(() => '')).slice(0, 200) };
      if (!res.ok) throw new Error(data.detail || `Registration failed (HTTP ${res.status})`);

      if (data.token && typeof window !== 'undefined') {
        try { localStorage.setItem('retailer_token', data.token); } catch { /* ignore */ }
      }
      toast.success(
        data.auto_onboarded
          ? 'Verified against your GST records — your account is active!'
          : 'Registration submitted — our team will verify you shortly'
      );
      await checkAuth();
      router.replace(data.auto_onboarded ? '/retailer/dashboard' : '/retailer/pending');
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Registration failed');
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

  const mobileInput = (testid, label) => (
    <div>
      <label className="block text-xs font-medium text-[#2B3A4A] mb-1">{label}</label>
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
          placeholder="10-digit mobile number"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
          className={`${INPUT} flex-1 min-w-0 rounded-l-none`}
          data-testid={testid}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A] py-10" data-testid="retailer-register-page">
      <div className="w-full max-w-2xl p-7 rounded-2xl shadow-2xl bg-[#F5F0E8]">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-[#D4AF37]">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Become a Brand Partner</h1>
          <p className="text-gray-600 text-sm mt-1">
            Enter your GSTIN — we pull your details from the GST registry and confirm it&apos;s
            really you with a code to your registered email. No SMS needed.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" data-testid="retailer-register-form">
          {/* Step 1 — GSTIN */}
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
              <>
                <p className="mt-1.5 text-xs text-emerald-700 font-medium" data-testid="register-gst-status">
                  ✓ Verified · {gstStatus.legal_name || 'Business details auto-filled below'}
                </p>
                {(gstStatus.legal_name || gstStatus.trade_name) && (
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
              </>
            )}
            {gstValid && (
              <p
                className="mt-2 text-xs font-medium text-[#2B3A4A] bg-[#D4AF37]/15 border border-[#D4AF37]/40 rounded-md px-2.5 py-1.5"
                data-testid="register-gst-is-login-id"
              >
                This GSTIN is your login ID — you&apos;ll sign in with{' '}
                <span className="font-mono tracking-wider">{(form.gst_number || '').toUpperCase()}</span>{' '}
                on the website and in the Aarohmm app.
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

          {/* Step 2 — confirm the contact registered on the GSTIN */}
          <div
            className={`transition-opacity duration-300 ${gstValid ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
          >
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mb-2">
              Step 2 · Confirm your GST-registered contact <span className="text-red-600">*</span>
            </p>
            <div className="rounded-lg border-2 border-[#2B3A4A]/20 bg-white/70 p-4" data-testid="register-gst-contact-block">
              {emailVerified ? (
                <div data-testid="register-gst-email-verified">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Email verified · <span className="font-mono">{otp.target_hint}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Mobile on file: <span className="font-mono">{form.country_code} {form.phone || '—'}</span>
                  </p>
                  {otp.mismatch && (
                    <p className="mt-2 text-xs text-amber-700" data-testid="register-gst-mismatch-notice">
                      You told us your mobile number has changed. We&apos;ve accepted it because you
                      verified the registered email — our team will review the difference before
                      activating your account.
                    </p>
                  )}
                </div>
              ) : otp.state === 'denied' ? (
                <p className="text-xs text-red-700 font-medium" data-testid="register-gst-contact-denied">
                  ✗ {otp.message}
                </p>
              ) : otp.state === 'sent' ? (
                <div className="space-y-2" data-testid="register-gst-otp-block">
                  <p className="text-sm text-[#2B3A4A]">
                    We emailed a 6-digit code to <span className="font-mono font-semibold">{otp.target_hint}</span>.
                    It expires in 10 minutes.
                  </p>
                  <div className="flex gap-2" data-testid="register-gst-otp-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`${INPUT} flex-1 min-w-0 tracking-widest font-mono`}
                      data-testid="register-gst-otp-code"
                    />
                    <button
                      type="button"
                      onClick={verifyOtp}
                      disabled={busy || otpCode.length < 4}
                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#D4AF37] text-white hover:opacity-90 disabled:opacity-50 transition"
                      data-testid="register-gst-otp-verify"
                    >
                      {busy ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendOtp(contactMode)}
                    disabled={busy}
                    className="text-xs text-[#2B3A4A] underline disabled:opacity-50"
                    data-testid="register-gst-otp-resend"
                  >
                    Resend code
                  </button>
                </div>
              ) : preview.state === 'loading' ? (
                <p className="text-xs text-gray-500" data-testid="register-gst-preview-loading">
                  Fetching the contact registered against your GSTIN…
                </p>
              ) : preview.state === 'already_registered' ? (
                <p className="text-xs text-red-700 font-medium" data-testid="register-gst-already-registered">
                  {preview.message || 'An account already exists for this GSTIN. Please sign in instead.'}
                </p>
              ) : preview.state === 'available' ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    These are the contact details registered against your GSTIN (partly hidden for
                    your privacy):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="register-gst-masked-details">
                    <div className="rounded-lg bg-[#2B3A4A]/5 border border-[#2B3A4A]/15 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Registered email</p>
                      <p className="font-mono text-sm text-[#2B3A4A]" data-testid="register-gst-masked-email">
                        {preview.email_hint}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#2B3A4A]/5 border border-[#2B3A4A]/15 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Registered mobile</p>
                      <p className="font-mono text-sm text-[#2B3A4A]" data-testid="register-gst-masked-mobile">
                        {preview.mobile_hint || 'Not readable'}
                      </p>
                    </div>
                  </div>

                  {contactMode === 'update_mobile' ? (
                    <div className="space-y-2 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/10 p-3">
                      {mobileInput('register-gst-new-mobile', 'Your current mobile number')}
                      <button
                        type="button"
                        onClick={() => sendOtp('update_mobile')}
                        disabled={busy}
                        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                        data-testid="register-gst-update-mobile-send"
                      >
                        {busy ? 'Sending…' : 'Update my mobile number & send the code to my registered email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactMode(null)}
                        className="text-xs text-[#2B3A4A] underline"
                        data-testid="register-gst-cancel-update"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : !preview.mobile_usable ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700" data-testid="register-gst-mobile-unreadable">
                        ⚠ The mobile number on your GST record couldn&apos;t be read. Please enter it below.
                      </p>
                      {mobileInput('register-gst-new-mobile', 'Your mobile number')}
                      <button
                        type="button"
                        onClick={() => sendOtp('confirm')}
                        disabled={busy}
                        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                        data-testid="register-gst-confirm-correct"
                      >
                        {busy ? 'Sending…' : 'Send the code to my registered email'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => sendOtp('confirm')}
                        disabled={busy}
                        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                        data-testid="register-gst-confirm-correct"
                      >
                        {busy ? 'Sending…' : 'Yes, my details are correct — send the OTP to my email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactMode('update_mobile')}
                        className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg border-2 border-[#2B3A4A]/30 text-[#2B3A4A] hover:bg-white transition"
                        data-testid="register-gst-mobile-changed"
                      >
                        No, my mobile number has changed
                      </button>
                    </div>
                  )}
                </div>
              ) : needsTypedContact ? (
                <div className="space-y-3" data-testid="register-gst-contact-fallback">
                  <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      We couldn&apos;t read the contact registered against this GSTIN right now.
                      Enter your mobile and email and we&apos;ll verify you by email instead — our
                      team will confirm your business manually before activating your account.
                    </span>
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-[#2B3A4A] mb-1">Your email address</label>
                    <input
                      type="email"
                      placeholder="you@yourbusiness.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: lowerEmail(e.target.value) })}
                      className={`${INPUT} w-full lowercase`}
                      data-testid="register-email"
                    />
                  </div>
                  {mobileInput('register-phone', 'Your mobile number')}
                  <button
                    type="button"
                    onClick={() => sendOtp('fallback')}
                    disabled={busy}
                    className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1a252f] disabled:opacity-50 transition"
                    data-testid="register-gst-fallback-send"
                  >
                    {busy ? 'Sending…' : 'Send a verification code to my email'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Enter a valid GSTIN above to continue.</p>
              )}
            </div>
          </div>

          {/* Step 3 — business details */}
          <div
            className={`transition-opacity duration-300 space-y-3 ${emailVerified ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
          >
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-2">
              Step 3 · Business details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Business Name*"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: titleCase(e.target.value) })}
                readOnly={gstStatus.state === 'verified'}
                title={gstStatus.state === 'verified' ? 'Auto-filled from your GSTIN — locked' : undefined}
                className={`${INPUT} ${gstStatus.state === 'verified' ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                data-testid="register-business-name"
              />
              <input
                type="text"
                placeholder="Contact Name*"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: titleCase(e.target.value) })}
                className={INPUT}
                data-testid="register-contact-name"
              />
              <input
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: titleCase(e.target.value) })}
                className={INPUT}
                data-testid="register-city"
              />
              <input
                type="text"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: titleCase(e.target.value) })}
                className={INPUT}
                data-testid="register-state"
              />
              <input
                type="text"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className={INPUT}
                data-testid="register-pincode"
              />
              <input
                type="text"
                placeholder="Shop address (shown on our store locator)"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={INPUT}
                data-testid="register-address"
              />
              <input
                type="tel"
                placeholder="Alternate Mobile (optional)"
                value={form.alternate_phone}
                onChange={(e) => setForm({ ...form, alternate_phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                className={INPUT}
                data-testid="register-alternate-phone"
              />
              <input
                type="email"
                placeholder="Alternate Email (optional)"
                value={form.alternate_email}
                onChange={(e) => setForm({ ...form, alternate_email: lowerEmail(e.target.value) })}
                className={`${INPUT} lowercase`}
                data-testid="register-alternate-email"
              />
              <p className="sm:col-span-2 text-[11px] text-gray-500 -mt-1" data-testid="register-alternate-note">
                Add an alternate mobile & email if the owner and the day-to-day manager are different people.
              </p>
            </div>

            {/* Step 4 — password */}
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-3">
              Step 4 · Choose a password
            </p>
            <p className="text-[11px] text-gray-500 -mt-2">
              You&apos;ll use this same password on the website and in the Aarohmm mobile app.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                placeholder="Password (min 8 chars)*"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={INPUT}
                data-testid="register-password"
                minLength={8}
              />
              <input
                type="password"
                placeholder="Confirm Password*"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className={INPUT}
                data-testid="register-confirm-password"
                minLength={8}
              />
            </div>

            {/* Step 5 — GST certificate (uploadable later) */}
            <p className="text-xs font-semibold text-[#2B3A4A] uppercase tracking-wider mt-3">
              Step 5 · GST certificate
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
              <>
                <label
                  className={`flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-lg border-2 border-dashed transition ${
                    deferCert
                      ? 'border-gray-300 opacity-50 cursor-not-allowed'
                      : 'border-gray-400 hover:border-[#D4AF37] hover:bg-white/60 cursor-pointer'
                  }`}
                  data-testid="register-cert-dropzone"
                >
                  <Upload className="w-6 h-6 text-[#2B3A4A]" />
                  <span className="text-sm font-medium text-[#2B3A4A]">Click to upload GST certificate</span>
                  <span className="text-xs text-gray-500">PDF, JPG, PNG or WebP · up to {MAX_CERT_MB} MB</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={onFileChange}
                    disabled={deferCert}
                    className="hidden"
                    data-testid="register-cert-input"
                  />
                </label>
                <div
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-[#2B3A4A]/20 bg-white/70"
                  data-testid="register-cert-skip-row"
                >
                  <input
                    id="register-cert-skip"
                    type="checkbox"
                    checked={deferCert}
                    onChange={(e) => setDeferCert(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer"
                    data-testid="register-cert-skip"
                  />
                  <label htmlFor="register-cert-skip" className="text-xs text-[#2B3A4A] cursor-pointer">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Skip for now — I&apos;ll submit it later and wait for approval
                    </span>
                    <span className="block text-gray-600 mt-0.5">
                      Our team is notified straight away and will email you a reminder. Your account
                      stays under review until the certificate is in.
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !emailVerified}
            className="w-full py-3 rounded-xl bg-[#2B3A4A] text-white font-semibold hover:bg-[#1a252f] disabled:opacity-50 transition"
            data-testid="register-submit"
          >
            {submitting
              ? 'Submitting registration…'
              : deferCert
                ? 'Submit & wait for approval'
                : 'Complete registration'}
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
              Verified Brand Partners appear on our public store locator.
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
