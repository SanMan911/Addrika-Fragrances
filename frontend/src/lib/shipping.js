/**
 * International Shipping Configuration
 * 
 * Shipping options from India to international destinations.
 * Rates are zone-based estimates. For production, integrate with
 * shipping aggregator APIs like ShipRocket, EasyPost, or direct carrier APIs.
 */

// Shipping zones based on distance/logistics from India
export const SHIPPING_ZONES = {
  // Zone 1 - South Asia & Near neighbors
  zone1: {
    name: 'South Asia',
    countries: ['BD', 'NP', 'LK', 'BT', 'MM', 'PK', 'AF'],
    deliveryDays: { economy: '7-14', express: '3-5' },
  },
  
  // Zone 2 - Southeast Asia & Middle East
  zone2: {
    name: 'SE Asia & Middle East',
    countries: [
      'TH', 'MY', 'SG', 'ID', 'VN', 'PH', 'KH', 'LA',
      'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL',
    ],
    deliveryDays: { economy: '10-18', express: '4-7' },
  },
  
  // Zone 3 - East Asia & Oceania  
  zone3: {
    name: 'East Asia & Pacific',
    countries: ['CN', 'JP', 'KR', 'TW', 'HK', 'AU', 'NZ'],
    deliveryDays: { economy: '12-21', express: '5-8' },
  },
  
  // Zone 4 - Europe
  zone4: {
    name: 'Europe',
    countries: [
      'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE',
      'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'HU', 'RO',
      'BG', 'HR', 'SK', 'SI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY',
      'TR', 'RU', 'UA',
    ],
    deliveryDays: { economy: '14-25', express: '5-10' },
  },
  
  // Zone 5 - Americas
  zone5: {
    name: 'Americas',
    countries: [
      'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE',
      'EC', 'UY', 'PY', 'BO', 'CR', 'PA', 'GT', 'CU', 'DO', 'PR',
    ],
    deliveryDays: { economy: '15-28', express: '6-12' },
  },
  
  // Zone 6 - Africa
  zone6: {
    name: 'Africa',
    countries: [
      'ZA', 'EG', 'NG', 'KE', 'MA', 'TN', 'DZ', 'GH', 'TZ', 'UG',
      'ET', 'ZW', 'ZM', 'RW', 'SN', 'CI', 'CM', 'AO', 'MZ', 'MW', 'BW',
    ],
    deliveryDays: { economy: '18-30', express: '7-14' },
  },
};

// Shipping carriers available for international orders
export const SHIPPING_CARRIERS = {
  india_post_ems: {
    id: 'india_post_ems',
    name: 'India Post EMS',
    logo: '/images/carriers/india-post.png',
    type: 'economy',
    description: 'Government postal service - most economical option',
    tracking: true,
    insurance: false,
    features: ['Customs clearance included', 'Wide coverage', 'Budget-friendly'],
  },
  
  india_post_registered: {
    id: 'india_post_registered',
    name: 'India Post Registered',
    logo: '/images/carriers/india-post.png',
    type: 'economy',
    description: 'Registered international mail with tracking',
    tracking: true,
    insurance: false,
    features: ['Basic tracking', 'Very affordable', 'Delivery confirmation'],
  },
  
  dhl_express: {
    id: 'dhl_express',
    name: 'DHL Express',
    logo: '/images/carriers/dhl.png',
    type: 'express',
    description: 'Premium express delivery worldwide',
    tracking: true,
    insurance: true,
    features: ['Fastest delivery', 'Real-time tracking', 'Door-to-door', 'Insurance included'],
  },
  
  fedex_international: {
    id: 'fedex_international',
    name: 'FedEx International',
    logo: '/images/carriers/fedex.png',
    type: 'express',
    description: 'Reliable express international shipping',
    tracking: true,
    insurance: true,
    features: ['Express delivery', 'Detailed tracking', 'Customs support'],
  },
  
  aramex: {
    id: 'aramex',
    name: 'Aramex',
    logo: '/images/carriers/aramex.png',
    type: 'standard',
    description: 'Good balance of speed and cost',
    tracking: true,
    insurance: false,
    features: ['Mid-range pricing', 'Good Middle East coverage', 'Reliable tracking'],
  },
  
  dtdc_international: {
    id: 'dtdc_international',
    name: 'DTDC International',
    logo: '/images/carriers/dtdc.png',
    type: 'standard',
    description: 'Indian courier with international reach',
    tracking: true,
    insurance: false,
    features: ['Competitive rates', 'Good Asian coverage', 'Indian support'],
  },
};

// Zone-based shipping rates (in USD)
// These are estimates - integrate with shipping API for real-time rates
export const SHIPPING_RATES = {
  zone1: {
    india_post_ems: { base: 8, perKg: 3 },
    india_post_registered: { base: 5, perKg: 2 },
    dhl_express: { base: 25, perKg: 8 },
    aramex: { base: 15, perKg: 5 },
    dtdc_international: { base: 12, perKg: 4 },
  },
  zone2: {
    india_post_ems: { base: 12, perKg: 4 },
    india_post_registered: { base: 7, perKg: 3 },
    dhl_express: { base: 35, perKg: 10 },
    fedex_international: { base: 38, perKg: 12 },
    aramex: { base: 20, perKg: 6 },
    dtdc_international: { base: 18, perKg: 5 },
  },
  zone3: {
    india_post_ems: { base: 15, perKg: 5 },
    india_post_registered: { base: 9, perKg: 3 },
    dhl_express: { base: 40, perKg: 12 },
    fedex_international: { base: 42, perKg: 14 },
    aramex: { base: 25, perKg: 8 },
  },
  zone4: {
    india_post_ems: { base: 18, perKg: 6 },
    india_post_registered: { base: 11, perKg: 4 },
    dhl_express: { base: 45, perKg: 15 },
    fedex_international: { base: 48, perKg: 16 },
    aramex: { base: 30, perKg: 10 },
  },
  zone5: {
    india_post_ems: { base: 20, perKg: 7 },
    india_post_registered: { base: 12, perKg: 5 },
    dhl_express: { base: 55, perKg: 18 },
    fedex_international: { base: 58, perKg: 20 },
    aramex: { base: 35, perKg: 12 },
  },
  zone6: {
    india_post_ems: { base: 22, perKg: 8 },
    india_post_registered: { base: 14, perKg: 5 },
    dhl_express: { base: 60, perKg: 20 },
    fedex_international: { base: 65, perKg: 22 },
    aramex: { base: 40, perKg: 14 },
  },
};

// Product weights (approximate)
export const PRODUCT_WEIGHTS = {
  '50g': 0.1,   // 100 grams total with packaging
  '200g': 0.3,  // 300 grams total with packaging
};

/**
 * Get shipping zone for a country
 */
export const getShippingZone = (countryCode) => {
  for (const [zoneId, zone] of Object.entries(SHIPPING_ZONES)) {
    if (zone.countries.includes(countryCode)) {
      return { id: zoneId, ...zone };
    }
  }
  // Default to zone5 (Americas) for unknown countries
  return { id: 'zone5', ...SHIPPING_ZONES.zone5 };
};

/**
 * Calculate shipping options for an order
 */
export const calculateShippingOptions = (countryCode, cartItems) => {
  // India has free shipping
  if (countryCode === 'IN') {
    return [{
      id: 'free_shipping',
      name: 'Free Standard Shipping',
      carrier: 'Various',
      price: 0,
      currency: 'INR',
      deliveryDays: '5-7 business days',
      type: 'standard',
    }];
  }
  
  const zone = getShippingZone(countryCode);
  const zoneRates = SHIPPING_RATES[zone.id];
  
  if (!zoneRates) {
    return [];
  }
  
  // Calculate total weight
  const totalWeight = cartItems.reduce((sum, item) => {
    const weight = PRODUCT_WEIGHTS[item.size] || 0.15;
    return sum + (weight * item.quantity);
  }, 0);
  
  // Build shipping options
  const options = [];
  
  for (const [carrierId, rate] of Object.entries(zoneRates)) {
    const carrier = SHIPPING_CARRIERS[carrierId];
    if (!carrier) continue;
    
    // Calculate price: base + (perKg * weight), minimum 1kg
    const chargeableWeight = Math.max(totalWeight, 0.5);
    const price = rate.base + (rate.perKg * chargeableWeight);
    
    options.push({
      id: carrierId,
      name: carrier.name,
      carrier: carrier.name,
      logo: carrier.logo,
      price: Math.round(price * 100) / 100,
      currency: 'USD',
      deliveryDays: zone.deliveryDays[carrier.type] || '14-28',
      type: carrier.type,
      description: carrier.description,
      features: carrier.features,
      tracking: carrier.tracking,
      insurance: carrier.insurance,
    });
  }
  
  // Sort by price (cheapest first)
  options.sort((a, b) => a.price - b.price);
  
  return options;
};

/**
 * Get recommended shipping option
 */
export const getRecommendedShipping = (countryCode, cartItems) => {
  const options = calculateShippingOptions(countryCode, cartItems);
  
  // Recommend the cheapest express option, or cheapest overall
  const expressOption = options.find(o => o.type === 'express');
  const standardOption = options.find(o => o.type === 'standard');
  
  return standardOption || expressOption || options[0];
};

// Country list for dropdown
export const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  // Tier 1
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  // EU
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  // Asia
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  // Middle East
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  // Americas
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  // Oceania
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  // Africa
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  // Eastern Europe
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
].sort((a, b) => a.name.localeCompare(b.name));

export default {
  SHIPPING_ZONES,
  SHIPPING_CARRIERS,
  SHIPPING_RATES,
  PRODUCT_WEIGHTS,
  COUNTRIES,
  getShippingZone,
  calculateShippingOptions,
  getRecommendedShipping,
};
