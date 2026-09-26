/**
 * Central brand configuration.
 *
 * ONE-FILE RENAME
 * ===============
 * Every user-facing brand touchpoint (headers, footers, page titles, emails,
 * brochure, PDF invoices, meta tags, PWA manifest, sitemap, social share
 * cards, JSON-LD Schema.org markup) reads from here through the `BRAND`
 * import. To rename / re-logo again, edit THIS file and:
 *   backend/.env      → BRAND_NAME / BRAND_TAGLINE / BRAND_INSTAGRAM
 *   Vercel env panel  → same three keys
 *   logo assets       → run `python3 scripts/build_brand_logos.py <master>`
 *                       (see public/images/logos/LOGO_INDEX.md)
 *
 * Internal technical identifiers (cookie `addrika_session_token`, localStorage
 * `addrika_cart`, DB name `addrika_db`, badge key `addrika_verified_partner`)
 * intentionally keep their legacy spelling — renaming them would log every
 * user out and orphan carts for zero visible benefit.
 */

const NAME = 'AAROHMM';                        // ← flip this to rename everywhere
const LEGAL_NAME = 'Centraders (India) Private Limited';
const TAGLINE = 'Where Fragrance Becomes Atmosphere…';
const DOMAIN = 'centraders.com';
const INSTAGRAM_HANDLE = '@aarohmm.fragrances';
const INSTAGRAM_SLUG = 'aarohmm.fragrances';
const TWITTER_CREATOR = '@aarohmm_incense';

const LOGO_DIR = '/images/logos';

const BRAND = {
  // ---- Identity ----
  name: NAME,
  nameUpper: NAME.toUpperCase(),
  nameTitle: NAME.charAt(0) + NAME.slice(1).toLowerCase(), // "Aarohmm" for prose
  legalName: LEGAL_NAME,
  tagline: TAGLINE,
  domain: DOMAIN,

  // ---- Logo & imagery (all derived from ONE master via scripts/build_brand_logos.py) ----
  logo: {
    src: `${LOGO_DIR}/aarohmm-logo-horizontal.png`,           // footer (emblem + wordmark, one row)
    srcGold: `${LOGO_DIR}/aarohmm-logo-horizontal.png`,       // header
    srcBrandNameGoldTransparent: `${LOGO_DIR}/aarohmm-logo-full.png`, // hero (emblem + wordmark + tagline)
    srcFull: `${LOGO_DIR}/aarohmm-logo-full.png`,
    srcLockup: `${LOGO_DIR}/aarohmm-logo-lockup.png`,         // emblem over wordmark, no tagline
    srcWordmark: `${LOGO_DIR}/aarohmm-wordmark-gold.png`,     // "AAROHMM®" text only — admin bars, compact headers
    srcGoldCropped: `${LOGO_DIR}/aarohmm-emblem-gold.png`,    // favicon / square emblem
    srcEmblem: `${LOGO_DIR}/aarohmm-emblem-gold.png`,
    logoUrlAbs: `https://${DOMAIN}${LOGO_DIR}/aarohmm-emblem-gold.png`, // JSON-LD + og
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
      NAME.toLowerCase(), `${NAME.toLowerCase()} fragrances`, `${NAME.toLowerCase()} incense`,
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
