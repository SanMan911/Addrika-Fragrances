// Dynamic robots.txt generation for Next.js

export default function robots() {
  const baseUrl = 'https://centraders.com';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/retailer/',
          '/account/',
          '/api/',
          '/checkout/',
          '/orders/',
          '/auth/',
        ],
      },
      // Specific rules for AI crawlers (Googlebot, GPTBot, etc.)
      {
        userAgent: 'GPTBot',
        allow: [
          '/',
          '/products/',
          '/about-us',
          '/our-story',
          '/our-quality',
          '/ingredients',
          '/why-choose-addrika',
          '/faq',
          '/blog',
        ],
        disallow: [
          '/admin/',
          '/retailer/',
          '/account/',
          '/api/',
        ],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: [
          '/',
          '/products/',
          '/about-us',
          '/our-story',
          '/our-quality',
          '/ingredients',
          '/why-choose-addrika',
          '/faq',
          '/blog',
        ],
        disallow: [
          '/admin/',
          '/retailer/',
          '/account/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
