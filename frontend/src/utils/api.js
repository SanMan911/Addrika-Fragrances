/**
 * Centralized API Utilities
 * Reduces duplication across components
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Generic fetch wrapper with error handling
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Parse JSON if content exists
    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new APIError(
        data?.detail || data?.message || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    return { data, response };
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(error.message, 0, null);
  }
};

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Common API methods
 */
export const api = {
  get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
  
  post: (endpoint, body) => apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  
  put: (endpoint, body) => apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  
  patch: (endpoint, body) => apiFetch(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
};

/**
 * Retailer-specific API (uses retailer token)
 */
export const retailerApi = {
  fetch: async (endpoint, options = {}) => {
    const token = localStorage.getItem('retailer_token');
    return apiFetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });
  },
  
  get: (endpoint) => retailerApi.fetch(endpoint, { method: 'GET' }),
  
  post: (endpoint, body) => retailerApi.fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

/**
 * Format date for display
 */
export const formatDate = (dateStr, options = {}) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options,
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Format date with time
 */
export const formatDateTime = (dateStr) => {
  return formatDate(dateStr, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Debounce function for search inputs
 */
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Title case converter
 */
export const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default api;
