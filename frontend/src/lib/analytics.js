/**
 * Google Analytics Integration
 * 
 * PLACEHOLDER: Replace GA_MEASUREMENT_ID with your actual Google Analytics 4 Measurement ID
 * 
 * How to get your Measurement ID:
 * 1. Go to https://analytics.google.com
 * 2. Click Admin (gear icon) → Data Streams
 * 3. Select your web stream or create a new one
 * 4. Copy the Measurement ID (format: G-XXXXXXXXXX)
 * 
 * @see https://support.google.com/analytics/answer/9539598
 */

// Google Analytics 4 Measurement ID (configured via env or hardcoded)
export const GA_MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID || 'G-9CBN63VGCK';

/**
 * Initialize Google Analytics
 * Call this in your App.js or index.js on app load
 */
export const initGA = () => {
  if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    console.warn('[Analytics] Google Analytics not configured. Replace GA_MEASUREMENT_ID in src/lib/analytics.js');
    return;
  }

  // Load gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_location: window.location.href,
  });

  console.log('[Analytics] Google Analytics initialized');
};

/**
 * Track page views
 * Call this on route changes
 */
export const trackPageView = (path, title) => {
  if (typeof window.gtag !== 'function' || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  });
};

/**
 * Track custom events
 * @param {string} action - Event action (e.g., 'click', 'purchase')
 * @param {string} category - Event category (e.g., 'ecommerce', 'engagement')
 * @param {string} label - Event label (optional)
 * @param {number} value - Event value (optional)
 */
export const trackEvent = (action, category, label, value) => {
  if (typeof window.gtag !== 'function' || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

/**
 * Track e-commerce events
 */
export const trackPurchase = (orderData) => {
  if (typeof window.gtag !== 'function' || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  
  window.gtag('event', 'purchase', {
    transaction_id: orderData.orderNumber,
    value: orderData.total,
    currency: 'INR',
    items: orderData.items?.map(item => ({
      item_id: item.productId,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

export const trackAddToCart = (item) => {
  if (typeof window.gtag !== 'function' || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  
  window.gtag('event', 'add_to_cart', {
    currency: 'INR',
    value: item.price * item.quantity,
    items: [{
      item_id: item.productId,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    }],
  });
};

export const trackBeginCheckout = (cartItems, total) => {
  if (typeof window.gtag !== 'function' || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  
  window.gtag('event', 'begin_checkout', {
    currency: 'INR',
    value: total,
    items: cartItems.map(item => ({
      item_id: item.productId,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

export default {
  GA_MEASUREMENT_ID,
  initGA,
  trackPageView,
  trackEvent,
  trackPurchase,
  trackAddToCart,
  trackBeginCheckout,
};
