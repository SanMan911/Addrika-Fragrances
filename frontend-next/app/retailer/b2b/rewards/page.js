'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, ArrowUpRight, ArrowDownLeft, Sparkles, Info, Clock, Download } from 'lucide-react';
import { useRetailerAuth } from '../../../../context/RetailerAuthContext';
import RewardsBalanceCard from '../../../../components/RewardsBalanceCard';

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
      a.download = `addrika-rewards-statement.pdf`;
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
