import BRAND from '../../lib/brand.config';

export const metadata = {
  title: `Wholesale & Retail Partnership — Stock ${BRAND.name} at Your Store`,
  description: `Become a ${BRAND.name} retail partner: GST-verified onboarding in five minutes, wholesale carton pricing, live stock, Fragrance Rewards trade credit and pan-India shipping.`,
  alternates: { canonical: `https://${BRAND.domain}/wholesale` },
  openGraph: {
    title: `Stock ${BRAND.name} at your store — Wholesale Programme`,
    description: 'Self-serve wholesale portal for retailers, gift shops and spiritual stores.',
    url: `https://${BRAND.domain}/wholesale`,
  },
};

export default function WholesaleLayout({ children }) {
  return children;
}
