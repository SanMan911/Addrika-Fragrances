const { BRAND } = require('../../lib/brand.config');
export const metadata = {
  title: `Track Order | ${BRAND.name} - Check Your Shipment Status`,
  description: `Track your ${BRAND.name} order in real-time. Get updates on your premium incense shipment delivery status.`,
  robots: {
    index: true,
    follow: true,
  },
};

export { default } from './TrackOrderClient';
