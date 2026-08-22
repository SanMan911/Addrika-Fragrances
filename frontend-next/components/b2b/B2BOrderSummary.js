'use client';

import { CreditCard, Loader2 } from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * B2B Order Summary card + Place Order CTA.
 *
 * Extracted from `app/retailer/b2b/page.js` in Iter 99. Renders NOTHING
 * when `orderSummary` is falsy (i.e. before the retailer hits Calculate).
 * All row-level branches (tier savings, loyalty bonus, voucher, cash
 * discount, credit note, shipping, rewards redeem + earn projection)
 * preserve their original data-testids so the pytest / testing_agent
 * suites keep working.
 *
 * Props
 * -----
 * orderSummary: null | {
 *   items: [{ name, net_weight, quantity_boxes, line_total }],
 *   subtotal, tier_discount_total, loyalty_discount, loyalty_discount_percent,
 *   gst_total, voucher_discount, voucher_code, cash_discount, cash_discount_percent,
 *   credit_note_discount, credit_note_code, shipping_charges,
 *   shipping_quote?: { courier_name },
 *   rewards_redeemed_inr, rewards_projection?: { will_earn_inr, multiplier_pct },
 *   grand_total,
 * }
 * submitting:    boolean — disables the CTA while POST /order is in flight
 * onPlaceOrder:  () => void
 */
export default function B2BOrderSummary({ orderSummary, submitting, onPlaceOrder }) {
  if (!orderSummary) return null;

  return (
    <div className="rounded-xl overflow-hidden bg-white border-2 border-[#D4AF37]">
      <div className="px-6 py-4 bg-[#D4AF37] text-white">
        <h3 className="text-lg font-bold">Order Summary</h3>
      </div>
      <div className="p-6">
        {/* Items */}
        <div className="space-y-3 mb-6">
          {orderSummary.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-gray-500 ml-2">({item.net_weight})</span>
                <span className="text-sm text-gray-500 ml-2">× {item.quantity_boxes} boxes</span>
              </div>
              <span className="font-semibold">{formatCurrency(item.line_total)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(orderSummary.subtotal)}</span>
          </div>
          {orderSummary.tier_discount_total > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Bulk Tier Savings (applied per line)</span>
              <span className="font-medium">-{formatCurrency(orderSummary.tier_discount_total)}</span>
            </div>
          )}
          {orderSummary.loyalty_discount > 0 && (
            <div className="flex justify-between text-amber-700" data-testid="summary-loyalty">
              <span>Loyalty Bonus ({orderSummary.loyalty_discount_percent}%)</span>
              <span className="font-medium">-{formatCurrency(orderSummary.loyalty_discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">GST (after discount)</span>
            <span className="font-medium">{formatCurrency(orderSummary.gst_total)}</span>
          </div>
          {orderSummary.voucher_discount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Voucher ({orderSummary.voucher_code})</span>
              <span className="font-medium">-{formatCurrency(orderSummary.voucher_discount)}</span>
            </div>
          )}
          {orderSummary.cash_discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Cash Discount ({orderSummary.cash_discount_percent}%)</span>
              <span className="font-medium">-{formatCurrency(orderSummary.cash_discount)}</span>
            </div>
          )}
          {orderSummary.credit_note_discount > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Credit Note ({orderSummary.credit_note_code})</span>
              <span className="font-medium">-{formatCurrency(orderSummary.credit_note_discount)}</span>
            </div>
          )}
          {orderSummary.shipping_charges > 0 && (
            <div className="flex justify-between text-indigo-700" data-testid="summary-shipping">
              <span>
                Shipping
                {orderSummary.shipping_quote?.courier_name && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({orderSummary.shipping_quote.courier_name})
                  </span>
                )}
              </span>
              <span className="font-medium">+{formatCurrency(orderSummary.shipping_charges)}</span>
            </div>
          )}
          {orderSummary.rewards_redeemed_inr > 0 && (
            <div className="flex justify-between text-amber-700" data-testid="summary-rewards-redeemed">
              <span>Fragrance Rewards applied</span>
              <span className="font-medium">-{formatCurrency(orderSummary.rewards_redeemed_inr)}</span>
            </div>
          )}
          {orderSummary.rewards_projection?.will_earn_inr > 0 && (
            <div
              className="flex justify-between text-amber-700 bg-amber-50 -mx-1 px-2 py-1.5 rounded-lg text-sm border border-amber-100"
              data-testid="summary-rewards-projection"
            >
              <span>
                You&apos;ll earn (Fragrance Rewards @ {orderSummary.rewards_projection.multiplier_pct}%)
              </span>
              <span className="font-semibold">
                +{formatCurrency(orderSummary.rewards_projection.will_earn_inr)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-3 mt-3 border-t text-xl font-bold text-[#2B3A4A]">
            <span>Grand Total</span>
            <span className="text-[#D4AF37]">{formatCurrency(orderSummary.grand_total)}</span>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={onPlaceOrder}
          disabled={submitting}
          className="w-full mt-6 py-4 text-lg font-semibold bg-green-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="place-order-btn"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Placing Order...
            </>
          ) : (
            <>
              <CreditCard size={20} />
              Place Order - {formatCurrency(orderSummary.grand_total)}
            </>
          )}
        </button>
        <p className="text-center text-sm mt-3 text-gray-500">
          Our team will contact you to confirm and arrange delivery
        </p>
      </div>
    </div>
  );
}
