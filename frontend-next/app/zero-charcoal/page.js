import { redirect } from 'next/navigation';
import BRAND from '../../lib/brand.config';

// This page redirects to the more comprehensive "why-zero-charcoal" page
// Keeping as a redirect for SEO purposes in case users search for "zero charcoal"
export default function ZeroCharcoalRedirect() {
  redirect('/why-zero-charcoal');
}

export const metadata = {
  title: `Zero Charcoal Incense | ${BRAND.name}`,
  description: `Learn about ${BRAND.name}\'s zero charcoal incense formula.`,
  robots: {
    index: false,
    follow: true,
  },
};
