const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `My Wishlist | ${BRAND.name} Premium Incense`,
  description: `View your saved items and favorite ${BRAND.name} premium incense products. Add to cart and enjoy sacred luxury.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './WishlistClient';
