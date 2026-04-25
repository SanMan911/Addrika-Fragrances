'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Receipt, Headset, Package, Upload, Download, Trash2,
  Send, Paperclip, X, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const formatCurrency = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(v || 0);

const formatDate = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

const formatDateTime = (s) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

async function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function downloadBase64(base64, fileName, mime) {
  const raw = base64.split(',').pop();
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'file';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminRetailerDetailPage() {
  const { id: retailerId } = useParams();
  const [tab, setTab] = useState('orders');

  return (
    <div className="space-y-4" data-testid="admin-retailer-detail">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/b2b"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Retailer: {retailerId}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Orders, uploaded bills, and direct messages.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { k: 'orders', icon: Package, label: 'Orders' },
          { k: 'bills', icon: Receipt, label: 'Bills' },
          { k: 'messages', icon: Headset, label: 'Messages' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              tab === t.k
                ? 'bg-slate-800 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
            data-testid={`retailer-tab-${t.k}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersPanel retailerId={retailerId} />}
      {tab === 'bills' && <BillsPanel retailerId={retailerId} />}
      {tab === 'messages' && <MessagesPanel retailerId={retailerId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function OrdersPanel({ retailerId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resyncingId, setResyncingId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/orders?retailer_id=${retailerId}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  const downloadInvoice = async (orderId) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/orders/${orderId}/invoice.pdf`
      );
      if (!res.ok) {
        toast.error('Invoice download failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Invoice download failed');
    }
  };

  const resync = async (orderId) => {
    setResyncingId(orderId);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/zoho/resync/${orderId}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Resync failed');
      }
      const data = await res.json();
      if (!data.salesorder_pushed && !data.payment_pushed) {
        toast.warning(
          'Zoho not configured (or order failed validation). Add ZOHO_* env vars and retry.'
        );
      } else {
        toast.success(
          `Synced to Zoho · SO:${data.salesorder_pushed ? '✓' : '–'} Payment:${data.payment_pushed ? '✓' : '–'}`
        );
        fetchOrders();
      }
    } catch (e) {
      toast.error(e.message || 'Resync failed');
    } finally {
      setResyncingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="animate-spin text-slate-400" size={24} />
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
        No B2B orders yet.
      </div>
    );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left">Order ID</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-center">Items</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-center">Payment</th>
            <th className="px-4 py-3 text-center">Invoice</th>
            <th className="px-4 py-3 text-center">Zoho</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_id} className="border-t border-slate-100 dark:border-slate-700" data-testid={`order-row-${o.order_id}`}>
              <td className="px-4 py-3 font-mono text-xs text-amber-600">{o.order_id}</td>
              <td className="px-4 py-3">{formatDate(o.created_at)}</td>
              <td className="px-4 py-3 text-center">{(o.items || []).length}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(o.grand_total)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 capitalize">
                  {o.order_status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full capitalize ${
                    o.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {o.payment_status || 'pending'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => downloadInvoice(o.order_id)}
                  className="px-2 py-0.5 text-[11px] rounded bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1"
                  data-testid={`invoice-pdf-${o.order_id}`}
                >
                  PDF
                </button>
              </td>
              <td className="px-4 py-3 text-center">
                {o.zoho_salesorder_id ? (
                  <span className="text-[11px] text-emerald-700" title={o.zoho_salesorder_id}>
                    ✓ Synced
                  </span>
                ) : (
                  <button
                    onClick={() => resync(o.order_id)}
                    disabled={resyncingId === o.order_id}
                    className="px-2 py-0.5 text-[11px] rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    data-testid={`zoho-resync-${o.order_id}`}
                  >
                    {resyncingId === o.order_id ? 'Syncing…' : 'Sync'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

function BillsPanel({ retailerId }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    bill_date: '',
    notes: '',
    file: null,
  });

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/retailers/${retailerId}/bills`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBills(data.bills || []);
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const upload = async () => {
    if (!form.title || !form.file) {
      toast.error('Title and file are required');
      return;
    }
    if (form.file.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 5MB limit');
      return;
    }
    if (!ALLOWED_MIME.includes(form.file.type)) {
      toast.error('File type not allowed (PDF/PNG/JPG/WEBP only)');
      return;
    }
    setUploading(true);
    try {
      const b64 = await readFileAsBase64(form.file);
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/retailers/${retailerId}/bills`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            amount: form.amount ? Number(form.amount) : undefined,
            bill_date: form.bill_date || undefined,
            notes: form.notes || undefined,
            file_base64: b64,
            file_name: form.file.name,
            file_type: form.file.type,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      toast.success('Bill uploaded');
      setForm({ title: '', amount: '', bill_date: '', notes: '', file: null });
      fetchBills();
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const del = async (bill_id) => {
    if (!confirm('Delete this bill?')) return;
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/bills/${bill_id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      toast.success('Deleted');
      fetchBills();
    } catch {
      toast.error('Delete failed');
    }
  };

  const download = async (bill_id) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/bills/${bill_id}/download`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      downloadBase64(data.file_base64, data.file_name, data.file_type);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold mb-3 text-slate-800 dark:text-white flex items-center gap-2">
          <Upload size={16} /> Upload new bill
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Title (e.g. Invoice Apr 2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            data-testid="bill-title"
          />
          <input
            type="number"
            placeholder="Amount (₹, optional)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <input
            type="date"
            value={form.bill_date}
            onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            data-testid="bill-file"
          />
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full mt-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[60px]"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={upload}
            disabled={uploading}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
            data-testid="bill-upload"
          >
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <span className="text-xs text-slate-500">
            PDF, PNG, JPG, WEBP · up to 5MB
          </span>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="animate-spin text-slate-400" size={20} />
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center text-slate-500">
          No bills yet.
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <div
              key={b.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3"
            >
              <Receipt size={18} className="text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{b.title}</p>
                <p className="text-xs text-slate-500">
                  {b.bill_id} · {formatDate(b.bill_date || b.created_at)}
                  {b.amount != null && <> · {formatCurrency(b.amount)}</>}
                </p>
                {b.notes && <p className="text-xs text-slate-500 mt-1">{b.notes}</p>}
              </div>
              <button
                onClick={() => download(b.bill_id)}
                className="p-2 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                title="Download"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => del(b.bill_id)}
                className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function MessagesPanel({ retailerId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const listRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/retailers/${retailerId}/messages`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const onFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    const ok = [];
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.type)) {
        toast.error(`${f.name}: type not allowed`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: exceeds 5MB`);
        continue;
      }
      const b64 = await readFileAsBase64(f);
      ok.push({ file_base64: b64, file_name: f.name, file_type: f.type });
    }
    setPendingFiles((prev) => [...prev, ...ok]);
    e.target.value = '';
  };

  const send = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/retailers/${retailerId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim() || '(attachment)',
            attachments: pendingFiles,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Send failed');
      }
      setText('');
      setPendingFiles([]);
      fetchMessages();
    } catch (e) {
      toast.error(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (messageId, idx, name, type) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/messages/attachment/${messageId}/${idx}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      downloadBase64(data.file_base64, name, type);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-3 max-w-3xl">
      <div
        ref={listRef}
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-[55vh] overflow-y-auto p-4 space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-slate-400" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-slate-400 pt-16">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === 'admin';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 ${
                    mine
                      ? 'bg-slate-800 text-white rounded-br-sm'
                      : 'bg-amber-50 text-slate-800 rounded-bl-sm border border-amber-200'
                  }`}
                >
                  <p className="text-[11px] opacity-70 mb-1">
                    {mine ? 'Addrika Team' : m.sender_name || 'Retailer'} ·{' '}
                    {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  {(m.attachments || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.attachments.map((a, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            downloadAttachment(m.id, i, a.file_name, a.file_type)
                          }
                          className={`flex items-center gap-2 text-xs ${
                            mine ? 'text-amber-200 hover:text-white' : 'text-emerald-700 hover:text-emerald-900'
                          }`}
                        >
                          <Download size={12} /> {a.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border"
            >
              {f.file_name}
              <button
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, x) => x !== i))
                }
                className="text-red-500 ml-1"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="p-2 rounded-lg border cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50">
          <Paperclip size={18} />
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            className="hidden"
            onChange={onFileSelect}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message to the retailer…"
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg border resize-none focus:outline-none focus:border-amber-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={send}
          disabled={sending}
          className="p-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
