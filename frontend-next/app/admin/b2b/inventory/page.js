'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Boxes, Plus, Minus, RefreshCw, History, Package, AlertTriangle, Send, Sparkles, Download, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';
import NudgeComposerModal from '../../../../components/NudgeComposerModal';
import BRAND from '../../../../lib/brand.config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const REASONS = [
  { key: 'restock', label: 'Restock (new batch received)' },
  { key: 'damage', label: 'Damage / spoilt goods' },
  { key: 'return', label: 'Retailer return' },
  { key: 'offline_sale', label: 'Offline sale (deduct)' },
  { key: 'correction', label: 'Correction' },
  { key: 'manual_adjust', label: 'Manual adjust' },
];

const STOCK_STATUSES = [
  { key: 'in_stock', label: 'In Stock', tone: 'emerald' },
  { key: 'out_of_stock', label: 'Out of Stock — Restocking in Progress', tone: 'rose' },
  { key: 'restocking', label: 'Restocking in Progress', tone: 'rose' },
  { key: 'manufacturing', label: 'Manufacturing in Progress', tone: 'amber' },
  { key: 'delayed', label: 'Delayed', tone: 'amber' },
];

export default function AdminB2BInventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultPpc, setDefaultPpc] = useState(32);
  const [activeAdjust, setActiveAdjust] = useState(null); // product id being adjusted
  const [activeStatus, setActiveStatus] = useState(null); // product id being status-edited
  const [historyFor, setHistoryFor] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [csvFilterOpen, setCsvFilterOpen] = useState(false);
  const [csvProductId, setCsvProductId] = useState('');
  const [csvFrom, setCsvFrom] = useState('');
  const [csvTo, setCsvTo] = useState('');
  const [syncHealth, setSyncHealth] = useState(null);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);

  const fetchSyncHealth = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/sync-health`);
      if (!res.ok) return;
      setSyncHealth(await res.json());
    } catch (e) { /* silent */ }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setItems(data.items || []);
      setDefaultPpc(data.default_pieces_per_carton || 32);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); fetchSyncHealth(); }, [fetchInventory, fetchSyncHealth]);

  const openHistory = async (id) => {
    setHistoryFor(id);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/${id}/log?limit=25`);
      const data = await res.json();
      setHistoryRows(data.entries || []);
    } catch (e) {
      toast.error('Failed to load history');
    }
  };

  const sendDigest = async () => {
    setSendingDigest(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/low-stock/send-digest`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Failed');
      if (data.sent) toast.success(`Low-stock digest emailed (${data.count} SKUs)`);
      else toast.info(data.skipped_reason ? `Skipped: ${data.skipped_reason}` : 'Nothing to send');
    } catch (e) {
      toast.error(e.message || 'Digest failed');
    }
    setSendingDigest(false);
  };

  const downloadLogCsv = async () => {
    try {
      const qs = new URLSearchParams();
      if (csvProductId) qs.set('product_id', csvProductId);
      if (csvFrom) qs.set('from_date', csvFrom);
      if (csvTo) qs.set('to_date', csvTo);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/log/export.csv${suffix}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `addrika-inventory-log-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Inventory log downloaded');
      setCsvFilterOpen(false);
    } catch (e) {
      toast.error(e.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-b2b-inventory">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/b2b" className="text-slate-500 hover:text-slate-800 dark:text-slate-400" data-testid="link-back-b2b">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Boxes size={24} className="text-purple-600" /> B2B Inventory
              {syncHealth && (
                <button
                  type="button"
                  onClick={() => setSyncPanelOpen(true)}
                  className={`ml-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    syncHealth.healthy
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 animate-pulse'
                  }`}
                  data-testid="sync-health-pill"
                  title={
                    syncHealth.healthy
                      ? 'Every B2C size has a linked B2B SKU. Storefront and wholesale inventory are in lock-step.'
                      : `${syncHealth.counts.drifted} product(s) with missing B2B SKUs. Click for details.`
                  }
                >
                  {syncHealth.healthy ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {syncHealth.healthy ? 'Sync OK' : `${syncHealth.counts.drifted} drifted`}
                </button>
              )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Piece-level stock &middot; Bakhoor/Dhoop 32/carton &middot; Agarbatti Jar 16/carton &middot; Agarbatti packets 12/dozen &middot; deducts on paid orders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => setCsvFilterOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 text-sm"
          data-testid="export-inventory-csv-btn"
          title="Download the full change-log for accountants + audits"
        >
          <Download size={14} /> Export Log (CSV)
        </button>
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-800 dark:text-fuchsia-300 hover:bg-fuchsia-200"
          data-testid="open-nudge-composer-btn"
          title="Compose a promotional/festive/price-drop nudge"
        >
          <Sparkles size={14} /> Compose Nudge
        </button>
        <button
          onClick={sendDigest}
          disabled={sendingDigest}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 disabled:opacity-50"
          data-testid="send-digest-btn"
          title={`Email low-stock digest to ${BRAND.name} ops now`}
        >
          <Send size={14} /> {sendingDigest ? 'Sending…' : 'Send Low-Stock Digest'}
        </button>
        <button
          onClick={fetchInventory}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          data-testid="refresh-inventory-btn"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        </div>
      </div>

      {csvFilterOpen && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
          data-testid="csv-filter-panel">
          <div className="text-sm font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
            <Download size={14} /> Slice the audit trail before download
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Product (optional)
              </label>
              <select
                value={csvProductId}
                onChange={(e) => setCsvProductId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm"
                data-testid="csv-filter-product"
              >
                <option value="">All products</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.name} · {it.net_weight}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From (date)</label>
              <input
                type="date" value={csvFrom} onChange={(e) => setCsvFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm"
                data-testid="csv-filter-from"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To (date)</label>
              <input
                type="date" value={csvTo} onChange={(e) => setCsvTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm"
                data-testid="csv-filter-to"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={downloadLogCsv}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90"
                data-testid="csv-download-btn"
              >
                Download CSV
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Tip: leave filters blank for the full log. Dates use YYYY-MM-DD (server compares against `created_at` ISO strings).
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No B2B products yet. Add SKUs from the catalog page first.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-left">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Carton (pcs)</th>
                <th className="px-4 py-3 text-right">Stock (pieces)</th>
                <th className="px-4 py-3 text-right">Stock (cartons)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700" data-testid={`inventory-row-${it.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-white">{it.name}</div>
                    <div className="text-xs text-slate-500">{it.id} &middot; {it.net_weight}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{it.pieces_per_carton}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-white" data-testid={`stock-pieces-${it.id}`}>
                    {it.stock_pieces.toLocaleString('en-IN')}
                    {it.stock_pieces < it.pieces_per_carton && (
                      <span className="ml-2 text-xs text-amber-600">low</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{it.stock_cartons}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setActiveStatus(it)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100 text-xs font-medium mr-2"
                      data-testid={`status-btn-${it.id}`}
                    >
                      <AlertTriangle size={12} /> Status
                    </button>
                    <button
                      onClick={() => setActiveAdjust(it)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 text-xs font-medium mr-2"
                      data-testid={`adjust-btn-${it.id}`}
                    >
                      <Plus size={12} /> Adjust
                    </button>
                    <button
                      onClick={() => openHistory(it.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-medium"
                      data-testid={`history-btn-${it.id}`}
                    >
                      <History size={12} /> Log
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeAdjust && (
        <AdjustModal
          product={activeAdjust}
          onClose={() => setActiveAdjust(null)}
          onSaved={() => {
            setActiveAdjust(null);
            fetchInventory();
          }}
        />
      )}

      {activeStatus && (
        <StatusModal
          product={activeStatus}
          onClose={() => setActiveStatus(null)}
          onSaved={() => { setActiveStatus(null); fetchInventory(); }}
        />
      )}

      {historyFor && (
        <HistoryModal
          productId={historyFor}
          rows={historyRows}
          onClose={() => { setHistoryFor(null); setHistoryRows([]); }}
        />
      )}

      <NudgeComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        products={items}
      />

      {syncPanelOpen && syncHealth && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSyncPanelOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="sync-health-panel"
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {syncHealth.healthy ? (
                    <><CheckCircle2 size={20} className="text-emerald-600" /> Storefront ↔ Wholesale sync is healthy</>
                  ) : (
                    <><XCircle size={20} className="text-rose-600" /> Sync drift detected</>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {syncHealth.counts.b2c_products} B2C products · {syncHealth.counts.b2b_skus} B2B SKUs · {syncHealth.counts.in_sync} in sync
                </p>
              </div>
              <button onClick={() => setSyncPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {syncHealth.drift.length > 0 && (
                <div>
                  <h4 className="font-semibold text-rose-700 dark:text-rose-300 mb-2">Missing B2B SKUs ({syncHealth.drift.length})</h4>
                  <ul className="space-y-2">
                    {syncHealth.drift.map((d) => (
                      <li key={d.product_id} className="bg-rose-50 dark:bg-rose-900/20 rounded p-2">
                        <div className="font-medium text-slate-800 dark:text-white">{d.name}</div>
                        <div className="text-xs text-slate-500">Missing size(s): {d.missing_sizes.join(', ')}</div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mt-2">
                    Fix: open <b>Admin → Products</b>, edit the product and hit Save. The linked B2B SKU is auto-created from the B2C definition.
                  </p>
                </div>
              )}
              {syncHealth.orphaned.length > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">Orphaned B2B SKUs ({syncHealth.orphaned.length})</h4>
                  <p className="text-xs text-slate-500 mb-2">
                    These wholesale SKUs have no matching B2C product. Usually harmless (wholesale-only variants like the Ready-to-Use Dhoop packs) — flagged so you can spot true leftovers.
                  </p>
                  <ul className="space-y-1 text-xs">
                    {syncHealth.orphaned.map((o) => (
                      <li key={o.id} className="text-slate-600 dark:text-slate-300">
                        <span className="font-mono">{o.id}</span> — {o.name} · {o.net_weight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {syncHealth.healthy && (
                <p className="text-emerald-700 dark:text-emerald-300 text-sm">
                  Every B2C storefront size has a matching wholesale SKU. New sales on either channel deduct from the same pool.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function AdjustModal({ product, onClose, onSaved }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (sign) => {
    const n = Math.abs(parseInt(delta, 10) || 0);
    if (n <= 0) {
      toast.error('Enter a positive number of pieces');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/${product.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta_pieces: sign * n, reason, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Failed');
      toast.success(`Stock updated: ${data.before} → ${data.after} pieces`);
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Failed to adjust');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        data-testid="adjust-modal"
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
          <Package size={18} /> Adjust: {product.name}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Current: {product.stock_pieces} pcs ({product.stock_cartons} cartons). 1 carton = {product.pieces_per_carton} pieces.
        </p>

        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pieces</label>
        <input
          type="number"
          min="1"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="e.g. 32"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-3"
          data-testid="adjust-delta-input"
        />

        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-3"
          data-testid="adjust-reason-select"
        >
          {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>

        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Damaged in transit"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-5"
          data-testid="adjust-note-input"
        />

        <div className="flex gap-2">
          <button
            disabled={saving}
            onClick={() => submit(+1)}
            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="add-stock-btn"
          >
            <Plus size={16} /> Add
          </button>
          <button
            disabled={saving}
            onClick={() => submit(-1)}
            className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="deduct-stock-btn"
          >
            <Minus size={16} /> Deduct
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          data-testid="adjust-cancel-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


function HistoryModal({ productId, rows, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="history-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History size={18} /> Inventory Log · {productId}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800" data-testid="history-close-btn">✕</button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No adjustments yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="py-2">When</th>
                <th className="py-2">Δ pieces</th>
                <th className="py-2">Reason</th>
                <th className="py-2 text-right">Before → After</th>
                <th className="py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-slate-700">
                  <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                  <td className={`py-2 font-mono ${r.delta_pieces > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {r.delta_pieces > 0 ? `+${r.delta_pieces}` : r.delta_pieces}
                  </td>
                  <td className="py-2">{r.reason}{r.note ? <span className="block text-[10px] text-slate-500">{r.note}</span> : null}</td>
                  <td className="py-2 text-right font-mono">{r.before} → {r.after}</td>
                  <td className="py-2 text-slate-500">{r.admin_email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


function StatusModal({ product, onClose, onSaved }) {
  const [status, setStatus] = useState(product.stock_status || (product.stock_pieces > 0 ? 'in_stock' : 'out_of_stock'));
  const [etaDays, setEtaDays] = useState(product.restock_eta_days || 15);
  const [note, setNote] = useState(product.restock_note || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/${product.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          eta_days: status === 'in_stock' ? null : parseInt(etaDays, 10) || 0,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Failed');
      toast.success(`Status updated to "${status}"`);
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        data-testid="status-modal"
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
          <AlertTriangle size={18} /> Stock Status · {product.name}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Controls whether retailers can order this SKU. Shown on the storefront as a pill (e.g. &quot;Out of Stock · ETA 15 days&quot;).
        </p>

        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-3"
          data-testid="status-select"
        >
          {STOCK_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {status !== 'in_stock' && (
          <>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Available ETA (days)
            </label>
            <input
              type="number" min="0" max="365"
              value={etaDays}
              onChange={(e) => setEtaDays(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-3"
              data-testid="status-eta-input"
            />
          </>
        )}

        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Batch #B12 in press · dispatch by 25 Feb"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white mb-5"
          data-testid="status-note-input"
        />

        <div className="flex gap-2">
          <button
            disabled={saving}
            onClick={save}
            className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
            data-testid="status-save-btn"
          >
            {saving ? 'Saving…' : 'Save Status'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            data-testid="status-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
