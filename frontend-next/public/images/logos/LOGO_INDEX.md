# AAROHMM Logo Index

**Master source:** `mobile/assets/aarohmm-src.webp` (2000×2000, transparent, vertical lockup:
emblem → ® → wordmark → divider → tagline).

**Regenerate everything** after dropping in a sharper master:

```bash
python3 scripts/build_brand_logos.py mobile/assets/aarohmm-src.webp   # or any path
```

The script slices the master into the variants below, rebuilds all PWA icons, the favicon and the
OpenGraph card. No code changes needed — every consumer reads the paths from
`frontend-next/lib/brand.config.js → BRAND.logo.*`.

## Derived files (frontend-next/public/images/logos/)

| File | Content | `BRAND.logo` key(s) | Used by |
| --- | --- | --- | --- |
| `aarohmm-logo-full.png` | emblem + wordmark + tagline | `srcFull`, `srcBrandNameGoldTransparent` | `components/Hero.js` (home hero) |
| `aarohmm-logo-horizontal.png` | emblem left, wordmark right | `src`, `srcGold` | `components/Header.js`, `components/Footer.js` (footer applies `invert` → white) |
| `aarohmm-logo-lockup.png` | emblem over wordmark (no tagline) | `srcLockup` | spare — brochure / print |
| `aarohmm-wordmark-gold.png` | "AAROHMM®" text only | `srcWordmark` | `app/admin/login/page.js`, `app/admin/forgot-password/page.js` |
| `aarohmm-emblem-gold.png` | square emblem | `srcGoldCropped`, `srcEmblem`, `logoUrlAbs` | `app/layout.js` favicon `<link rel=icon>` + JSON-LD `Organization.logo`; `app/blog/[slug]`, `app/why-zero-charcoal`, `app/our-quality`, `app/ingredients` JSON-LD publisher logo; `app/why-choose-aarohmm` JSON-LD; backend `routers/app_config.py → DEFAULT_BRAND.logo_url` (mobile bootstrap) |
| `aarohmm-tagline-gold.png` | tagline strip | — | spare |

## Other derived assets

| File | Purpose |
| --- | --- |
| `frontend-next/public/images/pwa-icons/icon-{48,72,96,128,144,152,192,384,512}x*.png` | PWA / Android home-screen icons (emblem on `#0f1419`) — referenced from `public/manifest.json` and `app/layout.js` apple-touch-icon |
| `frontend-next/public/images/pwa-icons/maskable-icon-{192,512}x*.png` | maskable variants |
| `frontend-next/public/favicon.png` | 64×64 transparent emblem |
| `frontend-next/public/og-image.png` | 1200×630 share card (full logo on dark) — referenced by `app/layout.js` openGraph/twitter |

## Legacy (safe to delete once the swap is confirmed in production)

`addrika-*.png` files in this folder are no longer referenced by any code.

## Mobile (Aarohmm — same brand as web)

`mobile/assets/icon.png`, `adaptive-icon.png`, `splash.png`, `logo.png`, `aaroviah-src.webp`.
