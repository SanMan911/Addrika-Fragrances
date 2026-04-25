'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Award,
  Receipt,
  MessageSquare,
  X,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STEPS = [
  {
    icon: ShoppingBag,
    title: 'Browse the wholesale catalog',
    body: "Boxes are priced at 76.5% of MRP. Bulk-tier discounts kick in automatically — the more you order, the cheaper each box gets.",
    cta: { label: 'Open Catalog', href: '/retailer/b2b' },
  },
  {
    icon: Award,
    title: 'Earn loyalty bonuses every quarter',
    body: 'Cross ₹10k → +0.5% off, ₹25k → +1%, ₹50k → +2%. Resets each quarter so every 3 months is a fresh start.',
    cta: { label: 'See My Loyalty', href: '/retailer/b2b' },
  },
  {
    icon: Receipt,
    title: 'Pay & download GST invoices',
    body: 'Pay online for an instant 1.5% extra discount. Every paid order gets a one-click GST tax-invoice PDF.',
    cta: { label: 'My Orders', href: '/retailer/b2b' },
  },
  {
    icon: MessageSquare,
    title: 'Stay in touch with our team',
    body: 'Use the bills/chat tab to upload payment proofs, ask questions, or request custom blends. Replies usually within 24h.',
    cta: { label: 'Open Chat', href: '/retailer/admin-chat' },
  },
];


/**
 * Fires on first login for a retailer that has just completed setup-password.
 * Skippable + dismissible. Persists "tour_completed" on the retailer record
 * via PATCH so it doesn't show again. Falls back to localStorage so even
 * unauthenticated state changes don't keep replaying it.
 */
export default function RetailerFirstLoginTour({ retailer }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!retailer) return;
    if (retailer.tour_completed) return;
    const localKey = `retailer_tour_done_${retailer.retailer_id}`;
    if (typeof window !== 'undefined' && localStorage.getItem(localKey)) return;
    // Stagger 800ms so the page can settle in before we pop the tour
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [retailer]);

  const finish = async (dismissed = false) => {
    setOpen(false);
    if (!retailer) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`retailer_tour_done_${retailer.retailer_id}`, '1');
      }
      await fetch(`${API_URL}/api/retailer-dashboard/b2b/tour-complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed }),
      });
    } catch {
      /* network errors are fine — localStorage already prevents re-show */
    }
  };

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      data-testid="retailer-tour-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#F5EFE0] shadow-2xl overflow-hidden">
        <div
          className="px-6 pt-6 pb-4 text-center relative"
          style={{ background: 'linear-gradient(135deg, #1e3a52 0%, #2B3A4A 100%)' }}
        >
          <button
            onClick={() => finish(true)}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 text-white/70"
            aria-label="Skip tour"
            data-testid="retailer-tour-skip"
          >
            <X size={18} />
          </button>
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2"
            style={{ background: '#D4AF37' }}
          >
            <Icon className="w-7 h-7 text-[#1a1a2e]" />
          </div>
          <p className="text-xs uppercase tracking-widest text-[#D4AF37]/90">
            Quick tour · {step + 1} of {STEPS.length}
          </p>
          <h2
            className="text-xl font-bold text-white mt-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {s.title}
          </h2>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#2B3A4A] leading-relaxed mb-5">{s.body}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 justify-center mb-5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-6 bg-[#D4AF37]'
                    : i < step
                    ? 'w-1.5 bg-[#D4AF37]/60'
                    : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => finish(true)}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
              data-testid="retailer-tour-skip-text"
            >
              Skip the tour
            </button>
            {isLast ? (
              <button
                onClick={() => finish(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#2B3A4A] text-white hover:bg-[#1e3a52] inline-flex items-center gap-1"
                data-testid="retailer-tour-finish"
              >
                <CheckCircle2 size={14} /> Got it
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#D4AF37] text-[#1a1a2e] hover:bg-[#c9a432] inline-flex items-center gap-1"
                data-testid="retailer-tour-next"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
