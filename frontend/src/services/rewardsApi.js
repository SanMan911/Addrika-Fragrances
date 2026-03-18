/**
 * Rewards API hooks - shared fetch functions for rewards system
 */
const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Fetch with credentials included
 */
const fetchWithAuth = async (url, options = {}) => {
  return fetch(url, { ...options, credentials: 'include' });
};

/**
 * Fetch user's rewards balance
 */
export const fetchRewardsBalance = async () => {
  const response = await fetchWithAuth(`${API_URL}/api/rewards/balance`);
  if (!response.ok) throw new Error('Failed to fetch rewards');
  return response.json();
};

/**
 * Fetch rewards transaction history
 */
export const fetchRewardsHistory = async (page = 1, limit = 20) => {
  const response = await fetchWithAuth(`${API_URL}/api/rewards/history?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
};

/**
 * Fetch max redeemable coins for a cart value
 */
export const fetchMaxRedemption = async (cartValue) => {
  const response = await fetchWithAuth(`${API_URL}/api/rewards/max-redemption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart_value: cartValue })
  });
  if (!response.ok) throw new Error('Failed to fetch max redemption');
  return response.json();
};

/**
 * Validate coin redemption
 */
export const validateRedemption = async (coinsToRedeem) => {
  const response = await fetchWithAuth(`${API_URL}/api/rewards/validate-redemption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins_to_redeem: coinsToRedeem })
  });
  if (!response.ok) throw new Error('Failed to validate redemption');
  return response.json();
};

/**
 * Fetch rewards program info (public)
 */
export const fetchRewardsProgramInfo = async () => {
  const response = await fetch(`${API_URL}/api/rewards/info`);
  if (!response.ok) throw new Error('Failed to fetch program info');
  return response.json();
};

/**
 * Format date for display
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Rewards configuration constants (mirror backend config)
 */
export const REWARDS_CONFIG = {
  COINS_PER_125: 6.9,
  MIN_SPEND: 125,
  COIN_VALUE: 0.60,
  MIN_TO_REDEEM: 20,
  MAX_PERCENT: 50,
  VALIDITY_DAYS: 90
};
