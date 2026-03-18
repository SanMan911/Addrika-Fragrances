/**
 * Checkout Utility Functions
 * Shared helpers for checkout-related calculations and validations
 */

// GST number validation regex
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validate Indian GST number format
 * Format: 22AAAAA0000A1Z5 (2 digit state + 10 char PAN + entity code + Z + checksum)
 */
export const validateGSTNumber = (gst) => {
  if (!gst) return false;
  return GST_PATTERN.test(gst.toUpperCase().trim());
};

/**
 * Capitalize first letter of each word
 */
export const capitalizeWords = (str) => {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Format price with Indian Rupee symbol
 */
export const formatPrice = (amount, decimals = 2) => {
  if (typeof amount !== 'number') return '₹0.00';
  return `₹${amount.toFixed(decimals)}`;
};

/**
 * Get slab maximum shipping charge based on cart value (post-discount)
 * Tiers: <₹249 = max ₹149, ₹249-998 = max ₹49, ≥₹999 = FREE
 */
export const getSlabMaxShipping = (cartValueAfterDiscount) => {
  if (cartValueAfterDiscount >= 999) return 0;
  if (cartValueAfterDiscount >= 249) return 49;
  return 149;
};

/**
 * Calculate shipping charge based on cart value (fallback/legacy)
 * Tiers: <₹249 = ₹149, ₹249-998 = ₹49, ≥₹999 = FREE
 */
export const calculateShippingCharge = (cartValue) => {
  if (cartValue >= 999) return 0;
  if (cartValue >= 249) return 49;
  return 149;
};

/**
 * Calculate dynamic shipping charge using ShipRocket rates + ₹20 margin
 * CAPPED at slab maximum based on cart value:
 * - <₹249: max ₹149
 * - ₹249-998: max ₹49
 * - ≥₹999: FREE (override)
 * 
 * Final charge = min(ShipRocket + ₹20, slab_max)
 * 
 * @param {string} pincode - Delivery pincode
 * @param {number} weight - Package weight in kg
 * @param {number} subtotal - Order subtotal (POST-DISCOUNT) for shipping calculation
 * @returns {Promise<object>} Shipping calculation result
 */
export const calculateDynamicShipping = async (pincode, weight, subtotal) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  try {
    const response = await fetch(
      `${API_URL}/api/shipping/calculate-charge?pincode=${pincode}&weight=${weight}&subtotal=${subtotal}`
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        charge: data.shipping_charge,
        baseRate: data.base_rate,
        margin: data.margin,
        slabMax: data.slab_max,
        slabLabel: data.slab_label,
        isCapped: data.is_capped,
        shiprocketTotal: data.shiprocket_total,
        isFree: data.is_free,
        isFallback: data.is_fallback || false,
        courierName: data.courier_name,
        etd: data.etd,
        amountForFreeShipping: data.amount_for_free_shipping
      };
    } else {
      // Fallback to slab maximum
      const slabMax = getSlabMaxShipping(subtotal);
      return {
        success: false,
        charge: slabMax,
        slabMax: slabMax,
        isFallback: true
      };
    }
  } catch (error) {
    console.error('Dynamic shipping calculation failed:', error);
    // Fallback to slab maximum
    const slabMax = getSlabMaxShipping(subtotal);
    return {
      success: false,
      charge: slabMax,
      slabMax: slabMax,
      isFallback: true
    };
  }
};

/**
 * Get amount needed for next shipping tier
 */
export const getAmountForNextTier = (cartValue) => {
  if (cartValue >= 999) return { tier: 'free', amount: 0 };
  if (cartValue >= 249) return { tier: 'free', amount: 999 - cartValue };
  return { tier: 'reduced', amount: 249 - cartValue };
};

/**
 * Validate phone number (Indian 10-digit)
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return /^\d{10}$/.test(cleaned);
};

/**
 * Validate pincode (Indian 6-digit)
 */
export const validatePincode = (pincode) => {
  if (!pincode) return false;
  return /^\d{6}$/.test(pincode);
};

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Get session ID from localStorage or generate new one
 */
export const getSessionId = () => {
  let sessionId = localStorage.getItem('addrika_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('addrika_session_id', sessionId);
  }
  return sessionId;
};

/**
 * Format date to DDMMMYYYY format
 */
export const formatDateDDMMMYYYY = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  } catch {
    return 'N/A';
  }
};

/**
 * Calculate MRP total from cart items
 */
export const calculateMRPTotal = (items) => {
  return items.reduce((total, item) => {
    return total + ((item.mrp || item.price) * item.quantity);
  }, 0);
};

/**
 * Token amount for pay-at-store orders
 * DISABLED: Token payment is no longer offered - customers must pay full amount
 */
export const TOKEN_AMOUNT = 0;
export const TOKEN_PAYMENT_ENABLED = false;

/**
 * Pickup time slots configuration
 * Available: Morning, Afternoon, Evening (after 8pm)
 * Excluded: 4:30pm - 7:30pm (peak hours)
 */
export const PICKUP_TIME_SLOTS = [
  { id: 'slot_1', label: '11:30 AM - 2:00 PM', value: '11:30am-2pm' },
  { id: 'slot_2', label: '2:00 PM - 4:30 PM', value: '2pm-4:30pm' },
  { id: 'slot_3', label: 'After 8:00 PM', value: 'after-8pm' }
];

/**
 * Shipping tiers configuration
 */
export const SHIPPING_TIERS = {
  FREE_THRESHOLD: 999,
  REDUCED_THRESHOLD: 249,
  REDUCED_CHARGE: 49,
  STANDARD_CHARGE: 149
};
