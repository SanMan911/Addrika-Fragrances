const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `Login | ${BRAND.name} - Access Your Account`,
  description: `Sign in to your ${BRAND.name} account to track orders, manage your wishlist, and enjoy exclusive offers on premium natural incense.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './LoginClient';
