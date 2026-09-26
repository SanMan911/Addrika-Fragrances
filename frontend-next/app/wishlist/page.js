const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `My Wishlist`,
  description: `View your saved items and favorite ${BRAND.name} premium incense products. Add to cart and enjoy sacred luxury.`,
  robots: {
    index: false,
    follow: true,
  },
};

export { default } from './WishlistClient';
