'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import AarohmmWalkthrough from './AarohmmWalkthrough';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Auto-opens the 60-second Aarohmm walkthrough once per retailer, then never
 * again. "Watch walkthrough" in the sidebar links to /retailer/onboarding for
 * replays.
 */
export default function WalkthroughModal({ retailer }) {
  const [open, setOpen] = useState(false);

  const storageKey = retailer ? `retailer_walkthrough_seen_${retailer.retailer_id}` : null;

  useEffect(() => {
    if (!retailer || retailer.walkthrough_seen) return undefined;
    if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) return undefined;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [retailer, storageKey]);

  const close = useCallback(async () => {
    setOpen(false);
    if (!retailer) return;
    try {
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, '1');
      await fetch(`${API_URL}/api/retailer-dashboard/b2b/walkthrough-seen`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* localStorage already stops the replay */
    }
  }, [retailer, storageKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
      data-testid="walkthrough-modal"
    >
      <div className="w-full max-w-4xl my-auto relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[2px] uppercase text-[#D4AF37]">
            New here? A 60-second tour
          </p>
          <button
            onClick={close}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="walkthrough-modal-skip"
          >
            Skip <X size={14} />
          </button>
        </div>
        <AarohmmWalkthrough />
        <div className="text-center mt-4">
          <button
            onClick={close}
            className="px-6 py-2.5 rounded-full text-sm font-semibold"
            style={{ background: '#D4AF37', color: '#1a1410' }}
            data-testid="walkthrough-modal-done"
          >
            Got it, take me to my dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
