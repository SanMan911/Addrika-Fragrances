/**
 * Product Service - Fetches products from backend API
 * Merges with local enrichments for filtering and UI enhancements
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Local enrichments for products (filtering, detailed info)
// This data supplements the backend API response
const PRODUCT_ENRICHMENTS = {
  'kesar-chandan': {
    subtitle: 'Saffron Sandalwood',
    benefits: ['Enhancing focus & concentration', 'Promotes calm & tranquility', 'Purifies sacred spaces naturally', 'Ideal for mindfulness practices'],
    scentPyramid: {
      top: ['Saffron', 'Nutmeg', 'Cardamom'],
      heart: ['Sandalwood', 'Cedar', 'Rose'],
      base: ['Musk', 'Vanilla', 'Amber']
    },
    mood: ['meditative', 'relaxing'],
    notes: ['woody', 'spicy'],
    intensity: 'medium',
    reviews: [
      { name: 'Priya S.', rating: 5, comment: 'Absolutely divine fragrance! The saffron notes are so authentic and the sandalwood lingers beautifully. Perfect for my morning puja.', verified: true },
      { name: 'Rahul M.', rating: 5, comment: 'Best agarbatti I have ever used. The quality is exceptional and it burns evenly for over 40 minutes. Highly recommend!', verified: true },
      { name: 'Ananya K.', rating: 4, comment: 'Beautiful fragrance that fills the entire room. Great for meditation sessions. Will definitely buy again.', verified: true }
    ],
    reviewCount: 124
  },
  'regal-rose': {
    subtitle: 'With Pink Lotus & Ylang Ylang',
    benefits: ['Creates inviting aroma', 'Enhances home aromatherapy', 'Mood elevation & positivity', 'Great for gifting'],
    scentPyramid: {
      top: ['Pink Lotus', 'Bergamot', 'Green Leaves'],
      heart: ['Damask Rose', 'Ylang Ylang', 'Jasmine'],
      base: ['White Musk', 'Sandalwood', 'Honey']
    },
    mood: ['romantic', 'energizing'],
    notes: ['floral'],
    intensity: 'light',
    reviews: [
      { name: 'Meera R.', rating: 5, comment: 'The rose fragrance is so natural and not artificial at all. My guests always compliment how good my home smells!', verified: true },
      { name: 'Kavitha P.', rating: 5, comment: 'Gifted this to my mother and she loved it! The ylang ylang adds such a lovely depth to the rose.', verified: true },
      { name: 'Suresh N.', rating: 4, comment: 'Very pleasant and calming fragrance. Perfect for evening relaxation. Good value for money.', verified: true }
    ],
    reviewCount: 98
  },
  'oriental-oudh': {
    subtitle: 'Premium Agarwood',
    benefits: ['Long lasting fragrance', 'Promotes calm & relaxation', 'Traditional essence', 'Meditative properties'],
    scentPyramid: {
      top: ['Saffron', 'Rose', 'Citrus Zest'],
      heart: ['Agarwood (Oud)', 'Amber', 'Incense'],
      base: ['Vanilla', 'Smoky Woods', 'Leather']
    },
    mood: ['meditative', 'luxurious'],
    notes: ['woody', 'oriental'],
    intensity: 'strong',
    reviews: [
      { name: 'Arjun D.', rating: 5, comment: 'Exceptional quality oud incense! The agarwood scent is rich and authentic. This is the real deal, not like the synthetic ones in the market.', verified: true },
      { name: 'Fatima B.', rating: 5, comment: 'Reminds me of the traditional bakhoor from Dubai. The fragrance lasts for hours even after the stick burns out. Absolutely wonderful!', verified: true },
      { name: 'Vikram S.', rating: 5, comment: 'Premium quality that you can smell immediately. Perfect for special occasions and creating a luxurious atmosphere.', verified: true }
    ],
    reviewCount: 156
  },
  'bold-bakhoor': {
    subtitle: 'Traditional Essence',
    benefits: ['Long lasting fragrance', 'Creates soothing aroma', 'Mental upliftment & positivity', 'Authentic scents'],
    scentPyramid: {
      top: ['Bergamot', 'Pink Pepper', 'Saffron'],
      heart: ['Oud Bakhoor', 'Sandalwood', 'Orris'],
      base: ['Amber', 'Musk', 'Benzoin']
    },
    mood: ['energizing', 'luxurious'],
    notes: ['oriental', 'spicy'],
    intensity: 'strong',
    reviews: [
      { name: 'Nasreen A.', rating: 5, comment: 'Authentic bakhoor fragrance that brings back memories of Eid celebrations. The musk and amber combination is perfect!', verified: true },
      { name: 'Deepak J.', rating: 4, comment: 'Very bold and long-lasting scent. A little goes a long way. Great for large spaces and special gatherings.', verified: true },
      { name: 'Lakshmi V.', rating: 5, comment: 'The best traditional incense I have found in India. Superior quality compared to other brands. Will be a repeat customer!', verified: true }
    ],
    reviewCount: 87
  }
};

/**
 * Fetch all products from backend and merge with local enrichments
 * @returns {Promise<Array>} Array of enriched product objects
 */
export const fetchProducts = async () => {
  try {
    const response = await fetch(`${API_URL}/api/products`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const products = await response.json();
    
    // Merge API products with local enrichments
    return products.map(product => {
      const enrichment = PRODUCT_ENRICHMENTS[product.id] || {};
      return {
        ...product,
        // Use API data as primary, supplement with enrichments
        subtitle: product.tagline || enrichment.subtitle || '',
        benefits: enrichment.benefits || [],
        scentPyramid: enrichment.scentPyramid || null,
        mood: enrichment.mood || [],
        notes: enrichment.notes || [],
        intensity: enrichment.intensity || 'medium',
        reviews: enrichment.reviews || [],
        reviewCount: enrichment.reviewCount || product.reviews || 0,
        rating: product.rating || 4.5
      };
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * Fetch a single product by ID
 * @param {string} productId - The product ID
 * @returns {Promise<Object>} Enriched product object
 */
export const fetchProductById = async (productId) => {
  try {
    const response = await fetch(`${API_URL}/api/products/${productId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const product = await response.json();
    const enrichment = PRODUCT_ENRICHMENTS[product.id] || {};
    
    return {
      ...product,
      subtitle: product.tagline || enrichment.subtitle || '',
      benefits: enrichment.benefits || [],
      scentPyramid: enrichment.scentPyramid || null,
      mood: enrichment.mood || [],
      notes: enrichment.notes || [],
      intensity: enrichment.intensity || 'medium',
      reviews: enrichment.reviews || [],
      reviewCount: enrichment.reviewCount || product.reviews || 0,
      rating: product.rating || 4.5
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

// Export filter options (unchanged from mockData)
export const fragranceFilters = {
  moods: [
    { id: 'meditative', label: 'Meditative', icon: '🧘', description: 'Perfect for meditation & prayer' },
    { id: 'relaxing', label: 'Relaxing', icon: '🌙', description: 'Calming & stress-relieving' },
    { id: 'energizing', label: 'Energizing', icon: '✨', description: 'Uplifting & refreshing' },
    { id: 'romantic', label: 'Romantic', icon: '💕', description: 'Sensual & inviting' },
    { id: 'luxurious', label: 'Luxurious', icon: '👑', description: 'Rich & sophisticated' }
  ],
  notes: [
    { id: 'woody', label: 'Woody', icon: '🌲', description: 'Sandalwood, Cedar, Oud' },
    { id: 'floral', label: 'Floral', icon: '🌸', description: 'Rose, Lotus, Jasmine' },
    { id: 'spicy', label: 'Spicy', icon: '🔥', description: 'Saffron, Pepper, Cardamom' },
    { id: 'oriental', label: 'Oriental', icon: '🏺', description: 'Amber, Musk, Bakhoor' }
  ],
  intensity: [
    { id: 'light', label: 'Light', description: 'Subtle & gentle' },
    { id: 'medium', label: 'Medium', description: 'Balanced & versatile' },
    { id: 'strong', label: 'Strong', description: 'Bold & long-lasting' }
  ]
};
