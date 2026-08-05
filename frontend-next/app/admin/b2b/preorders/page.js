'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Boxes, RefreshCw, TrendingUp, ChevronDown, ChevronRight, Users, Wallet, Package } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(n || 0);

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—';

export default function AdminBatchAllocationPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [expandedSku, setExpandedSku] = useState(null);
  const [detailRows, setDetailRows] = useState({}); // { product_id: [{order_id,...}] }
  const [detailLoading, setDetailLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/preorders/batch-allocation`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.skus || []);
      setTotals(data.totals || null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load batch allocation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (pid) => {
    if (expandedSku === pid) {
      setExpandedSku(null);
      return;
    }
    setExpandedSku(pid);
    if (detailRows[pid]) return;
    setDetailLoading(pid);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/preorders/by-sku/${encodeURIComponent(pid)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailRows((prev) => ({ ...prev, [pid]: data.orders || [] }));
    } catch (e) {
      toast.error(`Failed to load pre-orders for ${pid}`);
    } finally {
      setDetailLoading(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-batch-allocation-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/b2b"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            data-testid="link-back-to-b2b"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Boxes size={22} className="text-fuchsia-600" /> Pre-Order Batch Allocation
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Outstanding paid pre-orders grouped by SKU — prioritize the next production run.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          data-testid="btn-refresh-batch-allocation"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SummaryCard label="Outstanding Orders" value={totals.orders} icon={Package} tone="indigo" testid="stat-orders" />
          <SummaryCard label="Unique Retailers" value={totals.retailers} icon={Users} tone="cyan" testid="stat-retailers" />
          <SummaryCard label="Pieces Booked" value={totals.pieces?.toLocaleString('en-IN')} icon={TrendingUp} tone="fuchsia" testid="stat-pieces" />
          <SummaryCard label="Token Paid" value={inr(totals.token_paid_inr)} icon={Wallet} tone="emerald" testid="stat-token" />
          <SummaryCard label="Balance Due" value={inr(totals.balance_due_inr)} icon={Wallet} tone="amber" testid="stat-balance" />
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <Boxes size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            No outstanding pre-orders right now. When retailers pay a 50% token on an out-of-stock SKU they&apos;ll show up here.
          </p>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-batch-allocation">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 text-left">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Pieces</th>
                  <th className="px-4 py-3 text-right">Boxes</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Retailers</th>
                  <th className="px-4 py-3 text-right">Token Paid</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3">Current Stock</th>
                  <th className="px-4 py-3">First Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map((r) => {
                  const isExpanded = expandedSku === r.product_id;
                  return (
                    <RowFragment
                      key={r.product_id}
                      row={r}
                      isExpanded={isExpanded}
                      detailLoading={detailLoading}
                      detailRows={detailRows}
                      onToggle={() => toggleExpand(r.product_id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RowFragment({ row, isExpanded, detailLoading, detailRows, onToggle }) {
  const r = row;
  return (
    <>
      <tr
        className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
        onClick={onToggle}
        data-testid={`row-sku-${r.product_id}`}
      >
        <td className="px-4 py-3">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-slate-800 dark:text-white">{r.name}</div>
          <div className="text-xs text-slate-500">
            {r.category || '—'} · {r.pieces_per_carton || '?'} pcs/carton
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">
          {r.pieces_booked?.toLocaleString('en-IN')}
        </td>
        <td className="px-4 py-3 text-right">{r.boxes_booked}</td>
        <td className="px-4 py-3 text-right">{r.preorders_count}</td>
        <td className="px-4 py-3 text-right">{r.retailers_count}</td>
        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-medium">
          {inr(r.token_paid_inr)}
        </td>
        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
          {inr(r.balance_due_inr)}
        </td>
        <td className="px-4 py-3">
          <StockBadge status={r.stock_status} pieces={r.current_stock_pieces} />
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(r.first_booked_at)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} className="bg-slate-50 dark:bg-slate-900/40 px-6 py-4">
            {detailLoading === r.product_id ? (
              <div className="text-center text-slate-500 py-4">
                <RefreshCw size={16} className="inline animate-spin mr-2" />
                Loading pre-orders…
              </div>
            ) : (
              <SkuDrilldown rows={detailRows[r.product_id] || []} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, testid }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  };
  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
      data-testid={testid}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${tones[tone] || tones.indigo}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800 dark:text-white">{value ?? '—'}</div>
    </div>
  );
}

function StockBadge({ status, pieces }) {
  const norm = (status || '').toLowerCase();
  const label = norm === 'in_stock' ? `${pieces} pcs`
    : norm === 'out_of_stock' ? 'Out of Stock'
    : norm.replace(/_/g, ' ') || 'Unknown';
  const tone = norm === 'in_stock'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function SkuDrilldown({ rows }) {
  if (!rows.length) {
    return <div className="text-slate-500 text-sm">No line items for this SKU.</div>;
  }
  return (
    <div className="overflow-x-auto" data-testid="drilldown-sku">
      <table className="w-full text-xs">
        <thead className="text-slate-500">
          <tr className="text-left">
            <th className="pb-2">Order ID</th>
            <th className="pb-2">Retailer</th>
            <th className="pb-2">Phone</th>
            <th className="pb-2 text-right">Boxes</th>
            <th className="pb-2 text-right">Pieces</th>
            <th className="pb-2 text-right">Token</th>
            <th className="pb-2 text-right">Balance</th>
            <th className="pb-2">Booked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((r) => (
            <tr key={r.order_id} className="text-slate-700 dark:text-slate-200">
              <td className="py-2 font-mono">{r.order_id}</td>
              <td className="py-2">{r.business_name || r.retailer_email || r.retailer_id}</td>
              <td className="py-2">{r.retailer_phone || '—'}</td>
              <td className="py-2 text-right">{r.quantity_boxes}</td>
              <td className="py-2 text-right">{r.pieces}</td>
              <td className="py-2 text-right text-emerald-700 dark:text-emerald-400">{inr(r.order_token_inr)}</td>
              <td className="py-2 text-right text-amber-700 dark:text-amber-400">{inr(r.order_balance_due_inr)}</td>
              <td className="py-2 text-slate-500">{fmtDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
