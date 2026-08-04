'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, Info } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

/**
 * B2B checkout — Fragrance Rewards redemption toggle.
 * Props:
 *   ▸ subtotal (₹, pre-shipping / pre-GST)
 *   ▸ onAmountChange(amt) — called whenever the retailer changes the amount
 *   ▸ fetchWithAuth — bound retailer fetcher
 */
export default function RewardsRedeemToggle({ subtotal, onAmountChange, fetchWithAuth }) {
  const [balance, setBalance] = useState(0);
  const [threshold, setThreshold] = useState(2500);
  const [redeemable, setRedeemable] = useState(false);
  const [applied, setApplied] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/fragrance-rewards/balance`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance_inr || 0);
        setThreshold(data.redemption_threshold_inr || 2500);
        setRedeemable(!!data.redeemable);
      }
    } catch {/* silent */}
    setLoading(false);
  }, [fetchWithAuth]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  // Auto-clamp when subtotal changes
  useEffect(() => {
    if (!enabled) {
      setApplied(0);
      onAmountChange?.(0);
      return;
    }
    const max = Math.min(balance, Number(subtotal) || 0);
    const next = Math.min(applied || max, max);
    setApplied(next);
    onAmountChange?.(next);
  }, [enabled, subtotal, balance, applied, onAmountChange]);

  // Fetch server preview to double-check (server is source of truth for rules)
  useEffect(() => {
    if (!enabled || applied <= 0 || (subtotal || 0) < threshold) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/fragrance-rewards/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_subtotal_inr: subtotal, requested_amount: applied }),
        });
        if (res.ok) setPreview(await res.json());
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(t);
  }, [applied, subtotal, enabled, threshold, fetchWithAuth]);

  if (loading) return null;
  if (!redeemable && balance < threshold) {
    return (
      <div
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-xs text-slate-500"
        data-testid="rewards-redeem-locked"
      >
        <Award size={14} className="inline mr-1 text-amber-500" />
        Fragrance Rewards balance ({inr(balance)}) needs at least {inr(threshold)} to redeem.
      </div>
    );
  }

  const invoiceTooSmall = (Number(subtotal) || 0) < threshold;
  const maxRedeem = Math.min(balance, Number(subtotal) || 0);

  return (
    <div
      className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-3"
      data-testid="rewards-redeem-toggle"
    >
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={invoiceTooSmall}
          className="w-4 h-4 accent-amber-600"
          data-testid="rewards-redeem-checkbox"
        />
        <span className="text-sm font-semibold text-slate-800 dark:text-white">
          <Award size={14} className="inline mr-1 text-amber-600" />
          Apply Fragrance Rewards — balance {inr(balance)}
        </span>
      </label>

      {invoiceTooSmall ? (
        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          Invoice subtotal must be at least {inr(threshold)} to apply credit. Shipping &amp; GST are always payable.
        </p>
      ) : enabled ? (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Amount to apply (max {inr(maxRedeem)})
            </label>
            <input
              type="range"
              min={0}
              max={maxRedeem}
              step={50}
              value={applied}
              onChange={(e) => {
                const v = Number(e.target.value);
                setApplied(v);
                onAmountChange?.(v);
              }}
              className="w-full accent-amber-600"
              data-testid="rewards-redeem-slider"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">{inr(0)}</span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-400" data-testid="rewards-redeem-amount">
                -{inr(applied)}
              </span>
              <span className="text-xs text-slate-500">{inr(maxRedeem)}</span>
            </div>
          </div>
          {preview && !preview.eligible && (
            <p className="text-xs text-rose-600" data-testid="rewards-preview-error">{preview.reason}</p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Credit applies to invoice value only — shipping and GST are always payable.
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tick the box to apply up to {inr(maxRedeem)} on this order.
        </p>
      )}
    </div>
  );
}
