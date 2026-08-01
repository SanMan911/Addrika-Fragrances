'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Handshake, Download, X, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import RetailerPartnershipModal from './RetailerPartnershipModal';

const HIDDEN_PREFIXES = [
  '/find-retailers',
  '/admin',
  '/retailer',
  '/cart',
  '/checkout',
  // Auth flows — floating CTA + its own Toaster caused a duplicate
  // "This username is not available" toast on /register (Feb 2026 bug).
  '/register',
  '/login',
  '/signup',
  '/forgot-password',
  '/forgot-username',
  '/reset-password',
  '/verify-email',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function RetailerFloatingCTA() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const shouldHide = HIDDEN_PREFIXES.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)
  );

  if (!hasMounted || shouldHide) return null;

  const downloadBrochure = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/brochure/download`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Addrika-Brochure.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Brochure downloaded');
      setOpen(false);
    } catch {
      toast.error('Could not download the brochure. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const openPartnership = () => {
    setOpen(false);
    setModalOpen(true);
  };

  return (
    <>
      {/* Backdrop when popover is open (mobile) */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(15,20,25,0.35)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Popover menu */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 w-[280px] rounded-2xl overflow-hidden"
          style={{
            background:
              'linear-gradient(160deg, #1a1a2e 0%, #0f1419 100%)',
            border: '1px solid rgba(212,175,55,0.35)',
            boxShadow:
              '0 20px 60px -10px rgba(0,0,0,0.55), 0 4px 14px rgba(212,175,55,0.18)',
          }}
          data-testid="retailer-cta-popover"
        >
          <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
            <div>
              <div
                className="text-[10px] font-bold tracking-[2px]"
                style={{ color: '#D4AF37' }}
              >
                FOR BUSINESS
              </div>
              <div className="text-white text-base font-semibold leading-tight mt-0.5">
                Stock Addrika at your store
              </div>
              <div className="text-[11px] text-white/60 mt-1 leading-snug">
                Wholesale, GST-verified onboarding, dedicated SPOC.
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 rounded-full hover:bg-white/10 text-white/70"
              data-testid="retailer-cta-close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-3 pb-3 space-y-2">
            <button
              type="button"
              onClick={openPartnership}
              className="w-full group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-transform hover:translate-x-0.5"
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                color: '#1a1a2e',
              }}
              data-testid="retailer-cta-partner"
            >
              <span className="flex items-center gap-2.5 text-sm font-bold">
                <Handshake size={16} />
                Become a Retailer
              </span>
              <ChevronRight size={16} className="opacity-70 group-hover:opacity-100" />
            </button>

            <button
              type="button"
              onClick={downloadBrochure}
              disabled={downloading}
              className="w-full group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(212,175,55,0.3)',
                color: '#fff',
              }}
              data-testid="retailer-cta-brochure"
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold">
                <Download size={15} />
                {downloading ? 'Preparing PDF…' : 'Download Brochure (PDF)'}
              </span>
              <FileText size={14} className="opacity-50 group-hover:opacity-90" />
            </button>
          </div>

          <div
            className="px-4 py-2 text-[10px] text-white/50 text-center"
            style={{
              background: 'rgba(255,255,255,0.025)',
              borderTop: '1px solid rgba(212,175,55,0.18)',
            }}
          >
            Pan-India shipping · 12 signature fragrances
          </div>
        </div>
      )}

      {/* The floating trigger itself — bottom-left, opposite the WhatsApp button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Become a Retailer"
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 transition-all duration-300 hover:scale-105"
        style={{
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#D4AF37',
          borderRadius: '999px',
          padding: '14px 18px 14px 14px',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow:
            '0 8px 32px -8px rgba(0,0,0,0.45), 0 2px 6px rgba(212,175,55,0.18)',
        }}
        data-testid="retailer-floating-cta"
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg, #D4AF37 0%, #a8842b 100%)',
            color: '#1a1a2e',
          }}
        >
          <Handshake size={16} strokeWidth={2.5} />
        </span>
        <span className="hidden sm:inline text-sm font-bold tracking-wide">
          Become a Retailer
        </span>
        <span className="sm:hidden text-sm font-bold tracking-wide">
          Retailer
        </span>
      </button>

      <RetailerPartnershipModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
