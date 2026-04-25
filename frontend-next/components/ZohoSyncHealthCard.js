'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Cable,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { authFetch } from '../app/admin/layout';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Compact dashboard card: live Zoho connection state + sync counts +
 * a Connect/Reconnect button + a "Backfill unsynced" action.
 */
export default function ZohoSyncHealthCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/zoho/sync-health`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      /* ignored */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const connectZoho = async () => {
    try {
      setBusy(true);
      const res = await authFetch(`${API_URL}/api/admin/zoho/oauth-init`);
      const body = await res.json();
      if (body.authorize_url) {
        window.open(body.authorize_url, 'zoho_oauth', 'width=720,height=820');
        toast.message('Authorize Addrika in the popup, then return here.');
      } else {
        toast.error(body.detail || 'Could not start OAuth flow');
      }
    } catch {
      toast.error('Could not start OAuth flow');
    } finally {
      setBusy(false);
    }
  };

  const backfill = async () => {
    if (
      !confirm(
        `Push all unsynced B2B orders to Zoho?\n\nThis is idempotent — already-synced orders are skipped automatically.`
      )
    )
      return;
    try {
      setBusy(true);
      const res = await authFetch(
        `${API_URL}/api/admin/zoho/backfill?limit=200`,
        { method: 'POST' }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.detail || 'Backfill failed');
        return;
      }
      toast.success(
        `Pushed ${body.sales_orders_pushed} sales orders, ${body.payments_pushed} payments. Failed: ${body.failed}.`
      );
      load();
    } catch {
      toast.error('Backfill failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-4 flex items-center gap-3">
        <Loader2 className="animate-spin text-slate-400" size={16} />
        <span className="text-sm text-slate-500">Loading Zoho sync status…</span>
      </div>
    );
  }
  if (!data) return null;

  const connected = data.configured && data.ok;

  return (
    <div
      className="rounded-xl border bg-white dark:bg-slate-800 p-4 mb-4"
      style={{
        borderColor: connected ? '#10b98144' : data.configured ? '#f59e0b66' : '#cbd5e1',
      }}
      data-testid="zoho-sync-health"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2 rounded-lg"
            style={{
              background: connected
                ? '#d1fae5'
                : data.configured
                ? '#fef3c7'
                : '#f1f5f9',
              color: connected ? '#059669' : data.configured ? '#b45309' : '#475569',
            }}
          >
            <Activity size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2">
              Zoho Books · Sync Health
              {connected ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : data.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle size={12} /> Configured · ping failed
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  Not connected
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {data.org_id ? `Org ${data.org_id} · ${data.region?.toUpperCase()}` : 'No org configured yet'}
              {data.last_sync && (
                <>
                  {' · last sync '}
                  {new Date(data.last_sync.zoho_synced_at).toLocaleString()}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <button
                onClick={backfill}
                disabled={busy || data.pending_sales_orders === 0}
                className="text-xs px-3 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="zoho-backfill-button"
                title={
                  data.pending_sales_orders === 0
                    ? 'No pending orders to sync'
                    : `Push ${data.pending_sales_orders} unsynced order(s) to Zoho`
                }
              >
                <RefreshCw size={12} /> Backfill ({data.pending_sales_orders})
              </button>
              <button
                onClick={connectZoho}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="zoho-reconnect-btn"
              >
                <Cable size={12} /> Re-auth
              </button>
            </>
          ) : (
            <button
              onClick={connectZoho}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1"
              data-testid="zoho-connect-btn"
            >
              <Cable size={12} /> {data.configured ? 'Reconnect' : 'Connect to Zoho'}
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <Stat label="Synced SOs" value={data.synced_sales_orders} tone="emerald" />
        <Stat
          label="Pending SOs"
          value={data.pending_sales_orders}
          tone={data.pending_sales_orders > 0 ? 'amber' : 'slate'}
        />
        <Stat label="Synced Payments" value={data.synced_payments} tone="emerald" />
        <Stat
          label="Open Errors"
          value={data.unresolved_errors}
          tone={data.unresolved_errors > 0 ? 'red' : 'slate'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'slate' }) {
  const toneMap = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
    slate: 'text-slate-700 dark:text-slate-200',
  };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${toneMap[tone]}`}>{value ?? 0}</p>
    </div>
  );
}
