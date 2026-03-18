/**
 * Subdomain Detection Utility
 * Detects which portal to show based on the current subdomain
 */

export const PORTALS = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  RETAILER: 'retailer'
};

/**
 * Get current portal based on subdomain
 * @returns {string} One of PORTALS values
 */
export const getCurrentPortal = () => {
  const hostname = window.location.hostname;
  
  // Check for admin subdomain
  if (hostname.startsWith('admin.')) {
    return PORTALS.ADMIN;
  }
  
  // Check for retailer subdomain
  if (hostname.startsWith('retailer.')) {
    return PORTALS.RETAILER;
  }
  
  // For localhost development, check URL path or query param
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const urlParams = new URLSearchParams(window.location.search);
    const portalParam = urlParams.get('portal');
    if (portalParam === 'admin') return PORTALS.ADMIN;
    if (portalParam === 'retailer') return PORTALS.RETAILER;
    
    // Also check path for development
    if (window.location.pathname.startsWith('/retailer')) {
      return PORTALS.RETAILER;
    }
  }
  
  // Default to customer portal
  return PORTALS.CUSTOMER;
};

/**
 * Check if current portal is admin
 */
export const isAdminPortal = () => getCurrentPortal() === PORTALS.ADMIN;

/**
 * Check if current portal is retailer
 */
export const isRetailerPortal = () => getCurrentPortal() === PORTALS.RETAILER;

/**
 * Check if current portal is customer
 */
export const isCustomerPortal = () => getCurrentPortal() === PORTALS.CUSTOMER;

/**
 * Get portal display name
 */
export const getPortalName = () => {
  const portal = getCurrentPortal();
  switch (portal) {
    case PORTALS.ADMIN: return 'Admin Portal';
    case PORTALS.RETAILER: return 'Retailer Portal';
    default: return 'Addrika Store';
  }
};
