import BRAND from '../../lib/brand.config';

export const metadata = {
  title: `Community — Retail Partner Leaderboard & Milestones`,
  description: `Celebrating the ${BRAND.name} retail community: monthly Constant Companion streaks, patron milestones and the stores keeping the flame alive across India.`,
  alternates: { canonical: `https://${BRAND.domain}/community` },
};

export default function CommunityLayout({ children }) {
  return children;
}
