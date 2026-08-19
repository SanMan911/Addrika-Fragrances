const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `Shopping Cart | ${BRAND.name} Premium Incense`,
  description: `Review your cart and checkout with ${BRAND.name} premium natural incense. Free shipping on orders above ₹499.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './CartClient';
