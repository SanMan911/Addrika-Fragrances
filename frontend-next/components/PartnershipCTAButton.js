'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Toaster } from 'sonner';
import RetailerPartnershipModal from './RetailerPartnershipModal';

/**
 * Client-side button that opens the partnership inquiry modal. Used inside
 * server-rendered pages (like /find-retailers).
 */
export default function PartnershipCTAButton({
  className = '',
  label = 'Contact for Partnership',
  variant = 'gold',
}) {
  const [open, setOpen] = useState(false);

  const goldStyle = {
    background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
    color: '#1a1a2e',
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all hover:scale-105'
        }
        style={variant === 'gold' ? goldStyle : undefined}
        data-testid="partnership-cta-button"
      >
        <Mail size={18} />
        {label}
      </button>
      <RetailerPartnershipModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
