'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, ExternalLink, AlertTriangle, CheckCircle2,
  XCircle, Clock, HelpCircle, CreditCard,
} from 'lucide-react';
import { useAdmin, authFetch } from '../../layout';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

// Map live-status → visual treatment
const STATUS_MAP = {
  healthy:       { label: 'Healthy',            colour: '#10b981', Icon: CheckCircle2 },
  exhausted:     { label: 'Credits Exhausted',  colour: '#ef4444', Icon: XCircle },
  auth_error:    { label: 'Auth Error',         colour: '#f97316', Icon: AlertTriangle },
  needs_oauth:   { label: 'Needs OAuth Setup',  colour: '#f59e0b', Icon: AlertTriangle },
  rate_limited:  { label: 'Rate Limited',       colour: '#f59e0b', Icon: Clock },
  network_error: { label: 'Network Error',      colour: '#dc2626', Icon: XCircle },
  unconfigured:  { label: 'Not Configured',     colour: '#6b7280', Icon: HelpCircle },
  unknown:       { label: 'Unknown',            colour: '#6b7280', Icon: HelpCircle },
};

const formatRelative = (iso) => {
  if (!iso) return '—';
  const delta = (Date.now() - new Date(iso).getTime()) / 1000;
  if (delta < 60) return `${Math.round(delta)}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
};


function ProviderCard({ p, onRefresh }) {
  const live = p.live || {};
  const hist = p.history_30d || {};
  const meta = STATUS_MAP[live.status] || STATUS_MAP.unknown;
  const { Icon } = meta;

  const successRate = (() => {
    const total = hist.calls_30d || 0;
    const ok = hist.by_outcome_30d?.success || 0;
    if (!total) return null;
    return Math.round((ok / total) * 100);
  })();

  return (
    <div
      data-testid={`provider-card-${p.id}`}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate">
            {p.label}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {p.uses}
          </p>
        </div>
        <div
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            background: `${meta.colour}15`,
            color: meta.colour,
            border: `1px solid ${meta.colour}40`,
          }}
        >
          <Icon size={12} />
          {meta.label}
        </div>
      </div>

      {/* Live probe message */}
      {live.message && (
        <div
          className="text-[11px] leading-relaxed px-3 py-2 rounded-lg mb-4"
          style={{
            background: live.status === 'healthy'
              ? 'rgba(16,185,129,0.08)'
              : 'rgba(239,68,68,0.08)',
            color: live.status === 'healthy' ? '#065f46' : '#7f1d1d',
            border: `1px solid ${meta.colour}30`,
          }}
        >
          {live.message}
        </div>
      )}

      {/* 30-day stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Calls (30d)
          </p>
          <p className="text-lg font-bold text-slate-800 dark:text-white">
            {hist.calls_30d ?? 0}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Success %
          </p>
          <p className="text-lg font-bold text-slate-800 dark:text-white">
            {successRate != null ? `${successRate}%` : '—'}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Last Success
          </p>
          <p className="text-lg font-bold text-slate-800 dark:text-white">
            {formatRelative(hist.last_success_at)}
          </p>
        </div>
      </div>

      {/* Last error */}
      {hist.last_error && (
        <div className="text-xs rounded-lg px-3 py-2 mb-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
          <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
            Last error · {formatRelative(hist.last_error.at)}
          </div>
          <div className="text-red-600 dark:text-red-200 break-words">
            <span className="opacity-70">{hist.last_error.endpoint}:</span>{' '}
            {hist.last_error.note || hist.last_error.outcome}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
        <a
          href={p.recharge_url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`provider-recharge-${p.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-900 hover:-translate-y-0.5 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #f0c849, #d4af37)',
          }}
        >
          <CreditCard size={12} />
          Recharge
        </a>
        <a
          href={p.dashboard_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <ExternalLink size={12} />
          Provider Dashboard
        </a>
      </div>
    </div>
  );
}


export default function ProviderBalancesPage() {
  useAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const r = await authFetch(`${API_URL}/api/admin/provider-balances`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 90 s so the card stays fresh without spamming probes.
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto" data-testid="provider-balances-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Provider Balances
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live status, 30-day usage, and one-click top-up for every paid API.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          data-testid="provider-balances-refresh"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={refreshing ? 'animate-spin' : ''}
          />
          {refreshing ? 'Probing…' : 'Refresh now'}
        </button>
      </div>

      {loading && (
        <div className="text-center py-20 text-slate-500">
          <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
          Loading provider health…
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 bg-red-50 border border-red-200 text-red-700 mb-6">
          Could not load provider balances: {error}
        </div>
      )}

      {data?.providers && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.providers.map((p) => (
              <ProviderCard key={p.id} p={p} onRefresh={load} />
            ))}
          </div>
          <p className="mt-6 text-[11px] text-slate-400">
            Last refreshed: {new Date(data.generated_at).toLocaleTimeString()}{' '}
            · Live probes run on every refresh · Usage rolled from the past 30 days.
          </p>
        </>
      )}
    </div>
  );
}
