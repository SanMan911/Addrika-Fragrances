const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `Create Account | ${BRAND.name} - Join Our Community`,
  description: `Create your ${BRAND.name} account to enjoy exclusive offers, track orders, and discover premium natural incense. Join our community of fragrance lovers.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './RegisterClient';
