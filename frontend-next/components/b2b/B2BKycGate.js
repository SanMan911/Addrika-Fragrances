'use client';

import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import KYCVerificationCard from '../KYCVerificationCard';

/**
 * Sticky KYC nudge shown above the B2B ordering surface.
 *
 * Extracted from `app/retailer/b2b/page.js` in Iter 99 — behavior is
 * byte-for-byte identical, only the boundary changed. When the gate is
 * disabled (`gate_enabled` false) or the retailer is already fully
 * verified, this component renders `null` and takes no DOM slots.
 *
 * Props
 * -----
 * kycGate:      { gate_enabled, fully_kyc_verified, missing: ['GST'|'PAN'|'Aadhaar'], retailer_id }
 * showKycCard:  boolean — whether the inline verification card is expanded
 * onToggle:     () => void — flip the expand/collapse state
 * onComplete:   () => void — fires when KYC has finished (parent refetches catalog)
 */
export default function B2BKycGate({ kycGate, showKycCard, onToggle, onComplete }) {
  if (!kycGate || !kycGate.gate_enabled || kycGate.fully_kyc_verified) return null;

  const missing = kycGate.missing || [];
  const steps = [
    { key: 'gst', label: 'GST', done: !missing.includes('GST') },
    { key: 'pan', label: 'PAN', done: !missing.includes('PAN') },
    { key: 'aadhaar', label: 'Aadhaar OTP', done: !missing.includes('Aadhaar') },
  ];

  return (
    <div
      id="kyc-self-service"
      className="sticky top-16 z-30 rounded-xl overflow-hidden shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '2px solid #d97706',
      }}
      data-testid="kyc-gate-banner"
    >
      <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900 mb-1.5">
              🔒 Complete your KYC to unlock wholesale pricing &amp; ordering
            </p>

            {/* Progress chips — one per verification step */}
            <div className="flex flex-wrap items-center gap-1.5">
              {steps.map((step) => (
                <span
                  key={step.key}
                  data-testid={`kyc-step-${step.key}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{
                    background: step.done ? '#10b981' : 'rgba(120, 53, 15, 0.15)',
                    color: step.done ? '#fff' : '#78350f',
                    border: step.done ? 'none' : '1px solid rgba(120,53,15,0.3)',
                  }}
                >
                  {step.done ? '✓' : '○'} {step.label}
                </span>
              ))}
              <span className="text-[11px] text-amber-900/70 ml-1">
                takes ~3 min
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 px-4 py-2 text-xs rounded-lg font-bold whitespace-nowrap transition-transform hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            color: '#fff',
            boxShadow: '0 4px 12px -2px rgba(180,83,9,0.4)',
          }}
          data-testid="kyc-self-service-toggle"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} />
            {showKycCard ? 'Hide verification' : 'Verify now →'}
          </span>
        </button>
      </div>
      {showKycCard && (
        <div className="border-t border-amber-300 p-4 bg-white">
          <KYCVerificationCard
            retailerId={kycGate.retailer_id}
            onComplete={() => {
              toast.success('KYC complete — orders unlocked');
              onComplete?.();
            }}
          />
        </div>
      )}
    </div>
  );
}
