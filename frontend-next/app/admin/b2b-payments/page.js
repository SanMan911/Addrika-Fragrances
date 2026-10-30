'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, IndianRupee, Save, RefreshCw, Lock, Unlock, CheckCircle2,
  XCircle, Clock, ShieldAlert, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const MODE_LABELS = {
  upi: 'UPI',
  net_banking: 'Net Banking',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  neft_rtgs: 'NEFT / RTGS',
  cheque: 'Cheque',
  cash: 'Cash',
};

const money = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const CARD = 'bg-white rounded-xl border border-gray-200 p-5';

export default function AdminB2BPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [intents, setIntents] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('proofs');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, r, i] = await Promise.all([
        authFetch(`${API_URL}/api/admin/b2b-payments/settings`),
        authFetch(`${API_URL}/api/admin/b2b-payments/proofs`),
        authFetch(`${API_URL}/api/admin/b2b-payments/retailers`),
        authFetch(`${API_URL}/api/admin/b2b-payments/intents`),
      ]);
      if (s.ok) setSettings(await s.json());
      if (p.ok) setProofs((await p.json()).proofs || []);
      if (r.ok) setRetailers((await r.json()).retailers || []);
      if (i.ok) setIntents((await i.json()).intents || []);
    } catch {
      toast.error('Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (patch) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b-payments/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      setSettings(data);
      toast.success('Payment rules updated');
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reviewProof = async (proofId, approve) => {
    setBusyId(proofId);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b-payments/proofs/${proofId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve, admin_note: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Review failed');
      toast.success(approve ? 'Payment verified — ordering reopened' : 'Payment confirmation rejected');
      load();
    } catch (e) {
      toast.error(e.message || 'Review failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlock = async (retailer) => {
    const blocking = !retailer.ordering_blocked;
    const note = blocking
      ? window.prompt('Reason shown to the shop:', 'Outstanding payment pending settlement') || ''
      : '';
    if (blocking && !note) return;
    setBusyId(retailer.retailer_id);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-payments/retailers/${retailer.retailer_id}/block`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked: blocking, note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Update failed');
      toast.success(blocking ? 'Ordering locked for this shop' : 'Ordering reopened');
      load();
    } catch (e) {
      toast.error(e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const confirmIntent = async (intent) => {
    const ref = window.prompt(`Payment reference for ${money(intent.amount_due_now)} received:`);
    if (!ref) return;
    setBusyId(intent.intent_id);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-payments/intents/${intent.intent_id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_reference: ref }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Confirmation failed');
      toast.success(`Order ${data.order_id} created`);
      load();
    } catch (e) {
      toast.error(e.message || 'Confirmation failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      </div>
    );
  }

  const pendingProofs = proofs.filter((p) => p.status === 'pending');

  return (
    <div className="space-y-6" data-testid="admin-b2b-payments-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#2B3A4A]">Payments & Credit Control</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Upfront payment rules, the dues killswitch and declared payments awaiting verification
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium flex items-center gap-2"
          data-testid="payments-refresh"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Rules */}
      <div className={CARD} data-testid="payment-rules-card">
        <h2 className="font-bold text-[#2B3A4A] flex items-center gap-2 mb-4">
          <IndianRupee size={18} className="text-[#D4AF37]" /> Order payment rules
        </h2>

        <label className="flex items-start gap-3 py-3 border-b border-gray-100 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings?.prepayment_required}
            onChange={(e) => saveSettings({ prepayment_required: e.target.checked })}
            disabled={saving}
            className="mt-1 w-4 h-4"
            data-testid="toggle-prepayment"
          />
          <span>
            <span className="font-semibold text-[#2B3A4A] block">Require payment before an order exists</span>
            <span className="text-xs text-gray-500">
              A cart becomes an order only after the chosen share is paid and verified. Nothing is
              reserved before that.
            </span>
          </span>
        </label>

        <div className="py-4 border-b border-gray-100">
          <label className="block font-semibold text-[#2B3A4A] mb-1">Minimum paid upfront</label>
          <p className="text-xs text-gray-500 mb-2">
            Shops pick from this value upward. Paying 100% earns the cash discount.
          </p>
          <div className="flex gap-2">
            {[70, 80, 90, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => saveSettings({ min_payment_percent: pct })}
                disabled={saving}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  settings?.min_payment_percent === pct
                    ? 'bg-[#2B3A4A] text-[#D4AF37]'
                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}
                data-testid={`min-percent-${pct}`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 py-3 border-b border-gray-100 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings?.dues_killswitch_enabled}
            onChange={(e) => saveSettings({ dues_killswitch_enabled: e.target.checked })}
            disabled={saving}
            className="mt-1 w-4 h-4"
            data-testid="toggle-killswitch"
          />
          <span>
            <span className="font-semibold text-[#2B3A4A] flex items-center gap-2">
              <ShieldAlert size={15} className="text-red-500" /> Dues killswitch
            </span>
            <span className="text-xs text-gray-500">
              Lock every shop whose outstanding amount is older than the grace period below.
            </span>
          </span>
        </label>

        <div className="py-4 flex items-end gap-3">
          <div>
            <label className="block font-semibold text-[#2B3A4A] mb-1 text-sm">Grace period (days)</label>
            <input
              type="number"
              min="0"
              max="365"
              defaultValue={settings?.dues_grace_days ?? 30}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== settings?.dues_grace_days) saveSettings({ dues_grace_days: v });
              }}
              className="w-28 px-3 py-2 rounded-lg border border-gray-300 text-sm"
              data-testid="grace-days-input"
            />
          </div>
          <p className="text-xs text-gray-500 pb-2">
            Dues newer than this never trigger an automatic lock.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          ['proofs', `Declared payments${pendingProofs.length ? ` (${pendingProofs.length})` : ''}`],
          ['retailers', 'Shops & dues'],
          ['intents', `Awaiting payment${intents.length ? ` (${intents.length})` : ''}`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === key ? 'bg-white border-2 border-[#D4AF37] text-[#2B3A4A]' : 'text-gray-500'
            }`}
            data-testid={`payments-tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'proofs' && (
        <div className="space-y-3" data-testid="proofs-list">
          {proofs.length === 0 ? (
            <div className={`${CARD} text-center text-gray-500 text-sm`}>
              No payment confirmations submitted yet.
            </div>
          ) : (
            proofs.map((p) => (
              <div key={p.proof_id} className={CARD} data-testid={`proof-${p.proof_id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-bold text-[#2B3A4A]">
                      {p.retailer_business_name || p.retailer_id}
                    </p>
                    <p className="text-xs text-gray-500">{p.retailer_gst || '—'}</p>
                    <div className="mt-2 text-sm text-gray-700 space-y-0.5">
                      <p>
                        <strong>{money(p.amount)}</strong> via {MODE_LABELS[p.mode] || p.mode}
                      </p>
                      <p className="text-xs text-gray-500">
                        Ref {p.reference} · paid {p.paid_on}
                        {p.order_id ? ` · against ${p.order_id}` : ' · general settlement'}
                      </p>
                      {p.note && <p className="text-xs italic text-gray-500">“{p.note}”</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => reviewProof(p.proof_id, true)}
                          disabled={busyId === p.proof_id}
                          className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
                          data-testid={`proof-approve-${p.proof_id}`}
                        >
                          <CheckCircle2 size={15} /> Verify
                        </button>
                        <button
                          onClick={() => reviewProof(p.proof_id, false)}
                          disabled={busyId === p.proof_id}
                          className="px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
                          data-testid={`proof-reject-${p.proof_id}`}
                        >
                          <XCircle size={15} /> Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          p.status === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'retailers' && (
        <div className="space-y-3" data-testid="retailer-dues-list">
          {retailers.length === 0 ? (
            <div className={`${CARD} text-center text-gray-500 text-sm`}>
              No shop currently carries an outstanding balance.
            </div>
          ) : (
            retailers.map((r) => (
              <div key={r.retailer_id} className={CARD} data-testid={`dues-${r.retailer_id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-bold text-[#2B3A4A]">{r.business_name || r.retailer_id}</p>
                    <p className="text-xs text-gray-500">
                      {r.gst_number || '—'}
                      {r.city ? ` · ${r.city}` : ''}
                    </p>
                    <p className="text-sm mt-1">
                      Outstanding <strong>{money(r.outstanding_amount)}</strong>
                      {r.overdue_amount > 0 && (
                        <span className="text-red-600">
                          {' '}
                          · {money(r.overdue_amount)} past grace ({r.oldest_unpaid_days}d)
                        </span>
                      )}
                    </p>
                    {(r.ordering_blocked || r.locked_by_killswitch) && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold uppercase">
                        {r.ordering_blocked ? 'Locked manually' : 'Locked by killswitch'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleBlock(r)}
                    disabled={busyId === r.retailer_id}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 disabled:opacity-50 ${
                      r.ordering_blocked
                        ? 'bg-green-600 text-white'
                        : 'border border-red-300 text-red-700'
                    }`}
                    data-testid={`toggle-block-${r.retailer_id}`}
                  >
                    {r.ordering_blocked ? (
                      <>
                        <Unlock size={15} /> Reopen ordering
                      </>
                    ) : (
                      <>
                        <Lock size={15} /> Lock ordering
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'intents' && (
        <div className="space-y-3" data-testid="intents-list">
          {intents.length === 0 ? (
            <div className={`${CARD} text-center text-gray-500 text-sm`}>
              No carts are waiting for payment.
            </div>
          ) : (
            intents.map((i) => (
              <div key={i.intent_id} className={CARD} data-testid={`intent-${i.intent_id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-bold text-[#2B3A4A] flex items-center gap-2">
                      <Clock size={15} className="text-amber-500" /> {i.intent_id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {i.retailer_id} · {i.channel} · opened {i.created_at?.slice(0, 16).replace('T', ' ')}
                    </p>
                    <p className="text-sm mt-1">
                      Paying <strong>{i.payment_percent}%</strong> of {money(i.grand_total)} ={' '}
                      <strong>{money(i.amount_due_now)}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => confirmIntent(i)}
                    disabled={busyId === i.intent_id}
                    className="px-3 py-2 rounded-lg bg-[#2B3A4A] text-[#D4AF37] text-sm font-semibold flex items-center gap-1 disabled:opacity-50"
                    data-testid={`confirm-intent-${i.intent_id}`}
                  >
                    <Save size={15} /> Payment received — create order
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
