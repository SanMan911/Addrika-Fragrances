'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase, RefreshCw, Package, Eye, UserPlus, BarChart3, Boxes, TrendingUp,
  Smartphone, Globe, Users, BadgeCheck, Ban, Link2, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const ORDER_STATUSES = ['ordered', 'confirmed', 'processing', 'packaging', 'shipped', 'delivered', 'returned', 'modified', 'cancelled'];

const statusColors = {
  ordered: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  processing: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  packaging: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  modified: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const channelMeta = {
  web: { label: 'Web portal', Icon: Globe, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  mobile: { label: 'Aaroviah app', Icon: Smartphone, cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  fsm: { label: 'Field Sales', Icon: Users, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
};

const paymentLabel = (o) => {
  if (o.payment_status === 'paid') return { text: `Paid${o.offline_payment_method ? ` · ${o.offline_payment_method}` : ''}`, cls: 'text-emerald-700 dark:text-emerald-400' };
  if (o.payment_method === 'razorpay_link') return { text: o.payment_link_url ? 'Payment link sent' : 'Link failed — collect offline', cls: 'text-amber-700 dark:text-amber-400' };
  if (o.payment_method === 'online') return { text: 'Awaiting online payment', cls: 'text-amber-700 dark:text-amber-400' };
  return { text: 'Pay later / credit — unpaid', cls: 'text-rose-700 dark:text-rose-400' };
};

function ChannelBadge({ channel }) {
  const m = channelMeta[channel] || channelMeta.web;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`} data-testid="order-channel-badge">
      <m.Icon size={12} /> {m.label}
    </span>
  );
}

function MarkPaidModal({ order, onClose, onDone }) {
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/orders/${order.order_id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, reference: reference || null, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not record payment');
      toast.success(`Payment recorded for ${order.order_id}`);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="mark-paid-modal">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Record offline payment</h3>
          <p className="text-sm text-slate-500">{order.order_id} · {formatCurrency(order.grand_total)}</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="mark-paid-method">
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer (NEFT/IMPS)</option>
            <option value="cheque">Cheque</option>
            <option value="credit_settled">Credit settled</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Reference / UTR (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="mark-paid-reference" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="mark-paid-note" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300" data-testid="mark-paid-cancel">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50" data-testid="mark-paid-submit">
            {busy ? 'Saving…' : 'Confirm payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="order-detail-modal">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{order.order_id}</h3>
            <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" data-testid="order-detail-close">✕</button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-slate-500">Retailer</p><p className="font-medium text-slate-800 dark:text-white">{order.retailer_name}</p><p className="text-xs text-slate-500">{order.retailer_id}</p></div>
            <div><p className="text-slate-500">Channel</p><ChannelBadge channel={order.channel} />{order.placed_by?.name && <p className="text-xs text-slate-500 mt-1">by {order.placed_by.name}</p>}</div>
            <div><p className="text-slate-500">GSTIN</p><p className="font-medium text-slate-800 dark:text-white">{order.retailer_gst || '—'}</p></div>
            <div><p className="text-slate-500">Delivery pincode</p><p className="font-medium text-slate-800 dark:text-white">{order.delivery_pincode || '—'}</p></div>
          </div>
          <div>
            <p className="text-slate-500 mb-2">Items</p>
            <div className="space-y-2">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">{item.name} <span className="text-slate-500">{item.net_weight}</span></p>
                    <p className="text-xs text-slate-500">{item.quantity_boxes} carton(s) · {item.tier_discount_percent ? `${item.tier_discount_percent}% tier off` : 'base price'}</p>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-white">{formatCurrency(item.line_total)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.total_discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discounts</span><span>−{formatCurrency(order.total_discount)}</span></div>}
            <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>GST</span><span>{formatCurrency(order.gst_total)}</span></div>
            {order.shipping_charges > 0 && <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Shipping</span><span>{formatCurrency(order.shipping_charges)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-slate-800 dark:text-white pt-1"><span>Grand total</span><span>{formatCurrency(order.grand_total)}</span></div>
          </div>
          {order.payment_link_url && (
            <a href={order.payment_link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#1e3a52] dark:text-[#D4AF37] underline" data-testid="order-payment-link">
              <Link2 size={14} /> Razorpay payment link
            </a>
          )}
          {order.notes && <p className="text-slate-600 dark:text-slate-300"><span className="text-slate-500">Notes:</span> {order.notes}</p>}
          <div>
            <p className="text-slate-500 mb-1">History</p>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {(order.status_history || []).map((h, i) => (
                <li key={i}>{new Date(h.timestamp).toLocaleString()} — <span className="font-medium">{h.status}</span>{h.note ? ` · ${h.note}` : ''}{h.updated_by ? ` (${h.updated_by})` : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminB2BPage() {
  const [orders, setOrders] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [payingOrder, setPayingOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (paymentFilter) params.set('payment_status', paymentFilter);
      params.set('limit', '100');
      const res = await authFetch(`${API_URL}/api/admin/b2b/orders?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setOrders(data.orders || []);
      setStatusCounts(data.status_counts || {});
    } catch (error) {
      console.error('Failed to fetch B2B orders:', error);
      toast.error('Failed to load B2B orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, paymentFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    let note = null;
    if (newStatus === 'cancelled') {
      note = window.prompt('Cancellation reason (reserved stock will be released):', 'Cancelled by admin');
      if (note === null) return;
    }
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update status');
      toast.success(`Order ${orderId} → ${newStatus}`);
      fetchOrders();
    } catch (error) {
      toast.error(error.message || 'Failed to update order status');
    }
  };

  const totalOrders = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6" data-testid="admin-b2b-orders-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">B2B Wholesale Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1" data-testid="b2b-orders-count">
            {orders.length} shown · {totalOrders} total across web, Aaroviah app and Field Sales
          </p>
        </div>
        <button onClick={fetchOrders} disabled={loading} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="b2b-orders-refresh">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/b2b/waitlist" className="px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 hover:bg-blue-100 text-sm font-medium flex items-center gap-2" data-testid="link-waitlist"><UserPlus size={16} /> Retailer Waitlist</Link>
        <Link href="/admin/b2b/catalog" className="px-4 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 hover:bg-purple-100 text-sm font-medium flex items-center gap-2" data-testid="link-b2b-catalog"><Boxes size={16} /> B2B Catalog</Link>
        <Link href="/admin/b2b/inventory" className="px-4 py-2 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 hover:bg-fuchsia-100 text-sm font-medium flex items-center gap-2" data-testid="link-b2b-inventory"><Package size={16} /> Inventory (cartons)</Link>
        <Link href="/admin/b2b/preorders" className="px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 hover:bg-rose-100 text-sm font-medium flex items-center gap-2" data-testid="link-b2b-preorders"><TrendingUp size={16} /> Batch Allocation</Link>
        <Link href="/admin/b2b/reports" className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 hover:bg-emerald-100 text-sm font-medium flex items-center gap-2" data-testid="link-reports"><BarChart3 size={16} /> Sales Reports</Link>
        <Link href="/admin/api-keys" className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-sm font-medium flex items-center gap-2" data-testid="link-api-keys"><Users size={16} /> Field Sales API</Link>
        <Link href="/admin/settings/b2b" className="px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-100 text-sm font-medium flex items-center gap-2" data-testid="link-b2b-settings-from-orders"><Briefcase size={16} /> B2B Settings</Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="b2b-filter-status">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}{statusCounts[s] != null ? ` (${statusCounts[s]})` : ''}</option>)}
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="b2b-filter-channel">
          <option value="">All channels</option>
          <option value="web">Web portal</option>
          <option value="mobile">Aaroviah app</option>
          <option value="fsm">Field Sales</option>
        </select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" data-testid="b2b-filter-payment">
          <option value="">Any payment state</option>
          <option value="pending">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-slate-400" size={32} /></div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const pay = paymentLabel(order);
            const canMarkPaid = order.payment_status !== 'paid' && order.order_status !== 'cancelled';
            const canCancel = ['ordered', 'confirmed', 'processing', 'modified'].includes(order.order_status);
            return (
              <div key={order.order_id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6" data-testid={`b2b-order-${order.order_id}`}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center"><Briefcase size={20} className="text-indigo-600" /></div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white">{order.retailer_name}</h3>
                      <p className="text-sm text-slate-500 font-mono">{order.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ChannelBadge channel={order.channel} />
                    {order.is_preorder && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Pre-order</span>}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.order_status] || statusColors.ordered}`} data-testid="order-status-badge">
                      {(order.order_status || 'ordered').toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4 text-sm">
                  <div><p className="text-slate-500">Items</p><p className="font-medium text-slate-800 dark:text-white">{order.items?.length || 0}</p></div>
                  <div><p className="text-slate-500">Cartons</p><p className="font-medium text-slate-800 dark:text-white">{(order.items || []).reduce((s, i) => s + (Number(i.quantity_boxes) || 0), 0)}</p></div>
                  <div><p className="text-slate-500">Grand total</p><p className="font-medium text-slate-800 dark:text-white">{formatCurrency(order.grand_total)}</p></div>
                  <div><p className="text-slate-500">Payment</p><p className={`font-medium ${pay.cls}`} data-testid="order-payment-state">{pay.text}</p></div>
                  <div><p className="text-slate-500">Placed</p><p className="font-medium text-slate-800 dark:text-white">{new Date(order.created_at).toLocaleDateString()}</p></div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700 flex-wrap">
                  <select
                    value={order.order_status}
                    onChange={(e) => handleStatusUpdate(order.order_id, e.target.value)}
                    disabled={order.order_status === 'cancelled'}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm disabled:opacity-50"
                    data-testid="order-status-select"
                  >
                    {ORDER_STATUSES.filter((s) => s !== 'cancelled').map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {canMarkPaid && (
                    <button onClick={() => setPayingOrder(order)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200" data-testid="order-mark-paid-btn">
                      <BadgeCheck size={14} /> Mark paid
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={() => handleStatusUpdate(order.order_id, 'cancelled')} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200" data-testid="order-cancel-btn">
                      <Ban size={14} /> Cancel
                    </button>
                  )}
                  <a href={`${API_URL}/api/admin/b2b/orders/${order.order_id}/invoice.pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200" data-testid="order-invoice-link">
                    <FileText size={14} /> Invoice
                  </a>
                  <button onClick={() => setSelectedOrder(order)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200" data-testid="order-view-btn">
                    <Eye size={14} /> Details
                  </button>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400" data-testid="b2b-orders-empty">
              No B2B orders match these filters
            </div>
          )}
        </div>
      )}

      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      {payingOrder && <MarkPaidModal order={payingOrder} onClose={() => setPayingOrder(null)} onDone={() => { setPayingOrder(null); fetchOrders(); }} />}
    </div>
  );
}
