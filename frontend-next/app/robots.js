// Dynamic robots.txt — optimized for AI SEO/GEO
export default function robots() {
  const baseUrl = 'https://centraders.com';

  const publicContentPaths = [
    '/',
    '/products',
    '/products/',
    '/wholesale',
    '/retailer/register',
    '/retailer/login',
    '/community',
    '/about-us',
    '/our-story',
    '/our-quality',
    '/sustainability',
    '/ingredients',
    '/why-choose-aarohmm',
    '/why-zero-charcoal',
    '/zero-charcoal',
    '/low-smoke-incense',
    '/faq',
    '/blog',
    '/find-retailers',
  ];

  const restrictedPaths = [
    '/admin/',
    '/retailer/',
    '/account/',
    '/api/',
    '/checkout/',
    '/orders/',
    '/auth/',
  ];

  // AI crawlers that should be able to read brand content
  const aiCrawlers = [
    'GPTBot',
    'ChatGPT-User',
    'Google-Extended',
    'GoogleOther',
    'PerplexityBot',
    'ClaudeBot',
    'anthropic-ai',
    'Bytespider',
    'CCBot',
    'cohere-ai',
    'Applebot-Extended',
  ];

  return {
    rules: [
      // Default: allow everything except private areas
      {
        userAgent: '*',
        allow: '/',
        disallow: restrictedPaths,
      },
      // Specific AI crawler rules — explicitly allow public content
      ...aiCrawlers.map((agent) => ({
        userAgent: agent,
        allow: publicContentPaths,
        disallow: ['/admin/', '/retailer/', '/account/', '/api/'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
