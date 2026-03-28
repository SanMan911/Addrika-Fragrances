// Dynamic sitemap generation for Next.js
// This automatically generates sitemap.xml at build time and can be regenerated on demand

const BASE_URL = 'https://centraders.com';

// Static pages with their update frequency and priority
const staticPages = [
  { path: '/', changeFreq: 'daily', priority: 1.0 },
  { path: '/about-us', changeFreq: 'monthly', priority: 0.8 },
  { path: '/our-story', changeFreq: 'monthly', priority: 0.8 },
  { path: '/our-quality', changeFreq: 'monthly', priority: 0.8 },
  { path: '/ingredients', changeFreq: 'monthly', priority: 0.7 },
  { path: '/why-choose-addrika', changeFreq: 'monthly', priority: 0.8 },
  { path: '/why-zero-charcoal', changeFreq: 'monthly', priority: 0.7 },
  { path: '/zero-charcoal', changeFreq: 'monthly', priority: 0.7 },
  { path: '/low-smoke-incense', changeFreq: 'monthly', priority: 0.7 },
  { path: '/faq', changeFreq: 'weekly', priority: 0.7 },
  { path: '/blog', changeFreq: 'weekly', priority: 0.6 },
  { path: '/find-retailers', changeFreq: 'weekly', priority: 0.7 },
  { path: '/contact', changeFreq: 'monthly', priority: 0.5 },
  { path: '/privacy-policy', changeFreq: 'yearly', priority: 0.3 },
  { path: '/terms-of-service', changeFreq: 'yearly', priority: 0.3 },
  { path: '/shipping-returns', changeFreq: 'monthly', priority: 0.5 },
  { path: '/track-order', changeFreq: 'monthly', priority: 0.5 },
];

// Product pages - high priority for e-commerce
const products = [
  { slug: 'kesar-chandan', name: 'Kesar Chandan Premium Incense' },
  { slug: 'regal-rose', name: 'Regal Rose Premium Incense' },
  { slug: 'oriental-oudh', name: 'Oriental Oudh Premium Incense' },
  { slug: 'bold-bakhoor', name: 'Bold Bakhoor Premium Incense' },
];

export default async function sitemap() {
  const currentDate = new Date().toISOString();

  // Static pages
  const staticRoutes = staticPages.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: currentDate,
    changeFrequency: page.changeFreq,
    priority: page.priority,
  }));

  // Product pages - high priority
  const productRoutes = products.map((product) => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  // Auth pages (lower priority, but included for completeness)
  const authRoutes = [
    { url: `${BASE_URL}/login`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/register`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // E-commerce pages
  const ecommerceRoutes = [
    { url: `${BASE_URL}/cart`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/wishlist`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.5 },
  ];

  return [
    ...staticRoutes,
    ...productRoutes,
    ...authRoutes,
    ...ecommerceRoutes,
  ];
}
