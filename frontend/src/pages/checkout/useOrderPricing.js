/**
 * Custom hook for order pricing calculations
 * Handles MRP totals, discounts, shipping charges, coin redemption, and final amounts
 * 
 * Note: For dynamic shipping (ShipRocket rates + ₹20), use the separate
 * calculateDynamicShipping function in utils.js with pincode and weight.
 * This hook uses fallback tier-based pricing for initial display.
 */
import { useMemo } from 'react';
import { TOKEN_AMOUNT } from './utils';

/**
 * Calculate shipping charge based on cart value (tier-based fallback)
 * Dynamic pricing (ShipRocket + ₹20) is handled separately in checkout
 */
const calculateTierShipping = (cartValue, dynamicCharge = null) => {
  // If dynamic charge is provided and valid, use it
  if (dynamicCharge !== null && dynamicCharge >= 0) {
    return dynamicCharge;
  }
  
  // Fallback to tier-based
  if (cartValue >= 999) return 0;
  if (cartValue >= 249) return 49;
  return 149;
};

export const useOrderPricing = (cart, getCartTotal, deliveryMode, pickupPaymentOption, appliedDiscount, dynamicShippingCharge = null, coinRedemption = null) => {
  return useMemo(() => {
    // Calculate MRP total (BASE PRICE)
    const mrpTotal = cart.reduce((total, item) => {
      return total + ((item.mrp || item.price) * item.quantity);
    }, 0);
    
    const subtotal = getCartTotal();
    const isSelfPickup = deliveryMode === 'self_pickup';
    const isPayAtStore = isSelfPickup && pickupPaymentOption === 'pay_at_store';
    
    // Coupon discounts ONLY for shipping mode
    const hasCouponApplied = !isSelfPickup && appliedDiscount && appliedDiscount.discountAmount > 0;
    const codeDiscount = hasCouponApplied ? appliedDiscount.discountAmount : 0;
    
    // Calculate final cart value AFTER coupon discounts (before coins)
    const cartAfterCoupon = isSelfPickup 
      ? mrpTotal 
      : (hasCouponApplied ? (mrpTotal - codeDiscount) : subtotal);
    
    // Coin redemption (ONLY for shipping mode, AFTER coupon discount)
    const hasCoinsApplied = !isSelfPickup && coinRedemption && coinRedemption.value > 0;
    const coinDiscount = hasCoinsApplied ? coinRedemption.value : 0;
    const coinsUsed = hasCoinsApplied ? coinRedemption.coins : 0;
    
    // Final cart value after all discounts
    const finalCartValue = Math.max(0, cartAfterCoupon - coinDiscount);
    
    // Shipping logic (only for shipping mode)
    // Note: Shipping is calculated based on cart value BEFORE coin redemption
    let shippingCharge = 0;
    let shippingLabel = "FREE Shipping";
    let isDynamicPricing = false;
    
    if (!isSelfPickup) {
      if (cartAfterCoupon >= 999) {
        // Free shipping regardless of dynamic pricing (based on pre-coin value)
        shippingCharge = 0;
        shippingLabel = "FREE Shipping";
      } else if (dynamicShippingCharge !== null && dynamicShippingCharge >= 0) {
        // Use dynamic ShipRocket-based pricing
        shippingCharge = dynamicShippingCharge;
        shippingLabel = "Shipping (Live Rate)";
        isDynamicPricing = true;
      } else if (cartAfterCoupon < 249) {
        shippingCharge = 149;
        shippingLabel = "Standard Shipping";
      } else {
        shippingCharge = 49;
        shippingLabel = "Reduced Shipping";
      }
    }
    
    const amountForFreeShipping = !isSelfPickup && cartAfterCoupon < 999 ? (999 - cartAfterCoupon) : 0;
    const amountForReducedShipping = !isSelfPickup && cartAfterCoupon < 249 ? (249 - cartAfterCoupon) : 0;
    
    // Total calculation
    const orderTotal = finalCartValue + shippingCharge;
    const amountToPay = isPayAtStore ? TOKEN_AMOUNT : orderTotal;
    const balanceAtStore = isPayAtStore ? (mrpTotal - TOKEN_AMOUNT) : 0;
    
    return {
      mrpTotal,
      subtotal,
      codeDiscount,
      hasCouponApplied,
      coinDiscount,
      coinsUsed,
      hasCoinsApplied,
      cartAfterCoupon,
      finalCartValue,
      shippingCharge,
      shippingLabel,
      isDynamicPricing,
      amountForFreeShipping,
      amountForReducedShipping,
      orderTotal,
      amountToPay,
      balanceAtStore,
      isSelfPickup,
      isPayAtStore
    };
  }, [cart, getCartTotal, deliveryMode, pickupPaymentOption, appliedDiscount, dynamicShippingCharge, coinRedemption]);
};

export default useOrderPricing;
