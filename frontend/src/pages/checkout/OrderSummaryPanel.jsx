/**
 * OrderSummaryPanel - Sticky order summary with pricing breakdown and place order button
 */
import React from 'react';
import { CreditCard, Loader2, Truck, Store, ShieldCheck, Coins } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { TOKEN_AMOUNT } from './utils';

const OrderSummaryPanel = ({
  cart,
  pricing,
  deliveryMode,
  appliedDiscount,
  selectedPickupStore,
  selectedTimeSlot,
  pickupPaymentOption,
  loading,
  handlePlaceOrder,
  isSelfPickup,
  isPayAtStore
}) => {
  const {
    mrpTotal,
    codeDiscount,
    hasCouponApplied,
    coinDiscount,
    coinsUsed,
    hasCoinsApplied,
    shippingCharge,
    orderTotal,
    amountToPay,
    balanceAtStore,
    amountForFreeShipping,
    amountForReducedShipping
  } = pricing;

  // Determine if place order should be disabled
  const isPlaceOrderDisabled = loading || cart.length === 0 || 
    (isSelfPickup && (!selectedPickupStore || !selectedTimeSlot));

  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 sticky top-24"
      style={{ border: '1px solid var(--border)' }}
      data-testid="order-summary-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CreditCard size={24} style={{ color: 'var(--metallic-gold)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
          Order Summary
        </h2>
      </div>

      {/* Cart Items */}
      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
        {cart.map((item, index) => (
          <div 
            key={`${item.id}-${item.size}-${index}`} 
            className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-700"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--japanese-indigo)' }}>
                {item.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {item.size} x {item.quantity}
              </p>
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--metallic-gold)' }}>
              ₹{((item.mrp || item.price) * item.quantity).toFixed(0)}
            </p>
          </div>
        ))}
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--text-subtle)' }}>
            {isSelfPickup ? 'Product Total (MRP)' : 'Subtotal'}
          </span>
          <span style={{ color: 'var(--japanese-indigo)' }}>₹{mrpTotal.toFixed(0)}</span>
        </div>

        {/* Coupon Discount - Only for shipping */}
        {!isSelfPickup && hasCouponApplied && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount ({appliedDiscount?.code})</span>
            <span>-₹{codeDiscount.toFixed(0)}</span>
          </div>
        )}

        {/* Coin Discount - Only for shipping */}
        {!isSelfPickup && hasCoinsApplied && (
          <div className="flex justify-between text-sm" style={{ color: 'var(--metallic-gold)' }}>
            <span className="flex items-center gap-1">
              <Coins size={14} />
              Coins ({coinsUsed.toFixed(2)} used)
            </span>
            <span>-₹{coinDiscount.toFixed(0)}</span>
          </div>
        )}

        {/* Shipping - Only for shipping mode */}
        {!isSelfPickup && (
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-subtle)' }}>Shipping</span>
            <span className={shippingCharge === 0 ? 'text-green-600 font-medium' : ''}>
              {shippingCharge === 0 ? 'FREE' : `₹${shippingCharge.toFixed(0)}`}
            </span>
          </div>
        )}

        {/* Self-Pickup Info */}
        {isSelfPickup && (
          <div className="flex justify-between text-sm text-blue-600">
            <span>Shipping</span>
            <span>FREE (Self-Pickup)</span>
          </div>
        )}
      </div>

      {/* Pay at Store Breakdown */}
      {isPayAtStore && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-amber-700 dark:text-amber-300">Pay Now (Token)</span>
            <span className="font-semibold text-amber-700">₹{TOKEN_AMOUNT}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-amber-700 dark:text-amber-300">Pay at Store</span>
            <span className="font-semibold text-amber-700">₹{balanceAtStore.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Free Shipping Progress - Only for shipping mode */}
      {!isSelfPickup && shippingCharge > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
            {mrpTotal < 249 
              ? `Add ₹${amountForReducedShipping.toFixed(0)} more for reduced shipping (₹49)`
              : `Add ₹${amountForFreeShipping.toFixed(0)} more for FREE shipping`
            }
          </p>
          <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min((mrpTotal / 999) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Order Total */}
      <div className="flex justify-between items-center py-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
          {isPayAtStore ? 'Pay Now' : 'Total'}
        </span>
        <span className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
          ₹{amountToPay.toFixed(0)}
        </span>
      </div>

      {/* Selected Store Info - Self-Pickup */}
      {isSelfPickup && selectedPickupStore && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-2 mb-1">
            <Store size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              Pickup from:
            </span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">{selectedPickupStore.name}</p>
          <p className="text-xs text-green-600 dark:text-green-400">{selectedPickupStore.city}</p>
          {selectedTimeSlot && (
            <p className="text-xs text-amber-600 mt-1 font-medium">
              Time: {selectedTimeSlot.label}
            </p>
          )}
        </div>
      )}

      {/* Place Order Button */}
      <Button
        type="button"
        onClick={handlePlaceOrder}
        disabled={isPlaceOrderDisabled}
        className="w-full py-6 text-lg font-semibold text-white"
        style={{ backgroundColor: isPlaceOrderDisabled ? '#999' : 'var(--japanese-indigo)' }}
        data-testid="place-order-btn"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </span>
        ) : isSelfPickup ? (
          <span className="flex items-center justify-center gap-2">
            <Store size={20} />
            Fast-Track Pickup (₹{mrpTotal.toFixed(0)})
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Truck size={20} />
            Pay ₹{amountToPay.toFixed(0)}
          </span>
        )}
      </Button>

      {/* Validation Messages */}
      {isSelfPickup && (!selectedPickupStore || !selectedTimeSlot) && (
        <p className="text-xs text-center mt-2 text-red-500">
          {!selectedPickupStore ? 'Please select a pickup store' : 'Please select a pickup time slot'}
        </p>
      )}

      {/* Security Note */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <ShieldCheck size={16} className="text-green-600" />
        <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
          Secure payment powered by Razorpay
        </p>
      </div>

      {/* Policy Notice */}
      <div 
        className="mt-4 p-3 rounded-lg border text-xs bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800"
      >
        <p className="font-semibold mb-1 text-amber-700 dark:text-amber-400">Important Notice:</p>
        {isSelfPickup ? (
          <p className="text-amber-800 dark:text-amber-300">
            Orders once placed cannot be cancelled. 
            Please collect your order within 7 days from the selected store.
          </p>
        ) : (
          <p className="text-amber-800 dark:text-amber-300">
            Orders once placed cannot be cancelled. For RTO orders, a voucher will be issued within 7 days, 
            valid for 15 days.
          </p>
        )}
      </div>

      {/* Terms Agreement */}
      <p className="text-xs text-center mt-3" style={{ color: 'var(--text-subtle)' }}>
        By placing this order, you agree to our Terms & Conditions
      </p>
    </div>
  );
};

export default OrderSummaryPanel;
