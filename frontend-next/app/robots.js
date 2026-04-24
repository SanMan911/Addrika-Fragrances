// Dynamic robots.txt — optimized for AI SEO/GEO
export default function robots() {
  const baseUrl = 'https://centraders.com';

  const publicContentPaths = [
    '/',
    '/products/',
    '/about-us',
    '/our-story',
    '/our-quality',
    '/sustainability',
    '/ingredients',
    '/why-choose-addrika',
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

  // AI crawlers that should be able to read Addrika content
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
