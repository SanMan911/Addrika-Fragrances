'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const CONSENT_KEY = 'addrika_cookie_consent_v1';

function isPublicPath(pathname) {
  if (!pathname) return true;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/retailer')) return false;
  return true;
}

export default function CookieConsentAndGA() {
  const pathname = usePathname();
  const [consent, setConsent] = useState(null); // 'accepted' | 'declined' | null

  useEffect(() => {
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
  const shouldLoadGA = onPublic && consent === 'accepted' && !!GA_ID;

  return (
    <>
      {shouldLoadGA && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                anonymize_ip: true,
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {onPublic && consent === null && (
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
      )}
    </>
  );
}
