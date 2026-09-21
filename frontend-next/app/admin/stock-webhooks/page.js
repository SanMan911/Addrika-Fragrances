'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, RefreshCw, Copy, Trash2, Send, Power, PowerOff, ShieldCheck, X, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const ALL_EVENTS = ['stock.changed', 'stock.low', 'stock.out'];

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function StockWebhooksPage() {
  const [items, setItems] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState(null);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [threshold, setThreshold] = useState('1');
  const [events, setEvents] = useState([...ALL_EVENTS]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/stock-webhooks`);
      if (!res.ok) throw new Error('Failed to load webhooks');
      const data = await res.json();
      setItems(data.items || []);
      setDeliveries(data.recent_deliveries || []);
    } catch (e) {
      toast.error(e.message || 'Could not load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEvent = (ev) => {
    setEvents((cur) => (cur.includes(ev) ? cur.filter((x) => x !== ev) : [...cur, ev]));
  };

  const create = async () => {
    if (name.trim().length < 2) { toast.error('Name your webhook (e.g. Field Sales Manager)'); return; }
    if (!/^https?:\/\//i.test(url.trim())) { toast.error('Enter a valid http(s) URL'); return; }
    if (events.length === 0) { toast.error('Pick at least one event'); return; }
    setCreating(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/stock-webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), events, threshold_cartons: parseFloat(threshold) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not create webhook');
      setNewSecret({ name: data.name, secret: data.secret });
      setName(''); setUrl(''); setThreshold('1'); setEvents([...ALL_EVENTS]);
      toast.success('Webhook created — copy the signing secret now');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copy = (v) => { navigator.clipboard?.writeText(v); toast.success('Copied'); };

  const toggle = async (id, isActive) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/stock-webhooks/${id}/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      toast.success(!isActive ? 'Webhook enabled' : 'Webhook paused');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const test = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/stock-webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Test failed');
      toast.success(`Test sent — endpoint responded: ${data.last_status || 'ok'}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this webhook? Its endpoint will stop receiving events.')) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/stock-webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Webhook deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="admin-stock-webhooks-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a52] flex items-center justify-center">
            <Webhook className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a52] dark:text-slate-100">Stock Webhooks</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Push live stock changes to apps like Field Sales Manager — no polling.</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800" data-testid="webhooks-refresh">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Create */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-[#1e3a52] dark:text-slate-200 uppercase tracking-wider">Register an endpoint</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Field Sales Manager"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#1e3a52] dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-[#D4AF37] outline-none" data-testid="webhook-name-input" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/stock"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#1e3a52] dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-[#D4AF37] outline-none" data-testid="webhook-url-input" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-3">
            {ALL_EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-2 text-sm text-[#1e3a52] dark:text-slate-200 cursor-pointer" data-testid={`webhook-event-${ev}`}>
                <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} className="accent-[#D4AF37]" />
                <code className="text-xs bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">{ev}</code>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-[#1e3a52] dark:text-slate-200">
            Low-stock at
            <input type="number" min="0" step="0.5" value={threshold} onChange={(e) => setThreshold(e.target.value)}
              className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[#1e3a52] dark:text-slate-100" data-testid="webhook-threshold-input" />
            carton(s)
          </label>
          <button onClick={create} disabled={creating}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1e3a52] text-white font-semibold hover:bg-[#16293b] disabled:opacity-50 ml-auto" data-testid="webhook-create-btn">
            <Plus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Each delivery is signed — verify the <code className="bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-1 rounded">X-Addrika-Signature</code> header (HMAC-SHA256 of the body, keyed by your secret).
        </div>
      </div>

      {/* One-time secret reveal */}
      {newSecret && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5" data-testid="webhook-secret-reveal">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Copy your signing secret now — it won&rsquo;t be shown again.</p>
              <p className="text-xs text-amber-700 mb-2">Webhook: {newSecret.name}</p>
              <code className="block bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-[#1e3a52] break-all" data-testid="webhook-secret-value">{newSecret.secret}</code>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => copy(newSecret.secret)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37] text-white text-sm font-semibold" data-testid="webhook-secret-copy">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button onClick={() => setNewSecret(null)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm">
                <X className="w-4 h-4" /> Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 text-sm font-semibold text-[#1e3a52] dark:text-slate-200">
          <Webhook className="w-4 h-4" /> Registered endpoints
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm" data-testid="webhooks-empty">No webhooks yet. Register one above.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {items.map((w) => (
              <div key={w.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap" data-testid={`webhook-row-${w.id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1e3a52] dark:text-slate-100">{w.name}</span>
                    {w.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Paused</span>
                    )}
                    {w.last_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${w.last_status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>last: {w.last_status}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="break-all">{w.url}</span>
                    <span>Events: {(w.events || []).join(', ')}</span>
                    <span>Low at: {w.threshold_cartons} carton(s)</span>
                    <span>Last delivery: {fmtDate(w.last_delivery_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => test(w.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4AF37] text-[#8a6d1f] dark:text-[#D4AF37] text-sm hover:bg-amber-50 dark:hover:bg-slate-700" data-testid={`webhook-test-${w.id}`}>
                    <Send className="w-4 h-4" /> Test
                  </button>
                  <button onClick={() => toggle(w.id, w.is_active)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm hover:bg-gray-50 dark:hover:bg-slate-700" data-testid={`webhook-toggle-${w.id}`}>
                    {w.is_active ? <><PowerOff className="w-4 h-4" /> Pause</> : <><Power className="w-4 h-4" /> Enable</>}
                  </button>
                  <button onClick={() => del(w.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm hover:bg-red-50" data-testid={`webhook-delete-${w.id}`}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent deliveries */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 text-sm font-semibold text-[#1e3a52] dark:text-slate-200">
          <Activity className="w-4 h-4" /> Recent deliveries
        </div>
        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-gray-400 dark:text-slate-500 text-sm" data-testid="deliveries-empty">No deliveries yet.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">
            {deliveries.map((d) => (
              <div key={d.id} className="px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${d.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <code className="text-xs bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">{d.event}</code>
                  <span className="text-gray-600 dark:text-slate-300">{d.webhook_name}</span>
                  {d.sku_id && <span className="text-xs text-gray-400 dark:text-slate-500">{d.sku_id}</span>}
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-3">
                  <span>{d.status_code ? `HTTP ${d.status_code}` : (d.error ? 'error' : '—')}</span>
                  <span>{fmtDate(d.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
