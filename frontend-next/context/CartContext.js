'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('addrika_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('addrika_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  // Support both signatures: addToCart(item) and addToCart(product, size, quantity)
  const addToCart = (productOrItem, size, quantity = 1) => {
    let cartItem;
    
    if (size !== undefined) {
      // Called as addToCart(product, size, quantity)
      const product = productOrItem;
      cartItem = {
        productId: product.id,
        name: product.name,
        image: product.image,
        tagline: product.tagline,
        size: size,
        price: product.sizes?.find(s => s.size === size)?.price || 0,
        quantity: quantity
      };
    } else {
      // Called as addToCart(item) - legacy support
      cartItem = productOrItem;
    }
    
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (i) => i.productId === cartItem.productId && i.size === cartItem.size
      );
      
      if (existingIndex >= 0) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += cartItem.quantity || 1;
        return newCart;
      }
      
      return [...prevCart, { ...cartItem, quantity: cartItem.quantity || 1 }];
    });
  };

  const removeFromCart = (productId, size) => {
    setCart((prevCart) => 
      prevCart.filter((item) => !(item.productId === productId && item.size === size))
    );
  };

  const updateQuantity = (productId, size, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }
    
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId && item.size === size
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        isLoaded,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
