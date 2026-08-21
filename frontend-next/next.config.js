/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'customer-assets.emergentagent.com',
      },
      {
        protocol: 'https',
        hostname: 'centraders.com',
      },
      {
        protocol: 'https',
        hostname: 'www.centraders.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'static.prod-images.emergentagent.com',
      },
    ],
  },
  
  // Rewrites to proxy API requests to backend
  // NEXT_PUBLIC_BACKEND_URL should point to your actual backend server
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Order tracking is centralised on the parent Centraders domain
  async redirects() {
    return [
      {
        source: '/track-order',
        destination: 'https://www.centraders.com/track-order',
        permanent: true,
      },
      {
        source: '/track-order/:path*',
        destination: 'https://www.centraders.com/track-order',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
