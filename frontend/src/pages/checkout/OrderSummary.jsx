import React from 'react';
import { CreditCard, Loader2, Truck, Store, Zap } from 'lucide-react';
import { Button } from '../../components/ui/button';

// Token payment is disabled - customers must pay full amount
const TOKEN_PAYMENT_ENABLED = false;

const OrderSummary = ({
  cart,
  mrpTotal,
  deliveryMode,
  appliedDiscount,
  shippingCharge,
  finalTotal,
  selectedPickupStore,
  selectedTimeSlot,
  pickupPaymentOption,
  loading,
  handlePlaceOrder,
  freeShippingThreshold,
  liveShippingRate,
  selectedCourier
}) => {
  const isPickup = deliveryMode === 'self_pickup';
  // Token payment disabled - always pay full amount
  const isPayAtStore = false; // Token payment disabled
  
  // Calculate final payment amount - always full amount for pickup
  let paymentAmount = mrpTotal;
  if (!isPickup) {
    // Shipping mode
    paymentAmount = finalTotal;
  }
  
  return (
    <div className="lg:col-span-1">
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 sticky top-24"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={24} style={{ color: 'var(--metallic-gold)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            Order Summary
          </h2>
        </div>

        {/* Cart Items */}
        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
          {cart.map((item, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <p className="font-medium text-sm" style={{ color: 'var(--japanese-indigo)' }}>
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">
                  {item.size} x {item.quantity}
                </p>
              </div>
              <p className="font-semibold" style={{ color: 'var(--metallic-gold)' }}>
                ₹{(item.mrp * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal (MRP)</span>
            <span>₹{mrpTotal.toFixed(2)}</span>
          </div>
          
          {/* Show discount only for shipping mode */}
          {!isPickup && appliedDiscount && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount ({appliedDiscount.code})</span>
              <span>-₹{appliedDiscount.discount_amount?.toFixed(2) || '0.00'}</span>
            </div>
          )}
          
          {/* Show shipping for shipping mode */}
          {!isPickup && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Shipping
                {liveShippingRate && selectedCourier && (
                  <span className="text-xs text-blue-500 ml-1">
                    ({selectedCourier.name})
                  </span>
                )}
              </span>
              <span className={shippingCharge === 0 ? 'text-green-600 font-medium' : ''}>
                {shippingCharge === 0 ? 'FREE' : `₹${shippingCharge.toFixed(2)}`}
              </span>
            </div>
          )}
          
          {/* Self-Pickup specific info */}
          {isPickup && (
            <>
              <div className="flex justify-between text-sm text-blue-600">
                <span>Shipping</span>
                <span>FREE (Self-Pickup)</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mt-2 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">Fast-Track Pickup</span>
                </div>
                <p className="text-xs text-amber-600">
                  Pay now for priority pickup & instant confirmation
                </p>
              </div>
            </>
          )}
        </div>

        {/* Free shipping progress (only for shipping mode) */}
        {!isPickup && freeShippingThreshold && mrpTotal < freeShippingThreshold && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Add ₹{(freeShippingThreshold - mrpTotal).toFixed(0)} more for FREE shipping!
            </p>
            <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.min((mrpTotal / freeShippingThreshold) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center py-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            {isPayAtStore ? 'Pay Now' : 'Total'}
          </span>
          <span className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
            ₹{paymentAmount.toFixed(2)}
          </span>
        </div>

        {/* Selected Store Info (for pickup) */}
        {isPickup && selectedPickupStore && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <Store size={16} className="text-green-600" />
              <span className="text-sm font-semibold text-green-700">Pickup from:</span>
            </div>
            <p className="text-sm text-green-700">{selectedPickupStore.name}</p>
            <p className="text-xs text-green-600">{selectedPickupStore.city}</p>
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
          disabled={loading || (isPickup && (!selectedPickupStore || !selectedTimeSlot))}
          className="w-full py-6 text-lg font-semibold text-white"
          style={{ backgroundColor: loading ? '#999' : 'var(--japanese-indigo)' }}
          data-testid="place-order-btn"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </span>
          ) : isPickup ? (
            <span className="flex items-center gap-2">
              <Zap size={20} />
              Fast-Track Pickup (₹{mrpTotal.toFixed(0)})
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Truck size={20} />
              Place Order
            </span>
          )}
        </Button>

        {/* Security note */}
        <p className="text-xs text-center text-gray-500 mt-3">
          Secure payment powered by Razorpay
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;
