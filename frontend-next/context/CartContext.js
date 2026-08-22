'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

const CartContext = createContext();

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Guard so the mobile deep-link import only runs once per tab even when
// React StrictMode double-invokes the effect.
let _mobileCartImportRun = false;

async function importCartFromMobileLink(setCart) {
  if (_mobileCartImportRun) return;
  if (typeof window === 'undefined') return;
  // Retailer routes have their OWN mobile-cart hydration effect (see
  // `frontend-next/app/retailer/b2b/page.js`) that reads a different
  // payload shape and pre-fills a B2B quantity map. Bailing out here
  // keeps this B2C importer from stealing the ?cart+from params before
  // the B2B page's catalog-gated effect gets a chance to see them.
  // Path check uses a trailing slash so a future public route like
  // `/retailers-map` still gets the B2C hydration.
  const path = window.location.pathname;
  if (path === '/retailer' || path.startsWith('/retailer/')) return;
  const params = new URLSearchParams(window.location.search);
  const rawCart = params.get('cart');
  const from = params.get('from');
  if (!rawCart || (from !== 'mobile' && from !== 'mobile-share')) return;
  _mobileCartImportRun = true;

  let payload;
  try {
    // URLSearchParams.get() already URL-decoded the value once. The
    // mobile side URL-encodes the JSON string exactly ONCE, so decoding
    // a second time here would corrupt payloads that contain literal '%'
    // (e.g. sizes like "50g/50%") — parse the value as-is.
    payload = JSON.parse(rawCart);
    if (!Array.isArray(payload)) throw new Error('cart payload must be an array');
  } catch (e) {
    console.warn('Cart deep-link parse failed:', e);
    return;
  }

  // Strip the params from the URL so a refresh doesn't re-import.
  try {
    params.delete('cart');
    params.delete('from');
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextSearch ? '?' + nextSearch : ''}${window.location.hash}`,
    );
  } catch { /* non-fatal */ }

  // Hydrate the {productId,size,quantity} tuples with the fresh
  // product catalogue so the imported lines carry name/image/price.
  let products = [];
  try {
    const res = await fetch(`${API_URL}/api/products`);
    if (res.ok) products = await res.json();
  } catch (e) {
    console.warn('Cart deep-link product fetch failed:', e);
  }
  const byId = new Map(products.map((p) => [p.id, p]));

  const imported = [];
  for (const line of payload) {
    if (!line || !line.productId) continue;
    const product = byId.get(line.productId);
    if (!product) continue;
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    // Prefer the exact size the mobile app sent; fall back to the first
    // available size so a legacy `50g` label from the mobile shell still
    // lands on products that only carry `20g`/`100g` variants.
    const sizeInfo =
      sizes.find((s) => s.size === line.size) || sizes[0] || null;
    if (!sizeInfo) continue;
    imported.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      tagline: product.tagline,
      size: sizeInfo.size,
      price: sizeInfo.price || 0,
      quantity: Math.max(1, Number(line.quantity) || 1),
    });
  }
  if (imported.length === 0) return;

  // Mobile-share (WhatsApp) still MERGES so a colleague's link tops up the
  // receiver's own cart. Direct mobile hand-off (this device → web
  // checkout) REPLACES so the customer sees exactly what they built on
  // the phone — no stale localStorage items from a previous browser
  // session sneak in.
  setCart((prev) => {
    if (from === 'mobile') return imported;
    const next = [...prev];
    for (const it of imported) {
      const idx = next.findIndex(
        (n) => n.productId === it.productId && n.size === it.size,
      );
      if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + it.quantity };
      else next.push(it);
    }
    return next;
  });
  const label = from === 'mobile-share' ? 'shared with you' : 'from your phone';
  toast.success(`Cart ${label} — ${imported.length} item${imported.length === 1 ? '' : 's'} loaded`);
}

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

  // Bootstrap `?cart=…&from=mobile[-share]` deep-links coming from the
  // Aaroviah mobile shell (self hand-off *or* WhatsApp share from a
  // colleague). Runs after the localStorage cart is loaded so we don't
  // stomp on it.
  useEffect(() => {
    if (!isLoaded) return;
    importCartFromMobileLink(setCart);
  }, [isLoaded]);

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
