import { redirect } from 'next/navigation';

// This page redirects to the more comprehensive "why-zero-charcoal" page
// Keeping as a redirect for SEO purposes in case users search for "zero charcoal"
export default function ZeroCharcoalRedirect() {
  redirect('/why-zero-charcoal');
}

export const metadata = {
  title: 'Zero Charcoal Incense | Addrika',
  description: 'Learn about Addrika\'s zero charcoal incense formula.',
  robots: {
    index: false,
    follow: true,
  },
};
