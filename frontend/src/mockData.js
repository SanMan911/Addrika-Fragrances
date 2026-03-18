/**
 * @deprecated PRODUCT DATA (fragrances array)
 * 
 * NOTE: Product data is now fetched from the backend API via productService.js
 * The `fragrances` export below is DEPRECATED and should NOT be used for product data.
 * Use `fetchProducts()` from '../services/productService.js' instead.
 * 
 * This file still exports:
 * - packageSizes: Used by InquiryModal, PackagingSection
 * - csrActivities: Used by CSRSection  
 * - productCategories: Used by CategoryGrid
 * - companyInfo: Used by USPSection, Footer
 * 
 * TODO: Migrate these non-product exports to a separate staticContent.js file
 * 
 * @see /app/frontend/src/services/productService.js for product data
 * @see /app/backend/routers/products.py for product API
 */

export const fragrances = [
  {
    id: 'kesar-chandan',
    name: 'Kesar Chandan',
    subtitle: 'Saffron Sandalwood',
    description: 'A sacred luxury blend combining the divine warmth of saffron and nutmeg with the creamy, woody notes of pure sandalwood. This spiritually soothing natural incense promotes tranquility, enhancing focus during mindfulness practices while creating an authentic aromatic ambiance perfect for meditation and prayer.',
    benefits: ['Enhancing focus & concentration', 'Promotes calm & tranquility', 'Purifies sacred spaces naturally', 'Ideal for mindfulness practices'],
    // Scent Pyramid
    scentPyramid: {
      top: ['Saffron', 'Nutmeg', 'Cardamom'],
      heart: ['Sandalwood', 'Cedar', 'Rose'],
      base: ['Musk', 'Vanilla', 'Amber']
    },
    // Filter categories
    mood: ['meditative', 'relaxing'],
    notes: ['woody', 'spicy'],
    intensity: 'medium',
    image: 'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg',
    sizes: [
      { 
        size: '50g', 
        mrp: 110, 
        price: 110,  // MRP only - no general discount
        images: [
          'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg',
          'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg'
        ]
      },
      { 
        size: '200g', 
        mrp: 402, 
        price: 402,  // MRP only - no general discount
        images: [
          'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg',
          'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0q2xrv3z_KC_200%20gms_2.jpg',
          'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/e3twm0ue_KC_200%20gms_3.jpg'
        ]
      }
    ],
    rating: 4.8,
    reviewCount: 124,
    reviews: [
      { name: 'Priya S.', rating: 5, comment: 'Absolutely divine fragrance! The saffron notes are so authentic and the sandalwood lingers beautifully. Perfect for my morning puja.', verified: true },
      { name: 'Rahul M.', rating: 5, comment: 'Best agarbatti I have ever used. The quality is exceptional and it burns evenly for over 40 minutes. Highly recommend!', verified: true },
      { name: 'Ananya K.', rating: 4, comment: 'Beautiful fragrance that fills the entire room. Great for meditation sessions. Will definitely buy again.', verified: true }
    ]
  },
  {
    id: 'regal-rose',
    name: 'Regal Rose',
    subtitle: 'With Pink Lotus & Ylang Ylang',
    description: 'An exquisite aromatic blend featuring soft, petal-rich rose intertwined with the enchanting and enduring scents of pink lotus and ylang ylang. These premium natural ingredients create a mesmerizing scent experience—a pure aromatic bliss that elevates mood and enhances spiritual connection.',
    benefits: ['Creates inviting aroma', 'Enhances home aromatherapy', 'Mood elevation & positivity', 'Great for gifting'],
    // Scent Pyramid
    scentPyramid: {
      top: ['Pink Lotus', 'Bergamot', 'Green Leaves'],
      heart: ['Damask Rose', 'Ylang Ylang', 'Jasmine'],
      base: ['White Musk', 'Sandalwood', 'Honey']
    },
    // Filter categories
    mood: ['romantic', 'energizing'],
    notes: ['floral'],
    intensity: 'light',
    image: 'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png',
    sizes: [
      { 
        size: '50g', 
        mrp: 110, 
        price: 110,
        images: [
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png',
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/mmyk8kqb_Rose%20Packet%20%232.png',
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/s9f85jos_Rose%20Packet%20%233.png'
        ]
      },
      { 
        size: '200g', 
        mrp: 402, 
        price: 402,
        images: [
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/uyj26i1d_RR%20jar%201%201200px.png',
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/m8u8mwug_RR%20jar%202%201200px.png',
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/bk5g54p5_RR%203%201200px.png'
        ]
      }
    ],
    rating: 4.7,
    reviewCount: 98,
    reviews: [
      { name: 'Meera R.', rating: 5, comment: 'The rose fragrance is so natural and not artificial at all. My guests always compliment how good my home smells!', verified: true },
      { name: 'Kavitha P.', rating: 5, comment: 'Gifted this to my mother and she loved it! The ylang ylang adds such a lovely depth to the rose.', verified: true },
      { name: 'Suresh N.', rating: 4, comment: 'Very pleasant and calming fragrance. Perfect for evening relaxation. Good value for money.', verified: true }
    ]
  },
  {
    id: 'oriental-oudh',
    name: 'Oriental Oudh',
    subtitle: 'Premium Agarwood',
    description: 'Experience the authentic oudh fragrance—the legendary "wood of the gods." This premium scent features rich agarwood with warming notes of amber, evolving into a sultry base of vanilla and subtle smokiness. A unique and exotic treasure with character and warmth, creating an authentic oud ambiance.',
    benefits: ['Long lasting fragrance', 'Promotes calm & relaxation', 'Traditional essence', 'Meditative properties'],
    // Scent Pyramid
    scentPyramid: {
      top: ['Saffron', 'Rose', 'Citrus Zest'],
      heart: ['Agarwood (Oud)', 'Amber', 'Incense'],
      base: ['Vanilla', 'Smoky Woods', 'Leather']
    },
    // Filter categories
    mood: ['meditative', 'luxurious'],
    notes: ['woody', 'oriental'],
    intensity: 'strong',
    image: 'https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png',
    sizes: [
      { 
        size: '200g', 
        mrp: 402, 
        price: 402,
        images: [
          'https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png',
          'https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/kwkdwh49_Dramatic%20Velvet%20Luxury.png'
        ]
      }
    ],
    rating: 4.9,
    reviewCount: 156,
    reviews: [
      { name: 'Arjun D.', rating: 5, comment: 'Exceptional quality oud incense! The agarwood scent is rich and authentic. This is the real deal, not like the synthetic ones in the market.', verified: true },
      { name: 'Fatima B.', rating: 5, comment: 'Reminds me of the traditional bakhoor from Dubai. The fragrance lasts for hours even after the stick burns out. Absolutely wonderful!', verified: true },
      { name: 'Vikram S.', rating: 5, comment: 'Premium quality that you can smell immediately. Perfect for special occasions and creating a luxurious atmosphere.', verified: true }
    ]
  },
  {
    id: 'bold-bakhoor',
    name: 'Bold Bakhoor',
    subtitle: 'Traditional Essence',
    description: 'A bold and aromatic blend of premium natural bhakhoor featuring oud bakhoor, sandalwood, musk, and amber. This traditional maghreb spiritual cleansing incense creates a heady scent with divine essence—perfect for sacred spaces. An alcohol free, thoughtful gift symbolizing modern sophistication and warm hospitality.',
    benefits: ['Long lasting fragrance', 'Creates soothing aroma', 'Mental upliftment & positivity', 'Authentic scents'],
    // Scent Pyramid
    scentPyramid: {
      top: ['Bergamot', 'Pink Pepper', 'Saffron'],
      heart: ['Oud Bakhoor', 'Sandalwood', 'Orris'],
      base: ['Amber', 'Musk', 'Benzoin']
    },
    // Filter categories
    mood: ['energizing', 'luxurious'],
    notes: ['oriental', 'spicy'],
    intensity: 'strong',
    image: 'https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png',
    sizes: [
      { 
        size: '50g', 
        mrp: 110, 
        price: 110,
        images: [
          'https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png',
          'https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/of3dxgh8_Bakhoor%20Packet%20%232.png'
        ]
      },
      { 
        size: '200g', 
        mrp: 402, 
        price: 402,
        images: [
          'https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/p83sa6kl_bb%20jar%201%201200px.png'
        ]
      }
    ],
    rating: 4.6,
    reviewCount: 87,
    reviews: [
      { name: 'Nasreen A.', rating: 5, comment: 'Authentic bakhoor fragrance that brings back memories of Eid celebrations. The musk and amber combination is perfect!', verified: true },
      { name: 'Deepak J.', rating: 4, comment: 'Very bold and long-lasting scent. A little goes a long way. Great for large spaces and special gatherings.', verified: true },
      { name: 'Lakshmi V.', rating: 5, comment: 'The best traditional incense I have found in India. Superior quality compared to other brands. Will be a repeat customer!', verified: true }
    ]
  }
];

// Fragrance filter options
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

export const packageSizes = [
  {
    weight: '50g',
    sticks: 'Approx. 30 sticks',
    duration: 'Perfect for trying',
    price: '₹110'  // MRP only
  },
  {
    weight: '200g',
    sticks: 'Approx. 120 sticks',
    duration: 'Best value pack',
    price: '₹402'  // MRP only
  }
];

export const csrActivities = [
  {
    title: 'Education for All',
    description: 'Comprehensive education programs covering academics, co-curricular activities, value education, and essential life skills for underprivileged children.',
    icon: 'GraduationCap'
  },
  {
    title: 'Feeding the Underprivileged',
    description: 'Working tirelessly to ensure no one goes hungry, providing nutritious meals to those in need across communities.',
    icon: 'Heart'
  },
  {
    title: 'Elder & Invalid Care',
    description: 'Dedicated support and care for the elderly and differently-abled members of society, ensuring dignity and comfort.',
    icon: 'Users'
  },
  {
    title: 'Animal Welfare',
    description: 'Spreading awareness and working against animal cruelty through sensitization programs and community engagement.',
    icon: 'Leaf'
  },
  {
    title: 'Health Initiatives',
    description: 'Free health check-ups, medicine distribution, and blood donation drives to support community wellness.',
    icon: 'Activity'
  },
  {
    title: 'Awareness Programs',
    description: 'Essential education on menstrual hygiene, good touch-bad touch, and overall health awareness for holistic development.',
    icon: 'Shield'
  }
];

export const companyInfo = {
  brandName: 'Addrika',
  companyName: 'Centsibl Traders Private Limited',
  tagline: 'Elegance in Every Scent',
  burnTime: '40+ minutes',
  stickLength: '9 inches',
  fragranceCount: 4
};

// Product categories for the landing page grid
export const productCategories = [
  {
    id: 'incense-sticks',
    name: 'Premium Incense Sticks',
    subtitle: '9" Premium Agarbatti',
    description: 'Four exquisite aromatic blends crafted with premium natural ingredients',
    image: 'https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg',
    badge: 'Best Seller',
    badgeColor: '#D4AF37',
    active: true,
    scrollTarget: 'fragrances',
    specs: [
      { icon: 'clock', text: '40+ min burn' },
      { icon: 'flame', text: '4 Scents' },
      { icon: 'award', text: '9" Sticks' }
    ]
  },
  {
    id: 'dhoop',
    name: 'Dhoop Collection',
    subtitle: 'Traditional Cone & Cup Dhoop',
    description: 'Authentic dhoop cones crafted with premium natural ingredients',
    image: null,
    badge: 'New',
    badgeColor: '#D4AF37',
    active: false,
    scrollTarget: null
  },
  {
    id: 'bakhoor',
    name: 'Bakhoor & Oud',
    subtitle: 'Arabian Luxury',
    description: 'Premium bakhoor chips and oud wood for an exotic experience',
    image: null,
    badge: 'New',
    badgeColor: '#D4AF37',
    active: false,
    scrollTarget: null
  },
  {
    id: 'home-care',
    name: 'Home & Personal Care',
    subtitle: 'Premium Essentials',
    description: 'Curated home and personal care products for everyday luxury',
    image: null,
    badge: 'New',
    badgeColor: '#D4AF37',
    active: false,
    scrollTarget: null
  }
];