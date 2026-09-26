import BRAND from '../../lib/brand.config';

export const metadata = {
  title: `Sustainability — Ethical Sourcing, Tree Donations & Low-Carbon Incense`,
  description: `How ${BRAND.name} keeps incense responsible: ethically sourced ingredients, equal-participation workshops, ₹5 + ₹5 tree donations on every order and 60%+ less smoke.`,
  alternates: { canonical: `https://${BRAND.domain}/sustainability` },
};

export default function SustainabilityLayout({ children }) {
  return children;
}
