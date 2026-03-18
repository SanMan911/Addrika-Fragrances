/**
 * International Pricing & Currency Configuration
 * 
 * Tiered pricing based on regional economic factors:
 * - Tier 1 (Premium): Developed economies - highest markup
 * - Tier 2 (Standard): EU Zone & developed Asian - medium markup
 * - Tier 3 (Emerging): Emerging markets - lower markup
 * - Tier 4 (Developing): Developing nations - minimal markup
 * - India: Base INR pricing
 */

// Base prices in USD
export const BASE_PRICES_USD = {
  '50g': 5,    // $5 USD base
  '200g': 10,  // $10 USD base
};

// Regional pricing multipliers
export const PRICING_TIERS = {
  // Tier 1 - Premium Markets (1.4x multiplier)
  tier1: {
    multiplier: 1.4,
    countries: [
      'US', 'CA', // North America
      'GB', 'CH', 'NO', 'SE', 'DK', 'IS', // Europe (non-EU premium)
      'AU', 'NZ', // Oceania
      'SG', 'HK', 'JP', // Asia Premium
      'AE', 'SA', 'QA', 'KW', 'BH', 'OM', // Gulf States
    ]
  },
  
  // Tier 2 - Standard Markets (1.2x multiplier) - Includes all EU
  tier2: {
    multiplier: 1.2,
    countries: [
      // EU Zone - Single pricing
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
      // Other developed
      'KR', 'TW', 'IL',
    ]
  },
  
  // Tier 3 - Emerging Markets (1.0x - base price)
  tier3: {
    multiplier: 1.0,
    countries: [
      'BR', 'MX', 'AR', 'CL', 'CO', 'PE', // Latin America
      'ZA', // South Africa
      'TH', 'MY', 'ID', 'VN', 'PH', // Southeast Asia
      'TR', 'RU', 'UA', // Eastern Europe/Eurasia
      'CN', // China
    ]
  },
  
  // Tier 4 - Developing Markets (0.8x multiplier)
  tier4: {
    multiplier: 0.8,
    countries: [
      // Africa
      'NG', 'KE', 'GH', 'TZ', 'UG', 'ET', 'EG', 'MA', 'DZ', 'TN',
      'ZW', 'ZM', 'RW', 'SN', 'CI', 'CM', 'AO', 'MZ', 'MW', 'BW',
      // South Asia (excluding India)
      'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA',
      // Central Asia
      'KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF',
      // Other developing
      'IQ', 'SY', 'YE', 'JO', 'LB',
    ]
  },
  
  // India - Base INR pricing (handled separately)
  india: {
    multiplier: null, // Uses INR pricing from mockData
    countries: ['IN']
  }
};

// Currency codes by country
export const COUNTRY_CURRENCIES = {
  // Major currencies
  'US': 'USD', 'CA': 'CAD', 'GB': 'GBP', 'AU': 'AUD', 'NZ': 'NZD',
  'JP': 'JPY', 'CN': 'CNY', 'HK': 'HKD', 'SG': 'SGD', 'KR': 'KRW',
  'IN': 'INR', 'AE': 'AED', 'SA': 'SAR', 'CH': 'CHF', 'NO': 'NOK',
  'SE': 'SEK', 'DK': 'DKK', 'RU': 'RUB', 'BR': 'BRL', 'MX': 'MXN',
  'ZA': 'ZAR', 'TH': 'THB', 'MY': 'MYR', 'ID': 'IDR', 'PH': 'PHP',
  'VN': 'VND', 'PK': 'PKR', 'BD': 'BDT', 'LK': 'LKR', 'NP': 'NPR',
  'TR': 'TRY', 'IL': 'ILS', 'EG': 'EGP', 'NG': 'NGN', 'KE': 'KES',
  // EU countries use EUR
  'AT': 'EUR', 'BE': 'EUR', 'BG': 'BGN', 'HR': 'EUR', 'CY': 'EUR',
  'CZ': 'CZK', 'EE': 'EUR', 'FI': 'EUR', 'FR': 'EUR', 'DE': 'EUR',
  'GR': 'EUR', 'HU': 'HUF', 'IE': 'EUR', 'IT': 'EUR', 'LV': 'EUR',
  'LT': 'EUR', 'LU': 'EUR', 'MT': 'EUR', 'NL': 'EUR', 'PL': 'PLN',
  'PT': 'EUR', 'RO': 'RON', 'SK': 'EUR', 'SI': 'EUR', 'ES': 'EUR',
};

// Currencies supported by RazorPay International
export const RAZORPAY_SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD', 'CNY', 'SEK', 
  'NZD', 'MXN', 'HKD', 'NOK', 'DKK', 'CHF', 'CZK', 'HUF', 'ILS',
  'JPY', 'MYR', 'PHP', 'PLN', 'RON', 'RUB', 'THB', 'TRY', 'TWD',
  'ZAR', 'SAR', 'BRL', 'INR'
];

// Currency symbols
export const CURRENCY_SYMBOLS = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'AUD': 'A$',
  'CAD': 'C$', 'SGD': 'S$', 'AED': 'د.إ', 'JPY': '¥', 'CNY': '¥',
  'CHF': 'Fr', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'NZD': 'NZ$',
  'HKD': 'HK$', 'MYR': 'RM', 'THB': '฿', 'PHP': '₱', 'KRW': '₩',
  'ZAR': 'R', 'BRL': 'R$', 'MXN': 'Mex$', 'TRY': '₺', 'RUB': '₽',
  'PLN': 'zł', 'CZK': 'Kč', 'HUF': 'Ft', 'RON': 'lei', 'ILS': '₪',
  'SAR': 'ر.س', 'PKR': '₨', 'BDT': '৳', 'LKR': 'Rs', 'NPR': 'रू',
  'IDR': 'Rp', 'VND': '₫', 'NGN': '₦', 'KES': 'KSh', 'EGP': 'E£',
};

// Approximate exchange rates (updated periodically)
// In production, use a real-time API like exchangerate-api.com
export const EXCHANGE_RATES_TO_USD = {
  'USD': 1, 'EUR': 0.92, 'GBP': 0.79, 'INR': 83.5, 'AUD': 1.53,
  'CAD': 1.36, 'SGD': 1.34, 'AED': 3.67, 'JPY': 149, 'CNY': 7.24,
  'CHF': 0.88, 'SEK': 10.5, 'NOK': 10.8, 'DKK': 6.9, 'NZD': 1.64,
  'HKD': 7.82, 'MYR': 4.72, 'THB': 35.8, 'PHP': 56.5, 'KRW': 1320,
  'ZAR': 18.9, 'BRL': 4.97, 'MXN': 17.2, 'TRY': 32.5, 'RUB': 92,
  'PLN': 4.02, 'CZK': 23.5, 'HUF': 365, 'RON': 4.6, 'ILS': 3.65,
  'SAR': 3.75, 'PKR': 278, 'BDT': 110, 'LKR': 325, 'NPR': 133,
  'IDR': 15700, 'VND': 24500, 'NGN': 1550, 'KES': 153, 'EGP': 31,
};

/**
 * Get pricing tier for a country
 */
export const getPricingTier = (countryCode) => {
  for (const [tierName, tier] of Object.entries(PRICING_TIERS)) {
    if (tier.countries.includes(countryCode)) {
      return { name: tierName, ...tier };
    }
  }
  // Default to tier3 for unknown countries
  return { name: 'tier3', ...PRICING_TIERS.tier3 };
};

/**
 * Get currency for a country
 */
export const getCurrencyForCountry = (countryCode) => {
  return COUNTRY_CURRENCIES[countryCode] || 'USD';
};

/**
 * Check if currency is supported by RazorPay
 */
export const isRazorPaySupported = (currency) => {
  return RAZORPAY_SUPPORTED_CURRENCIES.includes(currency);
};

/**
 * Convert USD to local currency
 */
export const convertFromUSD = (amountUSD, targetCurrency) => {
  const rate = EXCHANGE_RATES_TO_USD[targetCurrency] || 1;
  return amountUSD * rate;
};

/**
 * Get international price for a size
 */
export const getInternationalPrice = (size, countryCode) => {
  if (countryCode === 'IN') {
    return null; // Use INR pricing from product data
  }
  
  const basePrice = BASE_PRICES_USD[size] || BASE_PRICES_USD['50g'];
  const tier = getPricingTier(countryCode);
  const currency = getCurrencyForCountry(countryCode);
  
  // Apply tier multiplier
  const tieredPriceUSD = basePrice * (tier.multiplier || 1);
  
  // Convert to local currency
  const localPrice = convertFromUSD(tieredPriceUSD, currency);
  
  // Check RazorPay support
  const razorPaySupported = isRazorPaySupported(currency);
  
  return {
    priceUSD: tieredPriceUSD,
    priceLocal: Math.round(localPrice * 100) / 100, // Round to 2 decimals
    currency: currency,
    currencySymbol: CURRENCY_SYMBOLS[currency] || currency,
    razorPaySupported: razorPaySupported,
    fallbackCurrency: razorPaySupported ? null : 'USD',
    tier: tier.name,
  };
};

/**
 * Format price with currency symbol
 */
export const formatPrice = (amount, currency) => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  
  // For currencies with large values, don't show decimals
  const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'HUF'];
  
  if (noDecimalCurrencies.includes(currency)) {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Detect user's country from various sources
 */
export const detectUserCountry = async () => {
  // Try to get from stored preference first
  const stored = localStorage.getItem('addrika_user_country');
  if (stored) {
    return stored;
  }
  
  // Try IP geolocation
  try {
    const response = await fetch('https://ipapi.co/json/', { timeout: 3000 });
    if (response.ok) {
      const data = await response.json();
      const country = data.country_code || data.country;
      if (country) {
        localStorage.setItem('addrika_user_country', country);
        return country;
      }
    }
  } catch (e) {
    console.warn('Geo detection failed:', e);
  }
  
  // Try browser locale as fallback
  const locale = navigator.language || navigator.userLanguage;
  if (locale) {
    const parts = locale.split('-');
    if (parts.length > 1) {
      return parts[1].toUpperCase();
    }
  }
  
  // Default to US
  return 'US';
};

export default {
  BASE_PRICES_USD,
  PRICING_TIERS,
  COUNTRY_CURRENCIES,
  RAZORPAY_SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  EXCHANGE_RATES_TO_USD,
  getPricingTier,
  getCurrencyForCountry,
  isRazorPaySupported,
  convertFromUSD,
  getInternationalPrice,
  formatPrice,
  detectUserCountry,
};
