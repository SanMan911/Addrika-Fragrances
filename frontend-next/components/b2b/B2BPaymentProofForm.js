'use client';

import { useState } from 'react';
import { Lock, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const MODE_LABELS = {
  upi: 'UPI',
  net_banking: 'Net Banking',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  neft_rtgs: 'NEFT / RTGS',
  cheque: 'Cheque',
  cash: 'Cash',
};

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-[#2B3A4A] focus:border-[#D4AF37] outline-none text-sm';

const STATUS_ICON = {
  pending: Clock,
  verified: CheckCircle2,
  rejected: XCircle,
};

const STATUS_STYLE = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
  verified: 'text-green-700 bg-green-50 border-green-200',
  rejected: 'text-red-700 bg-red-50 border-red-200',
};

/**
 * Shown when a shop is locked out of ordering. They declare the transfer
 * they already made; an admin verifies it, which reopens ordering.
 */
export default function B2BPaymentProofForm({ block, dues, proofs, onSubmit, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    mode: 'upi',
    reference: '',
    paid_on: new Date().toISOString().slice(0, 10),
    amount: '',
    order_id: '',
    note: '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.reference.trim() || !form.amount) {
      toast.error('Transaction reference and amount are required');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      toast.success('Payment details sent — our team will verify and reopen ordering');
      setForm((f) => ({ ...f, reference: '', amount: '', note: '' }));
      setOpen(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Could not submit your payment details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border-2 border-red-300 bg-red-50 p-5"
      data-testid="ordering-blocked-banner"
    >
      <div className="flex items-start gap-3">
        <Lock size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-red-900">Ordering is paused on your account</h3>
          <p className="text-sm text-red-800 mt-1" data-testid="ordering-blocked-reason">
            {block?.reason}
          </p>
          {dues?.outstanding_amount > 0 && (
            <p className="text-xs text-red-700 mt-2" data-testid="ordering-blocked-dues">
              Outstanding: ₹{Number(dues.outstanding_amount).toLocaleString('en-IN')}
              {dues.oldest_unpaid_days > 0 && ` · oldest bill ${dues.oldest_unpaid_days} days old`}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 px-4 py-2 rounded-lg bg-[#2B3A4A] text-[#D4AF37] text-sm font-semibold"
            data-testid="declare-payment-toggle"
          >
            {open ? 'Close' : 'I have already paid — share details'}
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 bg-white rounded-lg p-4 space-y-3" data-testid="payment-proof-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment mode</label>
              <select
                value={form.mode}
                onChange={set('mode')}
                className={INPUT}
                data-testid="proof-mode"
              >
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Transaction / UTR / cheque no.
              </label>
              <input
                value={form.reference}
                onChange={set('reference')}
                placeholder="e.g. 428193756201"
                className={INPUT}
                data-testid="proof-reference"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment date</label>
              <input
                type="date"
                value={form.paid_on}
                onChange={set('paid_on')}
                className={INPUT}
                data-testid="proof-date"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount paid (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={set('amount')}
                placeholder="25000"
                className={INPUT}
                data-testid="proof-amount"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Against order (optional)
              </label>
              <input
                value={form.order_id}
                onChange={set('order_id')}
                placeholder="B2B-20261030-AB12CD"
                className={INPUT}
                data-testid="proof-order-id"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Note (optional)</label>
              <input
                value={form.note}
                onChange={set('note')}
                placeholder="Paid from HDFC current a/c"
                className={INPUT}
                data-testid="proof-note"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="proof-submit"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : null}
            Send to AAROHMM for verification
          </button>
        </form>
      )}

      {proofs?.length > 0 && (
        <div className="mt-4 space-y-2" data-testid="payment-proof-history">
          <p className="text-xs font-semibold text-red-900 uppercase tracking-wide">
            Payments you have declared
          </p>
          {proofs.slice(0, 5).map((p) => {
            const Icon = STATUS_ICON[p.status] || Clock;
            return (
              <div
                key={p.proof_id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  STATUS_STYLE[p.status] || STATUS_STYLE.pending
                }`}
                data-testid={`proof-row-${p.proof_id}`}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="font-semibold">
                  ₹{Number(p.amount).toLocaleString('en-IN')}
                </span>
                <span>· {MODE_LABELS[p.mode] || p.mode}</span>
                <span className="text-[11px] opacity-80">· {p.reference}</span>
                <span className="ml-auto font-bold uppercase">{p.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
