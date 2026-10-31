'use client';

import { Percent, Info } from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

/**
 * "How much do you want to pay now?" ladder.
 *
 * The rupee figure is DERIVED from the chosen percentage and the
 * server-priced grand total — it is deliberately read-only so a shop
 * cannot under-pay by editing the box. Paying 100% earns the cash
 * discount, which is why that option is highlighted.
 */
export default function B2BPayNowSelector({
  gate,
  grandTotal,
  payPercent,
  onChange,
  disabled,
  repricing,
}) {
  if (!gate?.prepayment_required) return null;

  const options = gate.allowed_payment_percents || [70, 80, 90, 100];
  const amountNow = Math.round((Number(grandTotal || 0) * Number(payPercent)) / 100);
  const balance = Math.max(0, Math.round(Number(grandTotal || 0)) - amountNow);
  const isFull = Number(payPercent) === (gate.cash_discount_at_percent || 100);

  return (
    <div
      className="rounded-xl bg-white border-2 border-[#D4AF37]/40 p-5"
      data-testid="pay-now-selector"
    >
      <div className="flex items-start gap-2 mb-4">
        <Percent size={18} className="text-[#D4AF37] mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-[#2B3A4A]">How much would you like to pay now?</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Your order is confirmed once this payment is verified. Minimum{' '}
            {gate.min_payment_percent}% upfront.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {options.map((pct) => {
          const selected = Number(payPercent) === pct;
          const full = pct === (gate.cash_discount_at_percent || 100);
          return (
            <button
              key={pct}
              type="button"
              disabled={disabled}
              onClick={() => onChange(pct)}
              data-testid={`pay-percent-${pct}`}
              className={`relative py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 ${
                selected
                  ? 'bg-[#2B3A4A] text-[#D4AF37] shadow-md scale-[1.02]'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {full ? 'Pay all' : `${pct}%`}
              {full && !selected && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-green-600 text-white text-[9px] font-bold whitespace-nowrap">
                  SAVE {gate.cash_discount_percent}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Paying now ({payPercent}%)</span>
          <span
            className={`text-xl font-bold text-[#2B3A4A] transition-opacity ${
              repricing ? 'opacity-40' : 'opacity-100'
            }`}
            data-testid="pay-now-amount"
            aria-readonly="true"
          >
            {repricing ? 'Re-pricing…' : formatCurrency(amountNow)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Balance on credit terms</span>
          <span className="font-semibold text-gray-600" data-testid="pay-now-balance">
            {formatCurrency(balance)}
          </span>
        </div>
      </div>

      {isFull ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2"
          data-testid="pay-now-cash-discount-applied"
        >
          <Info size={15} className="text-green-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-800">
            Cash discount of {gate.cash_discount_percent}% is applied to this order.
          </p>
        </div>
      ) : (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
          data-testid="pay-now-cash-discount-nudge"
        >
          <Info size={15} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Pay the full amount to unlock the {gate.cash_discount_percent}% cash discount on this
            order.
          </p>
        </div>
      )}
    </div>
  );
}
