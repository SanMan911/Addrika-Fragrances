'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, Mail, Loader2, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const titleCase = (s) =>
  (s || '')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

/**
 * GST-first partnership inquiry modal.
 *
 *   Step 1 — Identity proof: GSTIN only. Live Appyflow lookup auto-fills
 *            legal name + state + city + pincode.
 *   Step 2 — Confirms business details (locked: legal name, state, pincode
 *            from GST registry) + collects contact info. Backend re-verifies
 *            and rejects mismatched legal_name / state / pincode to prevent
 *            anyone submitting someone else's GSTIN.
 *
 *   If the user is GST-unregistered or Appyflow is offline, we fall back to
 *   a manual form (Step 2 unlocks but everything is editable; admin reviews
 *   manually).
 */
export default function RetailerPartnershipModal({ open, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [gstStatus, setGstStatus] = useState({ state: 'idle' });
  // gstRecord captures Appyflow's verified record for read-only display
  const [gstRecord, setGstRecord] = useState(null);
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    country_code: '+91',
    phone: '',
    gst_number: '',
    legal_name: '',
    city: '',
    state: '',
    pincode: '',
    message: '',
  });

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setSubmitting(false);
      setStep(1);
      setGstStatus({ state: 'idle' });
      setGstRecord(null);
      setForm({
        business_name: '',
        contact_name: '',
        email: '',
        country_code: '+91',
        phone: '',
        gst_number: '',
        legal_name: '',
        city: '',
        state: '',
        pincode: '',
        message: '',
      });
    }
  }, [open]);

  // Debounced Appyflow lookup the moment a complete GSTIN is typed
  useEffect(() => {
    const gst = (form.gst_number || '').toUpperCase();
    if (!GST_REGEX.test(gst)) {
      if (gstStatus.state !== 'idle') {
        setGstStatus({ state: 'idle' });
        setGstRecord(null);
      }
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
          setGstRecord(null);
          // Soft-fill state from GSTIN prefix even when verification fails
          if (data?.state) {
            setForm((f) => ({ ...f, state: f.state || data.state }));
          }
          return;
        }
        setGstStatus({ state: 'verified', legal_name: data.legal_name });
        setGstRecord(data);
        // Auto-fill — these values come from the GST registry and become locked
        setForm((f) => ({
          ...f,
          business_name: f.business_name || data.business_name || '',
          legal_name: data.legal_name || f.legal_name || '',
          city: f.city || data.city || '',
          state: data.state || f.state || '',
          pincode: data.pincode || f.pincode || '',
        }));
      } catch {
        if (!cancelled) {
          setGstStatus({ state: 'failed', error: 'Lookup unavailable' });
          setGstRecord(null);
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.gst_number]);

  const canProceedToStep2 = useMemo(() => {
    return GST_REGEX.test((form.gst_number || '').toUpperCase()) && gstStatus.state !== 'looking';
  }, [form.gst_number, gstStatus.state]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name || !form.contact_name || !form.email || !form.phone) {
      toast.error('Please fill business, contact, email & WhatsApp');
      return;
    }
    if (!GST_REGEX.test((form.gst_number || '').toUpperCase())) {
      toast.error('Please enter a valid 15-character GSTIN');
      return;
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      toast.error('Pincode must be 6 digits');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      payload.email = (payload.email || '').toLowerCase().trim();
      payload.gst_number = (payload.gst_number || '').toUpperCase();
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] == null) delete payload[k];
      });
      const res = await fetch(`${API_URL}/api/retailer-auth/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail?.[0]?.msg || err.detail || 'Submission failed';
        throw new Error(typeof detail === 'string' ? detail : 'Submission failed');
      }
      setSubmitted(true);
      toast.success("Thanks — we'll be in touch within 24 hours.");
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputBase =
    'px-3 py-2 rounded-lg border focus:border-[#D4AF37] outline-none bg-white text-[#2B3A4A] placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500';

  // GST-locked fields: when the lookup verifies a real GST record, those
  // fields become read-only so the user can't override them with spoof data.
  const isVerified = gstStatus.state === 'verified' && !!gstRecord;
  const lockField = (field) => isVerified && !!gstRecord?.[field];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      data-testid="partnership-modal"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-[#F5EFE0] shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/5 text-[#2B3A4A] z-10"
          data-testid="partnership-modal-close"
        >
          <X size={20} />
        </button>

        {!submitted ? (
          <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-4">
            <div className="text-center mb-2">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
                style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)' }}
              >
                <Mail className="w-6 h-6 text-[#1a1a2e]" />
              </div>
              <h2
                className="text-2xl font-bold text-[#2B3A4A]"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Become an Addrika Retailer
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {step === 1
                  ? 'Start with your GSTIN — we\'ll auto-fill the rest.'
                  : 'Confirm your details and contact info.'}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
              <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-[#D4AF37] text-[#1a1a2e] font-semibold' : 'bg-gray-200'}`}>
                1 · GST Verification
              </span>
              <ArrowRight size={12} className="text-gray-400" />
              <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-[#D4AF37] text-[#1a1a2e] font-semibold' : 'bg-gray-200'}`}>
                2 · Business & Contact
              </span>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2B3A4A] mb-1">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAACR5055K1Z7"
                    value={form.gst_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gst_number: e.target.value.toUpperCase().slice(0, 15),
                      })
                    }
                    className={`${inputBase} w-full uppercase font-mono text-lg tracking-wider ${
                      gstStatus.state === 'verified'
                        ? 'border-emerald-500'
                        : gstStatus.state === 'failed'
                        ? 'border-amber-400'
                        : 'border-gray-300'
                    }`}
                    data-testid="partnership-gst"
                    maxLength={15}
                    autoFocus
                    required
                    pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                    title="Enter a valid 15-character GSTIN"
                  />
                  {gstStatus.state === 'looking' && (
                    <p
                      className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1"
                      data-testid="partnership-gst-status"
                    >
                      <Loader2 size={12} className="animate-spin" /> Verifying GSTIN…
                    </p>
                  )}
                  {gstStatus.state === 'verified' && gstRecord && (
                    <div
                      className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                      data-testid="partnership-gst-status"
                    >
                      <p className="text-sm font-semibold text-emerald-800 inline-flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified by GST Registry
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        <strong>{gstRecord.legal_name}</strong>
                        {gstRecord.is_active ? ' · Active' : ' · Inactive'}
                      </p>
                      <p className="text-xs text-emerald-700">
                        {gstRecord.city}, {gstRecord.state} — {gstRecord.pincode}
                      </p>
                    </div>
                  )}
                  {gstStatus.state === 'failed' && (
                    <p
                      className="mt-2 text-xs text-amber-700 inline-flex items-start gap-1"
                      data-testid="partnership-gst-status"
                    >
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      Could not auto-verify — you can still proceed; we'll verify manually.
                    </p>
                  )}
                </div>

                <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">
                  <p>
                    <strong>Why GST first?</strong> We auto-fetch your business
                    details (legal name, state, pincode) and cross-check them at
                    submission to prevent anyone from impersonating your business.
                  </p>
                  <p className="mt-1.5">
                    <strong>Not GST-registered yet?</strong> No worries —{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, gst_number: '' }));
                        setGstStatus({ state: 'idle' });
                        setStep(2);
                      }}
                      className="text-[#D4AF37] hover:underline font-semibold"
                      data-testid="partnership-skip-gst"
                    >
                      contact us directly
                    </button>{' '}
                    and our team will guide you.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                  className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e',
                  }}
                  data-testid="partnership-next"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-600 hover:text-[#2B3A4A] underline"
                  data-testid="partnership-back"
                >
                  ← Back to GST
                </button>

                {isVerified && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 inline-flex items-center gap-2 w-full">
                    <ShieldCheck size={14} className="flex-shrink-0" />
                    Locked fields are pulled from your GST registry — they help us
                    verify it's really you.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#2B3A4A] mb-1">
                      Legal Name (as on GST certificate) {isVerified && <span className="text-emerald-700">· Locked</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Legal Name as on GST Certificate"
                      value={form.legal_name}
                      onChange={(e) =>
                        setForm({ ...form, legal_name: e.target.value })
                      }
                      className={`${inputBase} border-gray-300 w-full`}
                      data-testid="partnership-legal-name"
                      disabled={lockField('legal_name')}
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Trade / Business Name*"
                    value={form.business_name}
                    onChange={(e) =>
                      setForm({ ...form, business_name: titleCase(e.target.value) })
                    }
                    className={`${inputBase} border-gray-300`}
                    data-testid="partnership-business-name"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Your Name*"
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm({ ...form, contact_name: titleCase(e.target.value) })
                    }
                    className={`${inputBase} border-gray-300`}
                    data-testid="partnership-contact-name"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Business Email*"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value.toLowerCase() })
                    }
                    className={`${inputBase} border-gray-300`}
                    data-testid="partnership-email"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.country_code}
                      onChange={(e) =>
                        setForm({ ...form, country_code: e.target.value })
                      }
                      className={`${inputBase} border-gray-300 w-16 text-center`}
                      data-testid="partnership-country-code"
                      placeholder="+91"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp Number*"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: e.target.value.replace(/\D/g, '').slice(0, 12),
                        })
                      }
                      className={`${inputBase} border-gray-300 flex-1`}
                      data-testid="partnership-phone"
                      required
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: titleCase(e.target.value) })
                    }
                    className={`${inputBase} border-gray-300`}
                    data-testid="partnership-city"
                  />
                  <input
                    type="text"
                    placeholder={isVerified ? 'State (Locked)' : 'State'}
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: titleCase(e.target.value) })
                    }
                    className={`${inputBase} border-gray-300`}
                    data-testid="partnership-state"
                    disabled={lockField('state')}
                  />
                  <input
                    type="text"
                    placeholder={isVerified ? 'Pincode (Locked)' : 'Pincode (6 digits)'}
                    value={form.pincode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                      })
                    }
                    className={`${inputBase} border-gray-300 sm:col-span-2`}
                    data-testid="partnership-pincode"
                    disabled={lockField('pincode')}
                    inputMode="numeric"
                    pattern="\d{6}"
                  />
                  <textarea
                    placeholder="Anything else we should know? (optional)"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={`${inputBase} sm:col-span-2 border-gray-300`}
                    rows={3}
                    maxLength={1000}
                    data-testid="partnership-message"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                    color: '#1a1a2e',
                  }}
                  data-testid="partnership-submit"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 size={16} className="animate-spin" /> Submitting…
                    </span>
                  ) : (
                    'Submit Partnership Inquiry'
                  )}
                </button>
                <p className="text-[11px] text-center text-gray-500">
                  By submitting, you agree to be contacted by Addrika at the email/WhatsApp above.
                </p>
              </div>
            )}
          </form>
        ) : (
          <div className="p-8 text-center" data-testid="partnership-success">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2
              className="text-2xl font-bold text-[#2B3A4A] mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              You're on the list
            </h2>
            <p className="text-gray-600 mb-6">
              Thanks {form.contact_name || 'there'} — our partnerships team will
              be in touch within 24 hours at <b>{form.email}</b>.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-[#2B3A4A] text-white hover:bg-[#1e3a52]"
              data-testid="partnership-close-success"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
