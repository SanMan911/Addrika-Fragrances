'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, ArrowUpRight, ArrowDownLeft, Sparkles, Info, Clock, Download } from 'lucide-react';
import { useRetailerAuth } from '../../../../context/RetailerAuthContext';
import RewardsBalanceCard from '../../../../components/RewardsBalanceCard';
import BRAND from '../../../../lib/brand.config';
import { getTierPerks } from '../../../../lib/tierPerks';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const KIND_META = {
  earn:    { icon: ArrowUpRight,   label: 'Earned',    tone: 'text-emerald-700 bg-emerald-50', sign: '+' },
  redeem:  { icon: ArrowDownLeft,  label: 'Redeemed',  tone: 'text-rose-700 bg-rose-50',       sign: '-' },
  adjust:  { icon: Sparkles,       label: 'Adjusted',  tone: 'text-slate-700 bg-slate-100',    sign: '±' },
  expire:  { icon: Clock,          label: 'Expired',   tone: 'text-slate-500 bg-slate-100',    sign: '-' },
};

export default function RetailerRewardsHistoryPage() {
  const { fetchWithAuth, retailer, loading: authLoading } = useRetailerAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const downloadStatement = async () => {
    setDownloading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/fragrance-rewards/statement.pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${BRAND.name.toLowerCase()}-rewards-statement.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('statement download failed', e);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !retailer) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/fragrance-rewards/ledger?limit=200`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [authLoading, retailer, fetchWithAuth]);

  const visible = filter === 'all'
    ? entries
    : entries.filter((e) => (e.kind || 'earn') === filter);

  const totals = entries.reduce((a, e) => {
    const k = e.kind || 'earn';
    const amt = Number(e.amount || 0);
    if (k === 'earn' || (k === 'adjust' && amt > 0)) a.earned += Math.abs(amt);
    else if (k === 'redeem') a.redeemed += Math.abs(amt);
    else if (k === 'expire') a.expired += Math.abs(amt);
    else if (k === 'adjust' && amt < 0) a.adjusted += Math.abs(amt);
    return a;
  }, { earned: 0, redeemed: 0, expired: 0, adjusted: 0 });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4" data-testid="rewards-history-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/retailer/b2b" className="text-slate-500 hover:text-slate-800" data-testid="link-back-b2b">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Award size={24} className="text-amber-600" /> Fragrance Rewards
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Every earn, redeem, adjustment and expiration on your account.
              </p>
            </div>
          </div>
          <button
            onClick={downloadStatement}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2B3A4A] hover:bg-[#1e3a52] text-white text-sm font-medium disabled:opacity-50"
            data-testid="rewards-download-statement-btn"
          >
            <Download size={14} /> {downloading ? 'Preparing…' : 'Download Statement (PDF)'}
          </button>
        </div>

        {/* Balance card */}
        <RewardsBalanceCard fetchWithAuth={fetchWithAuth} />

        {/* Patron milestones */}
        <PatronStatusCard fetchWithAuth={fetchWithAuth} />

        {/* Accountant CC for the Monthly Rewards Digest */}
        <AccountantEmailCard fetchWithAuth={fetchWithAuth} />

        {/* Totals row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="rewards-history-totals">
          <TotalCell label="Total Earned"   value={totals.earned}   tone="text-emerald-700 bg-emerald-50" />
          <TotalCell label="Total Redeemed" value={totals.redeemed} tone="text-rose-700 bg-rose-50" />
          <TotalCell label="Adjustments"    value={totals.adjusted} tone="text-slate-700 bg-slate-100" />
          <TotalCell label="Expired"        value={totals.expired}  tone="text-slate-500 bg-slate-100" />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2" data-testid="rewards-history-filters">
          {[
            { key: 'all',    label: 'All' },
            { key: 'earn',   label: 'Earned' },
            { key: 'redeem', label: 'Redeemed' },
            { key: 'adjust', label: 'Adjustments' },
            { key: 'expire', label: 'Expired' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === c.key
                  ? 'bg-[#2B3A4A] text-white border-[#2B3A4A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-500 hover:text-amber-700'
              }`}
              data-testid={`rewards-filter-${c.key}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Ledger */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading ledger…</div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Info size={24} className="inline mb-2 text-slate-400" />
              <div>No entries in this filter yet. Place a qualifying B2B order (≥ ₹1,000) to start earning.</div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {visible.map((e) => {
                const meta = KIND_META[e.kind] || KIND_META.earn;
                const Icon = meta.icon;
                const amount = Math.abs(Number(e.amount || 0));
                const isNegative = ['redeem', 'expire'].includes(e.kind) || (e.kind === 'adjust' && Number(e.amount) < 0);
                return (
                  <li key={e.id || (e.source_order_id + e.earned_at)}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                      data-testid={`ledger-row-${e.id || e.source_order_id}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${meta.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-white">
                        {meta.label}
                        {e.source_order_id && (
                          <span className="text-xs text-slate-500 ml-2">· Order {e.source_order_id}</span>
                        )}
                        {e.note && !e.source_order_id && (
                          <span className="text-xs text-slate-500 ml-2">· {e.note}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(e.earned_at || e.created_at || Date.now()).toLocaleString('en-IN')}
                        {e.multiplier_pct && ` · ${e.multiplier_pct}% multiplier`}
                        {e.expires_at && (
                          <> · Valid until {new Date(e.expires_at).toLocaleDateString('en-IN')}</>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-bold whitespace-nowrap ${isNegative ? 'text-rose-700' : 'text-emerald-700'}`}
                         data-testid={`ledger-amount-${e.id || e.source_order_id}`}>
                      {isNegative ? '-' : '+'}{inr(amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TotalCell({ label, value, tone }) {
  return (
    <div className={`rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone.split(' ')[0]}`}>
        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0)}
      </div>
    </div>
  );
}



function AccountantEmailCard({ fetchWithAuth }) {
  const [email, setEmail] = useState('');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/accountant-email`);
        if (!res.ok) return;
        const data = await res.json();
        setEmail(data.accountant_email || '');
        setInitial(data.accountant_email || '');
      } catch { /* silent */ }
    })();
  }, [fetchWithAuth]);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/accountant-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountant_email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setInitial(email.trim());
      setStatus({ ok: true, msg: data.message || 'Saved.' });
    } catch (e) {
      setStatus({ ok: false, msg: e.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const dirty = email.trim() !== (initial || '').trim();

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
      data-testid="accountant-email-card"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-slate-800 dark:text-white">Accountant CC · Monthly Rewards Statement</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Every 1st of the month we email you the PDF of your Fragrance Rewards ledger.
        Add your accountant&apos;s email here and they&apos;ll be CC&apos;d automatically —
        keep it in sync with your books without lifting a finger.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="accountant@your-firm.com"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white"
          data-testid="accountant-email-input"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg bg-[#2B3A4A] hover:bg-[#1e3a52] text-white text-sm font-medium disabled:opacity-50"
          data-testid="accountant-email-save-btn"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {status && (
        <p
          className={`text-xs mt-2 ${status.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}
          data-testid="accountant-email-status"
        >
          {status.msg}
        </p>
      )}
      <p className="text-[10px] text-slate-500 mt-2">
        Leave blank to remove — the digest will be sent to you only.
      </p>
    </div>
  );
}



const AROMA_TONES = {
  cedar: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
  sandalwood: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-700',
  oudh: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-700',
  musk: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-700',
  amber: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-100 dark:border-yellow-700',
  kewda: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700',
  rose: 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-900/40 dark:text-pink-100 dark:border-pink-700',
};

// Aroma Ranking Tiers — visual ring + pill treatment
const TIER_STYLE = {
  gold:   { ring: 'ring-4 ring-amber-400 shadow-amber-200',   pill: 'bg-amber-400 text-amber-950',          medal: '🥇' },
  silver: { ring: 'ring-4 ring-slate-400 shadow-slate-200',   pill: 'bg-slate-300 text-slate-900',          medal: '🥈' },
  bronze: { ring: 'ring-4 ring-orange-400 shadow-orange-200', pill: 'bg-orange-400 text-orange-950',        medal: '🥉' },
  novice: { ring: 'ring-2 ring-slate-300 ring-dashed',        pill: 'bg-slate-200 text-slate-700',          medal: '✨' },
};

function TierBadge({ tier, size = 'md' }) {
  const [perksMap, setPerksMap] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getTierPerks().then((m) => { if (!cancelled) setPerksMap(m); });
    return () => { cancelled = true; };
  }, []);

  // Dismiss the pop-over when tapping outside on touch devices.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  if (!tier) return null;
  const style = TIER_STYLE[tier.id] || TIER_STYLE.novice;
  const sizing = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const perks = perksMap?.[tier.id]?.perks || [];

  return (
    <span
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-testid={`tier-badge-wrap-${tier.id}`}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-full font-bold ${style.pill} ${sizing} cursor-help focus:outline-none focus:ring-2 focus:ring-amber-300`}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid={`tier-badge-${tier.id}`}
      >
        <span>{style.medal}</span>
        <span className="uppercase tracking-wider">{tier.label}</span>
      </button>
      {open && (
        <div
          role="dialog"
          data-testid={`tier-perks-card-${tier.id}`}
          className="absolute z-30 top-full left-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{style.medal}</span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-white">{tier.label} Tier</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tier.achievements_count || 0} patron tag{(tier.achievements_count || 0) === 1 ? '' : 's'} earned
                {tier.next_tier && tier.next_tier.tags_to_go > 0 && (
                  <> · {tier.next_tier.tags_to_go} to {tier.next_tier.label}</>
                )}
              </div>
            </div>
          </div>
          {perks.length > 0 ? (
            <ul className="space-y-1.5" data-testid={`tier-perks-list-${tier.id}`}>
              {perks.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading perks…</p>
          )}
          {tier.next_tier && tier.next_tier.tags_to_go > 0 && (
            <p className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
              Earn {tier.next_tier.tags_to_go} more tag{tier.next_tier.tags_to_go === 1 ? '' : 's'} to unlock {tier.next_tier.label}.
            </p>
          )}
        </div>
      )}
    </span>
  );
}

function PatronStatusCard({ fetchWithAuth }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/patron`);
        if (!res.ok) return;
        setStatus(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [fetchWithAuth]);

  if (loading || !status) return null;
  const tier = status.tier || null;
  const tierStyle = tier ? (TIER_STYLE[tier.id] || TIER_STYLE.novice) : TIER_STYLE.novice;

  if (!status.achievements?.length && !status.honors?.length) {
    return (
      <div
        className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 ${tierStyle.ring} shadow-md`}
        data-testid="patron-card-empty"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <span className="text-lg font-semibold text-slate-800 dark:text-white">Your Patron Journey</span>
          {tier && <TierBadge tier={tier} />}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Keep ordering with ${BRAND.name} and you&apos;ll earn aroma-themed patron tags — Cedar Patron, Sandalwood Sage, Oudh Master and more. Every tag is dated the moment you cross the threshold and stays with you forever.
        </p>
        {tier?.next_tier && tier.next_tier.tags_to_go > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold mt-2" data-testid="tier-progress-hint">
            {tier.next_tier.tags_to_go} more tag{tier.next_tier.tags_to_go === 1 ? '' : 's'} to reach {tier.next_tier.label}
          </p>
        )}
        {status.next_milestone && (
          <div className="mt-4">
            <NextMilestoneProgress next={status.next_milestone} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 p-5 ${tierStyle.ring} shadow-md`}
      data-testid="patron-card"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">Your Patron Tag</div>
            {tier && <TierBadge tier={tier} size="sm" />}
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white" data-testid="patron-current-tag">
            {status.current_patron_tag || 'On your way…'}
          </div>
          {tier?.next_tier && tier.next_tier.tags_to_go > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-200 mt-1" data-testid="tier-progress-hint">
              {tier.next_tier.tags_to_go} more tag{tier.next_tier.tags_to_go === 1 ? '' : 's'} to reach <b>{tier.next_tier.label}</b>
            </div>
          )}
        </div>
        {status.honors?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {status.honors.map((h) => (
              <span
                key={h.id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-900 dark:text-amber-100 text-xs font-semibold"
                title={h.reason}
                data-testid={`honor-${h.id}`}
              >
                🏆 {h.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {status.achievements.slice().reverse().map((a) => (
          <div
            key={a.milestone_id}
            className="flex items-center justify-between gap-3 py-2 border-t border-amber-200/40 dark:border-slate-700 first:border-t-0"
            data-testid={`patron-achievement-${a.milestone_id}`}
          >
            <div className="flex-1 min-w-0">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${AROMA_TONES[a.aroma_tag] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                {a.name}
              </span>
              {a.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{a.description}</p>
              )}
            </div>
            <div className="text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              earned<br/>
              <span className="font-mono">{new Date(a.achieved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        ))}
      </div>

      {status.next_milestone && <NextMilestoneProgress next={status.next_milestone} />}
      <LeaderboardOptInToggle fetchWithAuth={fetchWithAuth} />
    </div>
  );
}

function LeaderboardOptInToggle({ fetchWithAuth }) {
  const [optIn, setOptIn] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/leaderboard-opt-in`);
        if (r.ok) setOptIn((await r.json()).opt_in);
      } catch { /* silent */ }
    })();
  }, [fetchWithAuth]);

  const toggle = async () => {
    if (optIn === null) return;
    setSaving(true);
    try {
      const r = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/leaderboard-opt-in`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opt_in: !optIn }),
      });
      const d = await r.json();
      if (r.ok) setOptIn(d.opt_in);
    } finally { setSaving(false); }
  };

  if (optIn === null) return null;
  return (
    <div className="mt-4 pt-4 border-t border-amber-200/40 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap" data-testid="leaderboard-optin-toggle">
      <div className="text-xs text-slate-600 dark:text-slate-400 flex-1 min-w-0">
        <div className="font-semibold text-slate-800 dark:text-white mb-0.5">Community Leaderboard</div>
        <div>
          Show your business name + city on the public <a href="/community" className="text-amber-700 dark:text-amber-300 underline hover:no-underline">/community</a> page if you make the top-3 streak.
          <span className="text-slate-500"> Your streak count is public if opted in.</span>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
          optIn ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
        } disabled:opacity-50`}
        data-testid="leaderboard-optin-btn"
      >
        {saving ? '…' : optIn ? 'Opted In · click to opt out' : 'Opt in'}
      </button>
    </div>
  );
}

const STAT_UNIT_LABEL = {
  lifetime_orders: (n) => `${n} more order${n === 1 ? '' : 's'}`,
  lifetime_gmv_inr: (n) => `₹${Number(n).toLocaleString('en-IN')} more in purchases`,
  monthly_order_streak: (n) => `${n} more month${n === 1 ? '' : 's'} in a row`,
  active_months: (n) => `${n} more active month${n === 1 ? '' : 's'}`,
};

function NextMilestoneProgress({ next }) {
  const remaining = Math.ceil(Number(next.remaining || 0));
  const pct = Math.min(100, Math.max(0, Number(next.progress_pct || 0)));
  const label = STAT_UNIT_LABEL[next.stat]
    ? STAT_UNIT_LABEL[next.stat](remaining)
    : `${remaining} more`;

  return (
    <div
      className="mt-4 pt-4 border-t border-amber-200/40 dark:border-slate-700"
      data-testid="next-milestone-progress"
    >
      <div className="flex items-center justify-between text-sm mb-2 flex-wrap gap-1">
        <div className="text-slate-700 dark:text-slate-200">
          <span className="text-slate-500 dark:text-slate-400">Next up:</span>{' '}
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${AROMA_TONES[next.aroma_tag] || 'bg-slate-100 text-slate-800 border-slate-300'}`}
            data-testid="next-milestone-name"
          >
            {next.name}
          </span>
        </div>
        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300" data-testid="next-milestone-remaining">
          {remaining > 0 ? `${label} to go` : 'Almost there!'}
        </div>
      </div>
      <div className="h-2 w-full bg-amber-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
          data-testid="next-milestone-progress-bar"
        />
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
        <span>{Number(next.current_value).toLocaleString('en-IN')}</span>
        <span>{pct}%</span>
        <span>{Number(next.threshold).toLocaleString('en-IN')}</span>
      </div>
      {next.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">{next.description}</p>
      )}
    </div>
  );
}
