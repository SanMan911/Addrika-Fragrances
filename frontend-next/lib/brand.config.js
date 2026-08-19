/**
 * Central brand configuration.
 *
 * ONE-FILE RENAME
 * ===============
 * When the trademark clears or the brand needs to change (name / logo /
 * accent colour / product sizes / variants), edit THIS file only. Every
 * user-facing brand touchpoint (headers, footers, page titles, emails,
 * brochure, PDF invoices, meta tags, PWA manifest, sitemap, social share
 * cards, JSON-LD Schema.org markup) reads from here through the
 * `BRAND` import.
 *
 * When you change `name` here, also set the same value in
 *   backend/.env      → BRAND_NAME=NewBrand
 *   backend/.env      → BRAND_TAGLINE="Some tagline"
 *   Vercel env panel  → BRAND_NAME + BRAND_TAGLINE
 *
 * Every existing hardcoded "Addrika" reference (~200 across 61 files)
 * has been migrated to consume BRAND.name. Grep the codebase before
 * merging any new copy: no user-visible file should reintroduce a
 * literal brand string.
 */

const NAME = 'Addrika';                       // ← flip this to rename everywhere
const LEGAL_NAME = 'Centraders (India) Private Limited';
const TAGLINE = 'Elevate Your Everyday Rituals';
const DOMAIN = 'centraders.com';
const INSTAGRAM_HANDLE = '@addrika.fragrances';
const INSTAGRAM_SLUG = 'addrika.fragrances';
const TWITTER_CREATOR = '@addrika_incense';

const BRAND = {
  // ---- Identity ----
  name: NAME,
  nameUpper: NAME.toUpperCase(),
  legalName: LEGAL_NAME,
  tagline: TAGLINE,
  domain: DOMAIN,

  // ---- Logo & imagery ----
  logo: {
    src: '/images/logos/addrika-logo.png',
    srcGold: '/images/logos/addrika-logo-gold.png',
    srcBrandNameGoldTransparent: '/images/logos/addrika-brand-name-gold-transparent.png',
    srcGoldCropped: '/images/logos/addrika-logo-gold-cropped.png',
    logoUrlAbs: `https://${DOMAIN}/images/logos/addrika-logo-gold-cropped.png`,
    alt: `${NAME} logo`,
    monogram: NAME.charAt(0),
    width: 160,
    height: 40,
  },

  // ---- Social ----
  social: {
    instagramHandle: INSTAGRAM_HANDLE,
    instagramHandleUpper: INSTAGRAM_HANDLE.toUpperCase(),
    instagramSlug: INSTAGRAM_SLUG,
    instagramUrl: `https://instagram.com/${INSTAGRAM_SLUG}`,
    instagramUrlWww: `https://www.instagram.com/${INSTAGRAM_SLUG}`,
    twitterCreator: TWITTER_CREATOR,
  },

  // ---- SEO ----
  seo: {
    keywords: [
      NAME.toLowerCase(), `${NAME.toLowerCase()} fragrances`,
      'premium incense', 'luxury incense sticks', 'incense sticks for meditation',
      'agarbatti', 'charcoal-free incense', 'low smoke agarbatti',
      'kesar chandan incense', 'regal rose incense', 'oriental oudh',
      'bakhoor', 'arabian bakhoor', 'bambooless dhoop',
      'meditation incense', 'yoga incense', 'puja agarbatti',
      'luxury home fragrance india', 'ethical incense', 'premium agarbatti online',
      'buy incense online india', 'natural incense sticks',
      'best incense for meditation', 'incense gift set india',
    ],
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
    accent: '#D4AF37',
  },

  // ---- Product taxonomy ----
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
    instagram: INSTAGRAM_HANDLE,
  },

  // ---- Copy defaults ----
  copy: {
    supportEmailBody: (customerName) =>
      `Hi ${customerName},\n\nThanks for reaching out to ${NAME} support. …`,
    welcomeEmailSubject: `Welcome to ${NAME} 🙏`,
    orderEmailFooter:
      'Elegance you can feel good about — every stick made in equal-participation workshops.',
  },
};

module.exports = BRAND;
module.exports.default = BRAND;
module.exports.BRAND = BRAND;
