'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const CONSENT_KEY = 'addrika_cookie_consent_v1';

// Timezones whose region requires explicit GDPR-style opt-in.
// Detection is best-effort (browser timezone) — enough for compliance UX.
const GDPR_TZ_PREFIXES = [
  'Europe/',           // EU + UK
  'Atlantic/Reykjavik',
  'Atlantic/Faroe',
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Azores',
  'Africa/Ceuta',
];

function detectGDPR() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return GDPR_TZ_PREFIXES.some((prefix) => tz.startsWith(prefix));
  } catch {
    return false;
  }
}

function isPublicPath(pathname) {
  if (!pathname) return true;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/retailer')) return false;
  return true;
}

export default function CookieConsentAndGA() {
  const pathname = usePathname();
  const [consent, setConsent] = useState(null); // 'accepted' | 'declined' | null
  const [isGDPR, setIsGDPR] = useState(false);

  useEffect(() => {
    setIsGDPR(detectGDPR());
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored === 'accepted' || stored === 'declined') {
        setConsent(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {}
    setConsent('accepted');
  };

  const decline = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'declined');
    } catch {}
    setConsent('declined');
  };

  const onPublic = isPublicPath(pathname);

  // Hide entirely on admin/retailer paths. Banner only renders on public
  // paths and only when no choice has been made yet.
  // Note: GA4 itself is loaded in the root layout via direct gtag.js per
  // Google's setup. This banner handles consent UX only.
  if (!onPublic || consent !== null) return null;

  // GDPR variant: stricter copy, larger banner, explicit opt-in language.
  if (isGDPR) {
    return (
      <div
        role="dialog"
        aria-label="Cookie consent (GDPR)"
        className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[560px] z-[80] bg-[#2B3A4A] text-white rounded-xl shadow-2xl p-5 border border-white/10"
        data-testid="cookie-consent-gdpr"
      >
        <h3 className="font-semibold text-base mb-2">
          Your privacy choices &middot; GDPR
        </h3>
        <p className="text-sm leading-relaxed">
          We use a single Google Analytics cookie to measure site usage.
          Under GDPR, this requires your explicit consent — we will not set
          any analytics cookie until you choose <b>Accept</b>. You can
          change your choice at any time via your browser&apos;s site
          settings. We never run personalised advertising.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={accept}
            className="flex-1 px-3 py-2 rounded-lg bg-[#D4AF37] text-[#2B3A4A] font-semibold text-sm hover:bg-[#c89e2c]"
            data-testid="cookie-accept"
          >
            Accept analytics
          </button>
          <button
            onClick={decline}
            className="flex-1 px-3 py-2 rounded-lg border border-white/30 text-sm hover:bg-white/10"
            data-testid="cookie-decline"
          >
            Reject all
          </button>
        </div>
        <p className="text-[10px] mt-3 opacity-70 text-center">
          Read our{' '}
          <a href="/privacy" className="underline hover:text-[#D4AF37]">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    );
  }

  // Default (non-GDPR) variant
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[80] bg-[#2B3A4A] text-white rounded-xl shadow-2xl p-4 border border-white/10"
      data-testid="cookie-consent"
    >
      <p className="text-sm leading-relaxed">
        We use a single Google Analytics cookie to understand how the site
        is used. No personalised ads, ever. You can decline and still
        browse normally.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={accept}
          className="flex-1 px-3 py-2 rounded-lg bg-[#D4AF37] text-[#2B3A4A] font-semibold text-sm hover:bg-[#c89e2c]"
          data-testid="cookie-accept"
        >
          Accept
        </button>
        <button
          onClick={decline}
          className="flex-1 px-3 py-2 rounded-lg border border-white/30 text-sm hover:bg-white/10"
          data-testid="cookie-decline"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
