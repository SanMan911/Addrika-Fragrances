/**
 * Custom hook for discount code management
 * Handles coupon validation, application, and hints
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useDiscountCode = (cart, getCartTotal, deliveryMode) => {
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountHints, setDiscountHints] = useState([]);

  // Clear discount when switching to self-pickup
  useEffect(() => {
    if (deliveryMode === 'self_pickup') {
      setAppliedDiscount(null);
      setDiscountCode('');
      setDiscountHints([]);
    }
  }, [deliveryMode]);

  // Fetch discount hints - ONLY for shipping mode
  useEffect(() => {
    const fetchDiscountHints = async () => {
      if (deliveryMode !== 'shipping') {
        setDiscountHints([]);
        return;
      }
      
      const subtotal = getCartTotal();
      try {
        const response = await axios.get(`${API_URL}/api/discount-codes/available?subtotal=${subtotal}`);
        setDiscountHints(response.data?.hints || []);
      } catch (error) {
        console.error('Failed to fetch discount hints:', error);
      }
    };
    
    if (cart.length > 0) {
      fetchDiscountHints();
    }
  }, [cart, getCartTotal, deliveryMode]);

  // Apply discount code
  const handleApplyDiscount = useCallback(async () => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code');
      return;
    }

    setDiscountLoading(true);
    try {
      const mrpTotal = cart.reduce((total, item) => {
        return total + ((item.mrp || item.price) * item.quantity);
      }, 0);
      
      const response = await axios.post(
        `${API_URL}/api/discount-codes/validate?code=${encodeURIComponent(discountCode)}&subtotal=${mrpTotal}&mrp_total=${mrpTotal}`,
        {},
        { withCredentials: true }
      );
      
      setAppliedDiscount(response.data);
      toast.success(`Discount code applied! You save ₹${response.data.discountAmount}`);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Invalid discount code';
      toast.error(errorMessage);
      setAppliedDiscount(null);
    } finally {
      setDiscountLoading(false);
    }
  }, [discountCode, cart]);

  // Remove discount code
  const handleRemoveDiscount = useCallback(() => {
    setAppliedDiscount(null);
    setDiscountCode('');
    toast.info('Discount code removed');
  }, []);

  return {
    discountCode,
    setDiscountCode,
    appliedDiscount,
    discountLoading,
    discountHints,
    handleApplyDiscount,
    handleRemoveDiscount
  };
};

export default useDiscountCode;
