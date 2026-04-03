// API Configuration for Addrika Frontend
// Production backend URL - hardcoded as fallback for Vercel deployment

export const PRODUCTION_BACKEND = 'https://product-size-sync.preview.emergentagent.com';

// Use this for client-side API calls
export const API_URL = process.env.NEXT_PUBLIC_API_URL || PRODUCTION_BACKEND;

// Use this for server-side API calls (SSR/SSG)
export const getServerApiUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || PRODUCTION_BACKEND;
};
