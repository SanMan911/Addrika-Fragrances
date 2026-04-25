'use client';

import { useEffect, useState } from 'react';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';
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
 * Public partnership-inquiry modal — submits to the same retailer waitlist
 * endpoint as the retailer-login coming-soon form. Includes Appyflow-powered
 * GSTIN autofill (Business Name + City + State pre-fill).
 */
export default function RetailerPartnershipModal({ open, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gstStatus, setGstStatus] = useState({ state: 'idle' });
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

  useEffect(() => {
    if (!open) {
      // Reset on close
      setSubmitted(false);
      setSubmitting(false);
      setGstStatus({ state: 'idle' });
      setForm({
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
    }
  }, [open]);

  // Debounced Appyflow lookup the moment a complete GSTIN is typed
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
        if (!cancelled)
          setGstStatus({ state: 'failed', error: 'Lookup unavailable' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.gst_number]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name || !form.contact_name || !form.email || !form.phone) {
      toast.error('Please fill business, contact, email & WhatsApp');
      return;
    }
    if (!GST_REGEX.test((form.gst_number || '').toUpperCase())) {
      toast.error('Please enter a valid 15-digit GST number');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      payload.email = (payload.email || '').toLowerCase().trim();
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
      toast.success("Thanks — we'll be in touch within 24 hours.");
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Explicit text color so inputs don't inherit the dark page theme
  const inputBase =
    'px-3 py-2 rounded-lg border focus:border-[#D4AF37] outline-none bg-white text-[#2B3A4A] placeholder:text-gray-400';

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
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/5 text-[#2B3A4A]"
          data-testid="partnership-modal-close"
        >
          <X size={20} />
        </button>

        {!submitted ? (
          <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-4">
            <div className="text-center mb-2">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
                style={{
                  background:
                    'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                }}
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
                Tell us about your business — we typically respond within 24 hours.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Business Name*"
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
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="GST Number*"
                  value={form.gst_number}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      gst_number: e.target.value.toUpperCase().slice(0, 15),
                    })
                  }
                  className={`${inputBase} w-full uppercase font-mono ${
                    gstStatus.state === 'verified'
                      ? 'border-emerald-500'
                      : gstStatus.state === 'failed'
                      ? 'border-amber-400'
                      : 'border-gray-300'
                  }`}
                  data-testid="partnership-gst"
                  maxLength={15}
                  required
                  pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                  title="Enter a valid 15-character GSTIN"
                />
                {gstStatus.state === 'looking' && (
                  <p
                    className="mt-1 text-xs text-gray-500 inline-flex items-center gap-1"
                    data-testid="partnership-gst-status"
                  >
                    <Loader2 size={12} className="animate-spin" /> Verifying GSTIN…
                  </p>
                )}
                {gstStatus.state === 'verified' && (
                  <p
                    className="mt-1 text-xs text-emerald-700"
                    data-testid="partnership-gst-status"
                  >
                    ✓ Verified · {gstStatus.legal_name || 'business name auto-filled'}
                  </p>
                )}
                {gstStatus.state === 'failed' && (
                  <p
                    className="mt-1 text-xs text-amber-700"
                    data-testid="partnership-gst-status"
                  >
                    Could not auto-verify — you can still submit; we'll verify manually.
                  </p>
                )}
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
                placeholder="State"
                value={form.state}
                onChange={(e) =>
                  setForm({ ...form, state: titleCase(e.target.value) })
                }
                className={`${inputBase} border-gray-300`}
                data-testid="partnership-state"
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
