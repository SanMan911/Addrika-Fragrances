/**
 * Static Content Data
 * 
 * This file contains static content used across the application.
 * These are not product data (which comes from the API) but rather
 * UI/display content like packaging info, CSR activities, and company info.
 */

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

// Filter options for product filtering
export const filterOptions = {
  mood: [
    { id: 'meditative', label: 'Meditative', icon: '🧘', description: 'Perfect for meditation & puja' },
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
