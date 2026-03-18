/**
 * Custom hook for Razorpay payment processing
 */
import { useCallback, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { TOKEN_AMOUNT } from './utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Load Razorpay script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Generate or get session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem('addrika_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('addrika_session_id', sessionId);
  }
  return sessionId;
};

export const useRazorpayPayment = (cart, billingData, shippingData, useDifferentShipping, deliveryMode, selectedPickupStore, pickupPaymentOption, selectedTimeSlot, appliedDiscount, isB2B, gstNumber, businessName, clearCart, markCartConverted, user, coinRedemption = null) => {
  const [loading, setLoading] = useState(false);

  const processPayment = useCallback(async (validateForm) => {
    if (!validateForm()) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    setLoading(true);

    try {
      const sessionId = getSessionId();
      
      // Prepare order payload
      const orderPayload = {
        sessionId,
        userId: user?.user_id || null,
        items: cart.map(item => ({
          productId: item.productId || item.id,
          size: item.size,
          quantity: item.quantity
        })),
        billing: {
          salutation: billingData.salutation,
          name: billingData.name,
          email: billingData.email,
          phone: billingData.phone,
          address: billingData.address,
          city: billingData.city,
          state: billingData.state,
          pincode: billingData.pincode
        },
        use_different_shipping: useDifferentShipping,
        paymentMethod: 'razorpay',
        discountCode: deliveryMode === 'shipping' && appliedDiscount ? appliedDiscount.code : null,
        delivery_mode: deliveryMode,
        pickup_store: deliveryMode === 'self_pickup' ? selectedPickupStore : null,
        pickup_payment_option: deliveryMode === 'self_pickup' ? pickupPaymentOption : null,
        token_amount: deliveryMode === 'self_pickup' && pickupPaymentOption === 'pay_at_store' ? TOKEN_AMOUNT : null,
        pickup_time_slot: deliveryMode === 'self_pickup' && selectedTimeSlot ? selectedTimeSlot.label : null,
        // Coin redemption
        coin_redemption: deliveryMode === 'shipping' && coinRedemption ? {
          coins_to_redeem: coinRedemption.coins,
          redemption_value: coinRedemption.value
        } : null
      };
      
      // Add shipping address if different
      if (useDifferentShipping && deliveryMode === 'shipping') {
        orderPayload.shipping = {
          salutation: shippingData.salutation,
          name: shippingData.name,
          email: shippingData.email || billingData.email,
          phone: shippingData.phone,
          address: shippingData.address,
          city: shippingData.city,
          state: shippingData.state,
          pincode: shippingData.pincode
        };
      }
      
      // Add GST info if B2B
      if (isB2B && gstNumber) {
        orderPayload.gst_info = {
          is_b2b: true,
          gst_number: gstNumber.toUpperCase(),
          business_name: businessName || billingData.name
        };
      }
      
      // Create order on backend
      const orderResponse = await axios.post(`${API_URL}/api/orders/create`, orderPayload, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      const orderData = orderResponse.data;

      if (!orderData.razorpay) {
        throw new Error('Payment gateway not configured. Please contact support.');
      }

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment gateway. Please refresh and try again.');
      }

      // Configure Razorpay options
      const razorpayOptions = {
        key: orderData.razorpay.keyId,
        amount: orderData.razorpay.amount,
        currency: orderData.razorpay.currency,
        order_id: orderData.razorpay.orderId,
        name: orderData.razorpay.name || 'Centsibl Traders Private Limited',
        description: orderData.razorpay.description || `Order ${orderData.order_number}`,
        image: '/favicon.ico',
        prefill: {
          name: orderData.razorpay.prefill?.name || billingData.name,
          email: orderData.razorpay.prefill?.email || billingData.email,
          contact: orderData.razorpay.prefill?.contact || billingData.phone
        },
        notes: {
          order_number: orderData.order_number
        },
        theme: {
          color: '#1e3a52'
        },
        retry: {
          enabled: true,
          max_count: 4
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setLoading(false);
            toast.info('Payment cancelled');
          }
        },
        handler: async function(response) {
          try {
            const verifyResponse = await axios.post(`${API_URL}/api/orders/verify-payment`, null, {
              params: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                session_id: orderData.session_id
              },
              withCredentials: true
            });

            if (verifyResponse.data.success) {
              const confirmedOrderNumber = verifyResponse.data.order_number;
              
              const orderForThankYou = {
                orderNumber: confirmedOrderNumber,
                items: cart,
                billing: billingData,
                shipping: useDifferentShipping ? shippingData : billingData,
                pricing: orderData.pricing,
                paymentStatus: 'paid',
                paymentMode: verifyResponse.data.payment_mode,
                total: orderData.pricing.final_total
              };
              sessionStorage.setItem('lastOrder', JSON.stringify(orderForThankYou));
              
              markCartConverted();
              clearCart();
              toast.success('Payment successful! Order confirmed.');
              
              window.location.href = `/thank-you?order=${confirmedOrderNumber}`;
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (err) {
            console.error('Payment verification error:', err);
            toast.error(err.response?.data?.detail || err.message || 'Payment verification failed');
          }
        }
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.on('payment.failed', function(response) {
        console.error('Payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      razorpay.open();
      setLoading(false);

    } catch (error) {
      console.error('Checkout error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to place order';
      toast.error(errorMessage);
      setLoading(false);
    }
  }, [cart, billingData, shippingData, useDifferentShipping, deliveryMode, selectedPickupStore, pickupPaymentOption, selectedTimeSlot, appliedDiscount, isB2B, gstNumber, businessName, clearCart, markCartConverted, user, coinRedemption]);

  return {
    loading,
    processPayment
  };
};

export default useRazorpayPayment;
