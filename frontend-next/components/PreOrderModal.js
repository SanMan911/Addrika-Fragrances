'use client';

import { useState } from 'react';
import { AlertTriangle, X, Package, Download } from 'lucide-react';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const TERMS = [
  {
    id: 'nonrefund',
    text: 'The token/part-payment made hereto is strictly NON-REFUNDABLE under any circumstance.',
  },
  {
    id: 'noncancel',
    text: 'This Pre-Order is NON-CANCELLABLE once the token is received. No Credit Notes (CNs) shall be issued for any amount whatsoever.',
  },
  {
    id: 'amend_up',
    text: 'The Pre-Order may be amended only prior to dispatch and only such that the total order value NEVER falls below the token amount already prepaid.',
  },
  {
    id: 'exchange',
    text: 'Exchange is entertained only for items with visible manufacturing defect(s), and only if the product seal remains fully intact. Any tampering renders the product ineligible for exchange.',
  },
  {
    id: 'damage',
    text: 'Any damage to goods MUST be brought to attention at the time of delivery itself — claims raised after signed receipt shall NOT be entertained.',
  },
  {
    id: 'signature',
    text: 'Retailer signature on the delivery receipt shall be treated as conclusive acceptance of the goods and closure of this Pre-Order.',
  },
];

/**
 * Pre-Order confirmation modal.
 * Focus per user spec: emphasise "Next Production Batch", NEVER show a timeline.
 * All 6 legal checkboxes must be ticked before the retailer can proceed.
 */
export default function PreOrderModal({ open, onClose, orderSummary, onConfirm, submitting }) {
  const [accepted, setAccepted] = useState(() =>
    Object.fromEntries(TERMS.map((t) => [t.id, false]))
  );

  if (!open || !orderSummary) return null;

  const grand = Number(orderSummary.grand_total || 0);
  const token = Math.round(grand * 0.5);
  const balance = grand - token;
  const allAccepted = TERMS.every((t) => accepted[t.id]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose} data-testid="preorder-modal">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl my-8 max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-[#2B3A4A] text-white flex items-center justify-between p-4 z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package size={18} className="text-[#D4AF37]" /> Pre-Order · Next Production Batch
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white" data-testid="preorder-close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
            <p className="text-sm text-amber-900">
              <b>Priority slot confirmation.</b> By paying a 50% token, your order is
              prioritized when the <b>Next Production Batch</b> is completely manufactured.
              We will reach out via WhatsApp/email once your allocation is ready for dispatch.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Order Value</div>
              <div className="text-lg font-bold text-slate-800">{inr(grand)}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="text-[10px] font-semibold uppercase text-emerald-700">Token Now (50%)</div>
              <div className="text-lg font-bold text-emerald-800" data-testid="preorder-token-amount">{inr(token)}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3">
              <div className="text-[10px] font-semibold uppercase text-rose-700">Balance on Delivery</div>
              <div className="text-lg font-bold text-rose-800">{inr(balance)}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Please read and accept every clause</h3>
            <div className="space-y-2 text-xs text-slate-700">
              {TERMS.map((t, i) => (
                <label
                  key={t.id}
                  className="flex items-start gap-2 cursor-pointer border border-slate-200 rounded-lg p-2 hover:border-amber-400"
                >
                  <input
                    type="checkbox"
                    checked={accepted[t.id]}
                    onChange={(e) => setAccepted((a) => ({ ...a, [t.id]: e.target.checked }))}
                    className="mt-0.5 accent-amber-600 w-4 h-4"
                    data-testid={`preorder-term-${t.id}`}
                  />
                  <span><b>{i + 1}.</b> {t.text}</span>
                </label>
              ))}
            </div>
          </div>

          {!allAccepted && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <AlertTriangle size={12} /> All clauses must be ticked to proceed.
            </p>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
              data-testid="preorder-cancel-btn"
            >
              Cancel
            </button>
            <button
              disabled={!allAccepted || submitting}
              onClick={() => onConfirm({ token })}
              className="flex-1 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#c39c2a] text-[#2B3A4A] font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="preorder-confirm-btn"
            >
              {submitting ? 'Processing…' : `Pay ${inr(token)} & Confirm Slot`}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            Once paid, you can download the signed Pre-Order Receipt <Download size={10} className="inline" />
            from your Orders page — please sign it on delivery and hand over to the delivery representative.
          </p>
        </div>
      </div>
    </div>
  );
}
