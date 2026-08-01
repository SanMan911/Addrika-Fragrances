/**
 * Central brand configuration.
 *
 * ONE-FILE RENAME
 * ===============
 * When the trademark clears or the brand needs to change (name / logo /
 * accent colour / product sizes / variants), edit THIS file only. Every
 * user-facing brand touchpoint (headers, footers, page titles, emails,
 * brochure, PDF invoices, meta tags, PWA manifest, sitemap, social share
 * cards) reads from here — either through a direct import or by
 * consuming the `BRAND_NAME` env variable that mirrors it on the
 * backend.
 *
 * When you change `name` here, also set the same value in
 *   backend/.env      → BRAND_NAME=NewBrand
 *   backend/.env      → BRAND_TAGLINE="Some tagline"
 *   Vercel env panel  → BRAND_NAME + BRAND_TAGLINE
 *
 * A grep-friendly index of every hardcoded reference we knew about at
 * the time of the last rename lives in `docs/BRAND_INDEX.md`. Regenerate
 * it with `yarn brand:audit`.
 */

const BRAND = {
  // ---- Identity ----
  name: 'Addrika',
  legalName: 'Centraders (India) Private Limited',
  tagline: 'Elevate Your Everyday Rituals',
  domain: 'centraders.com',

  // ---- Logo & imagery ----
  logo: {
    // Primary logo (favicon + navbar). Path is served from /public.
    src: '/images/logo.png',
    alt: 'Addrika logo',
    monogram: 'A', // used in fallback tiles + brochure watermark
    width: 160,
    height: 40,
  },

  // ---- Brand colours ----
  colors: {
    gold: '#D4AF37',
    goldDark: '#c9a432',
    goldMuted: '#a8842b',
    ink: '#1a1a2e',
    inkSoft: '#22324a',
    cream: '#fbf6e6',
    text: '#ffffff',
    accent: '#D4AF37', // alias for backwards compat
  },

  // ---- Product taxonomy ----
  // If sizes / variants change, this list is the single source of truth
  // for the storefront filter chips, admin product form, and brochure.
  productSizes: [
    { key: '50g', label: '50g stick pack', unit: 'g', weight_g: 50 },
    { key: '100g', label: '100g stick pack', unit: 'g', weight_g: 100 },
    { key: '200g', label: '200g family pack', unit: 'g', weight_g: 200 },
    { key: '500g', label: '500g bulk pack', unit: 'g', weight_g: 500 },
    { key: '1kg', label: '1 kg bulk pack', unit: 'kg', weight_g: 1000 },
  ],

  productVariants: [
    { key: 'agarbatti', label: 'Agarbatti (incense sticks)' },
    { key: 'dhoop', label: 'Dhoop (bambooless cones)' },
    { key: 'bakhoor', label: 'Bakhoor (loose resin)' },
  ],

  // ---- Contact ----
  contact: {
    email: 'contact.us@centraders.com',
    phone: '+91 8377020402',
    whatsapp: '+91 8377020402',
    instagram: '@addrika.official',
  },

  // ---- Copy defaults ----
  copy: {
    supportEmailBody: (name) =>
      `Hi ${name},\n\nThanks for reaching out to Addrika support. …`,
    welcomeEmailSubject: 'Welcome to Addrika 🙏',
    orderEmailFooter:
      'Elegance you can feel good about — every stick made in equal-participation workshops.',
  },
};

module.exports = BRAND;
module.exports.default = BRAND;
