'use client';

import { useEffect, useState } from 'react';
import { Award, TrendingUp, Clock, Info } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const daysUntil = (iso) => {
  if (!iso) return null;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return d > 0 ? d : 0;
  } catch { return null; }
};

/**
 * B2B Fragrance Rewards Balance Card.
 * Fetches GET /api/fragrance-rewards/balance and surfaces:
 *   ▸ current balance (₹)
 *   ▸ streak + next-multiplier hint (100/110/125 %)
 *   ▸ how much more until redeemable (₹2,500)
 *   ▸ streak-reset countdown (45 days)
 */
export default function RewardsBalanceCard({ fetchWithAuth }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/fragrance-rewards/balance`);
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [fetchWithAuth]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border border-amber-200 dark:border-amber-800 rounded-xl p-5 animate-pulse"
        data-testid="rewards-card-loading">
        <div className="h-4 w-32 bg-amber-200 dark:bg-amber-800 rounded mb-3" />
        <div className="h-8 w-40 bg-amber-200 dark:bg-amber-800 rounded" />
      </div>
    );
  }
  if (!state) return null;

  const balance = state.balance_inr || 0;
  const threshold = state.redemption_threshold_inr || 2500;
  const remainingToRedeem = Math.max(threshold - balance, 0);
  const nextMult = state.next_multiplier_pct || 100;
  const streakDays = daysUntil(state.streak_resets_at);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-white dark:from-amber-950/40 dark:via-yellow-950/40 dark:to-slate-900 p-5"
      data-testid="rewards-balance-card"
    >
      <div className="absolute right-4 top-4 opacity-10">
        <Award size={72} className="text-amber-600" />
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
        <Award size={14} /> Fragrance Rewards
      </div>

      <div className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white" data-testid="rewards-balance-value">
        {inr(balance)}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Trade credit earned on B2B shipping charges
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
        <div className="bg-white/70 dark:bg-slate-800/70 border border-amber-100 dark:border-amber-800/40 rounded-lg p-2">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <TrendingUp size={11} /> Next Multiplier
          </div>
          <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5" data-testid="rewards-next-mult">
            {nextMult}%
          </div>
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 border border-amber-100 dark:border-amber-800/40 rounded-lg p-2">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 uppercase font-semibold">
            Streak
          </div>
          <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5">
            {state.streak || 0}
          </div>
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 border border-amber-100 dark:border-amber-800/40 rounded-lg p-2">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <Clock size={11} /> Resets in
          </div>
          <div className="text-base font-bold text-slate-800 dark:text-white mt-0.5">
            {streakDays !== null ? `${streakDays}d` : '—'}
          </div>
        </div>
      </div>

      {state.redeemable ? (
        <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-2.5 flex items-start gap-2"
          data-testid="rewards-redeemable-badge">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <b>Ready to redeem.</b> Apply this credit at checkout on any B2B invoice ≥ {inr(threshold)}.
            Shipping + GST are always payable.
          </span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 border border-amber-100 dark:border-amber-800/40 rounded-lg p-2.5">
          Earn <b>{inr(remainingToRedeem)}</b> more to unlock redemption
          (threshold: {inr(threshold)}). Every qualifying B2B order (≥ ₹1,000 invoice)
          earns {nextMult}% of its shipping charge as credit.
        </div>
      )}
    </div>
  );
}
