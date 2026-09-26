'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeGstInput } from '../../../lib/formHelpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function RetailerForgotPasswordPage() {
  const [gstin, setGstin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!GST_REGEX.test(gstin)) {
      toast.error('Enter your 15-character GSTIN (e.g. 27ABCDE1234F1Z5)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/retailer-auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error(typeof data.detail === 'string' ? data.detail : 'Too many requests. Try again in an hour.');
        return;
      }
      setSent(true);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#F5EFE0' }}>
      <div className="w-full max-w-md" data-testid="retailer-forgot-password-page">
        <Link
          href="/retailer/login"
          className="inline-flex items-center gap-2 text-sm text-[#2B3A4A]/70 hover:text-[#2B3A4A] mb-6"
          data-testid="forgot-back-to-login"
        >
          <ArrowLeft size={16} /> Back to retailer login
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center" data-testid="forgot-password-sent">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: '#D4AF37' }}>
                <MailCheck className="w-7 h-7 text-[#1a1a2e]" />
              </div>
              <h1 className="text-2xl font-bold text-[#2B3A4A]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Check your inbox
              </h1>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                If that GSTIN is registered, we&apos;ve emailed a password reset link to the address on file.
                The link works once and expires in 60 minutes.
              </p>
              <p className="text-xs text-gray-500 mt-4">
                Can&apos;t find it? Check spam, or write to{' '}
                <a href="mailto:contact.us@centraders.com" className="font-medium text-[#2B3A4A] hover:underline">
                  contact.us@centraders.com
                </a>
                .
              </p>
              <Link
                href="/retailer/login"
                className="inline-block mt-6 px-6 py-3 rounded-xl font-bold text-sm"
                style={{ background: '#2B3A4A', color: '#F5EFE0' }}
                data-testid="forgot-done-login"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(212,175,55,0.15)' }}>
                <KeyRound className="w-6 h-6 text-[#8a6d1f]" />
              </div>
              <h1 className="text-2xl font-bold text-[#2B3A4A]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Forgot your password?
              </h1>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Enter your GSTIN and we&apos;ll email a reset link to your registered email address.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 mb-1">
                    GSTIN
                  </label>
                  <input
                    id="gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(normalizeGstInput(e.target.value))}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    autoCapitalize="characters"
                    className="w-full px-4 py-3 bg-white text-[#2B3A4A] placeholder:text-gray-400 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none uppercase font-mono tracking-wider"
                    data-testid="forgot-gstin-input"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    We never show your email here — the link goes straight to the address on file.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #a8842b 100%)', color: '#1a1410' }}
                  data-testid="forgot-submit-btn"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Email me a reset link
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
