// API Configuration for Addrika Frontend
// 
// IMPORTANT FOR VERCEL DEPLOYMENT:
// Set NEXT_PUBLIC_BACKEND_URL in your Vercel Environment Variables
// to point to your actual backend server URL (e.g., https://api.centraders.com)

// Client-side API calls should use empty string (relative paths)
// Next.js rewrites in next.config.js will proxy /api/* to the backend
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Server-side API calls (SSR/SSG) MUST have the full backend URL
// This env var MUST be set in Vercel for SSR to work
export const getServerApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) {
    console.warn('NEXT_PUBLIC_BACKEND_URL is not set. SSR API calls will fail.');
    return '';
  }
  return url;
};
