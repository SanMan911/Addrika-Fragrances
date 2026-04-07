// Dynamic sitemap — fetches live products from the API so new products auto-appear
const BASE_URL = 'https://centraders.com';
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://addrika-fragrances-backend.onrender.com';

const staticPages = [
  { path: '/', changeFreq: 'daily', priority: 1.0 },
  { path: '/about-us', changeFreq: 'monthly', priority: 0.8 },
  { path: '/our-story', changeFreq: 'monthly', priority: 0.8 },
  { path: '/our-quality', changeFreq: 'monthly', priority: 0.8 },
  { path: '/sustainability', changeFreq: 'monthly', priority: 0.8 },
  { path: '/ingredients', changeFreq: 'monthly', priority: 0.7 },
  { path: '/why-choose-addrika', changeFreq: 'monthly', priority: 0.8 },
  { path: '/why-zero-charcoal', changeFreq: 'monthly', priority: 0.7 },
  { path: '/zero-charcoal', changeFreq: 'monthly', priority: 0.7 },
  { path: '/low-smoke-incense', changeFreq: 'monthly', priority: 0.7 },
  { path: '/faq', changeFreq: 'weekly', priority: 0.7 },
  { path: '/blog', changeFreq: 'weekly', priority: 0.6 },
  { path: '/find-retailers', changeFreq: 'weekly', priority: 0.7 },
  { path: '/privacy-policy', changeFreq: 'yearly', priority: 0.3 },
  { path: '/terms-of-service', changeFreq: 'yearly', priority: 0.3 },
  { path: '/shipping-returns', changeFreq: 'monthly', priority: 0.5 },
  { path: '/track-order', changeFreq: 'monthly', priority: 0.5 },
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

  // Dynamic product pages — fetched live from the API
  let productRoutes = [];
  try {
    const res = await fetch(`${API_URL}/api/products`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const products = await res.json();
      productRoutes = products.map((p) => ({
        url: `${BASE_URL}/products/${p.id}`,
        lastModified: p.updated_at || currentDate,
        changeFrequency: p.comingSoon ? 'weekly' : 'weekly',
        priority: p.comingSoon ? 0.7 : 0.9,
      }));
    }
  } catch {
    // Fallback to known products if API is unreachable during build
    const fallbackSlugs = [
      'kesar-chandan', 'regal-rose', 'oriental-oudh', 'bold-bakhoor',
      'mystical-meharishi', 'grated-omani-bakhoor', 'yemeni-bakhoor-chips',
    ];
    productRoutes = fallbackSlugs.map((slug) => ({
      url: `${BASE_URL}/products/${slug}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    }));
  }

  // Auth pages (lower priority)
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
