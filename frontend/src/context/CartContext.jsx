import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const CartContext = createContext();
const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
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

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sessionId] = useState(getSessionId);
  const [isCartLoaded, setIsCartLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('addrika_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart from localStorage');
      }
    }
    setIsCartLoaded(true);
  }, []);

  // Sync cart to backend for abandoned cart tracking
  const syncCartToBackend = useCallback(async (cartItems) => {
    try {
      await fetch(`${API_URL}/api/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: cartItems })
      });
    } catch (error) {
      // Silently fail - cart sync is optional
      console.debug('Cart sync skipped:', error.message);
    }
  }, []);

  // Save cart to localStorage and sync to backend whenever it changes
  useEffect(() => {
    if (isCartLoaded) {
      localStorage.setItem('addrika_cart', JSON.stringify(cart));
      // Debounce backend sync to avoid too many requests
      const syncTimeout = setTimeout(() => {
        syncCartToBackend(cart);
      }, 2000); // Wait 2 seconds after last change
      return () => clearTimeout(syncTimeout);
    }
  }, [cart, isCartLoaded, syncCartToBackend]);

  const addToCart = (product, size, quantity = 1) => {
    const productId = product.id;
    const existingItemIndex = cart.findIndex(
      item => (item.productId || item.id) === productId && item.size === size
    );

    if (existingItemIndex > -1) {
      // Update quantity if item already in cart
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
      setCart(updatedCart);
      toast.success(`Updated ${product.name} quantity in cart`);
    } else {
      // Get size-specific image if available
      const sizeData = product.sizes?.find(s => s.size === size);
      const sizeImage = sizeData?.images?.[0] || product.image;
      const mrp = size === '50g' ? 110 : 402;
      
      // Add new item to cart with size-specific image
      // All products at MRP - discounts only via coupon codes
      const newItem = {
        productId: productId,
        id: productId, // Keep for backwards compatibility
        name: product.name,
        subtitle: product.subtitle,
        image: sizeImage, // Use size-specific image
        size: size,
        mrp: mrp,
        price: mrp,  // MRP only - no general discount
        quantity: quantity
      };
      setCart([...cart, newItem]);
      toast.success(`${product.name} added to cart!`);
    }
  };

  const removeFromCart = (itemId, size) => {
    setCart(cart.filter(item => !((item.productId || item.id) === itemId && item.size === size)));
    toast.success('Item removed from cart');
  };

  const updateQuantity = (itemId, size, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId, size);
      return;
    }
    
    const updatedCart = cart.map(item =>
      (item.productId || item.id) === itemId && item.size === size
        ? { ...item, quantity: quantity }
        : item
    );
    setCart(updatedCart);
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('addrika_cart');
  };

  // Mark cart as converted (order placed) for abandoned cart tracking
  const markCartConverted = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/cart/converted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (error) {
      console.debug('Cart conversion tracking skipped:', error.message);
    }
  }, []);

  const getCartTotal = () => {
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    return subtotal;
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const getBulkDiscount = () => {
    // Bulk discounts removed - now handled via coupon codes only
    return 0;
  };

  const getBulkDiscountPercent = () => {
    // Bulk discounts removed - now handled via coupon codes only
    return 0;
  };

  const getCartWeight = () => {
    // Weight calculation for ShipRocket shipping:
    // 50g packet = 80g (incl. packaging & volumetric consideration)
    // 200g jar = 350g (incl. packaging & volumetric consideration)
    return cart.reduce((total, item) => {
      const itemWeight = item.size === '50g' ? 80 : 350; // grams per unit
      return total + (itemWeight * item.quantity);
    }, 0);
  };

  // ============================================================================
  // SIMPLIFIED SHIPPING LOGIC
  // Based on final discounted cart value:
  // - < ₹249: ₹149 flat shipping
  // - ≥ ₹249 and < ₹999: ₹49 shipping  
  // - ≥ ₹999: FREE shipping
  // ============================================================================

  const getShippingCharge = (discountedCartValue) => {
    // Use passed value or calculate from subtotal minus bulk discount
    const value = discountedCartValue !== undefined ? discountedCartValue : (getCartTotal() - getBulkDiscount());
    
    if (value < 249) {
      return 149;
    } else if (value < 999) {
      return 49;
    } else {
      return 0; // Free shipping
    }
  };

  const getShippingTier = (discountedCartValue) => {
    const value = discountedCartValue !== undefined ? discountedCartValue : (getCartTotal() - getBulkDiscount());
    
    if (value < 249) {
      return { charge: 149, label: "Standard Shipping", amountForNext: 249 - value };
    } else if (value < 999) {
      return { charge: 49, label: "Reduced Shipping", amountForFree: 999 - value };
    } else {
      return { charge: 0, label: "FREE Shipping", amountForFree: 0 };
    }
  };

  const getFreeShippingThreshold = () => {
    return 999;
  };

  const getFinalTotal = (discountedCartValue) => {
    const value = discountedCartValue !== undefined ? discountedCartValue : (getCartTotal() - getBulkDiscount());
    const shipping = getShippingCharge(value);
    return value + shipping;
  };

  const value = {
    cart,
    sessionId,
    isCartOpen,
    setIsCartOpen,
    isCartLoaded,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    markCartConverted,
    getCartTotal,
    getCartCount,
    getCartWeight,
    getBulkDiscount,
    getBulkDiscountPercent,
    getShippingCharge,
    getShippingTier,
    getFreeShippingThreshold,
    getFinalTotal
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
