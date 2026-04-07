// Dynamic robots.txt
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
      {
        userAgent: 'GPTBot',
        allow: [
          '/',
          '/products/',
          '/about-us',
          '/our-story',
          '/our-quality',
          '/sustainability',
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
          '/sustainability',
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
