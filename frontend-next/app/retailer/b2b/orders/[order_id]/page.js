'use client';

import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Wallet, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRetailerAuth } from '../../../../../context/RetailerAuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—';

/**
 * B2B pre-order detail + balance-payment page.
 * Deep-linked from the "Batch Ready" nudge via `?balance=1` — when that
 * query param is present we auto-open the Razorpay balance checkout.
 */
export default function RetailerOrderDetailPage() {
  const { fetchWithAuth, retailer, loading: authLoading } = useRetailerAuth();
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const orderId = params?.order_id;
  const autoBalance = search.get('balance') === '1';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingBalance, setPayingBalance] = useState(false);
  const [rzpReady, setRzpReady] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/orders/${orderId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrder(data.order || data);
    } catch (e) {
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchWithAuth]);

  useEffect(() => { if (!authLoading && retailer) load(); }, [authLoading, retailer, load]);

  const payBalance = useCallback(async () => {
    if (!order || !rzpReady) return;
    setPayingBalance(true);
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/retailer-dashboard/b2b/order/${orderId}/create-balance-payment`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      const options = {
        key: data.razorpay_key,
        amount: Math.round((data.amount_inr || 0) * 100),
        currency: 'INR',
        name: 'Addrika',
        description: `Balance payment · ${orderId}`,
        order_id: data.razorpay_order_id,
        prefill: {
          email: retailer?.email,
          contact: retailer?.phone || retailer?.whatsapp,
        },
        theme: { color: '#D4AF37' },
        handler: async (response) => {
          const verifyRes = await fetchWithAuth(
            `${API_URL}/api/retailer-dashboard/b2b/order/${orderId}/verify-balance-payment`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            },
          );
          const vdata = await verifyRes.json();
          if (!verifyRes.ok) {
            toast.error(vdata.detail || 'Verification failed');
            return;
          }
          toast.success('Balance paid — your batch will be dispatched shortly.');
          load();
          // Strip ?balance=1 so a refresh doesn't re-open the checkout
          router.replace(`/retailer/b2b/orders/${orderId}`);
        },
        modal: {
          ondismiss: () => setPayingBalance(false),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast.error(e.message || 'Could not initiate balance payment');
    } finally {
      setPayingBalance(false);
    }
  }, [order, rzpReady, orderId, fetchWithAuth, retailer, load, router]);

  // Auto-open Razorpay when landed via the batch-ready nudge deep-link
  useEffect(() => {
    if (autoBalance && order && !order.balance_paid_at && rzpReady && !payingBalance) {
      payBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBalance, order, rzpReady]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Order not found.</p>
          <Link href="/retailer/b2b" className="text-[#D4AF37] hover:underline">← Back to B2B</Link>
        </div>
      </div>
    );
  }

  const isPreorder = !!order.is_preorder;
  const balanceDue = Number(order.balance_due_inr || 0);
  const balancePaid = !!order.balance_paid_at;
  const canPay = isPreorder && balanceDue > 0 && !balancePaid;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 px-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpReady(true)} />
      <div className="max-w-3xl mx-auto space-y-4" data-testid="retailer-order-detail">
        <Link href="/retailer/b2b/orders" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm">
          <ArrowLeft size={16} /> All Orders
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Package size={20} className="text-[#D4AF37]" /> {orderId}
              </h1>
              <p className="text-xs text-slate-500 mt-1">Placed on {fmtDate(order.created_at)}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800 dark:text-white">{inr(order.grand_total)}</div>
              <div className="text-xs text-slate-500">Grand total</div>
            </div>
          </div>

          {isPreorder && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniStat label="Token paid" value={inr(order.token_amount_inr)} tone="emerald" testid="stat-token" />
              <MiniStat
                label={balancePaid ? 'Balance paid' : 'Balance due'}
                value={inr(balanceDue)}
                tone={balancePaid ? 'emerald' : 'amber'}
                testid="stat-balance"
              />
              <MiniStat label="Status" value={order.order_status?.toUpperCase() || '—'} tone="slate" testid="stat-status" />
            </div>
          )}
        </div>

        {canPay && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5" data-testid="balance-cta-card">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-bold text-amber-900 dark:text-amber-100">Your batch is ready — pay the balance to dispatch</h2>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  Your reserved pieces are packed. Clear the remaining <b>{inr(balanceDue)}</b> and we ship the same day.
                </p>
                <button
                  onClick={payBalance}
                  disabled={payingBalance || !rzpReady}
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2B3A4A] hover:bg-[#1e3a52] text-[#D4AF37] font-semibold disabled:opacity-50"
                  data-testid="pay-balance-btn"
                >
                  <Wallet size={16} /> {payingBalance ? 'Opening…' : 'Pay Balance & Dispatch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {balancePaid && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3" data-testid="balance-paid-banner">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Balance settled on {fmtDate(order.balance_paid_at)}</div>
              <div className="text-xs text-emerald-800 dark:text-emerald-200">Your batch is being dispatched.</div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Items</h3>
          <div className="space-y-2">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                <div>
                  <div className="font-medium text-slate-800 dark:text-white">{it.name}</div>
                  <div className="text-xs text-slate-500">{it.net_weight} · {it.quantity_boxes} box(es)</div>
                </div>
                <div className="text-slate-700 dark:text-slate-200">{inr(it.line_total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, testid }) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    slate: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone] || tones.slate}`} data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
