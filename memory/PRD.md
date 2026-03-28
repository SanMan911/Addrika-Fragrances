# Addrika E-commerce Platform - PRD

## Latest Updates
- **27 Mar 2026 (Session 2)**: Next.js Migration - Auth, Cart & Checkout:
  - **Auth Flow**: Login, Register (OTP), Forgot Password, Admin Login (2FA), Admin Forgot PIN
  - **E-commerce Flow**: Cart, Checkout (Razorpay), Orders, Order Success, Wishlist
  - **Account**: User account dashboard with order history
  - **Contexts**: Full AuthContext with Google OAuth + Admin 2FA, CartContext, WishlistContext
  - All 35 routes build successfully
  - Testing: 100% pass rate (11/11 pages verified)
- **27 Mar 2026 (Session 1)**: Password Recovery Feature & Codebase Refactoring:
  - Implemented User Password Recovery (via Mobile Number + OTP to email)
  - Implemented Admin PIN Recovery (via Email + OTP)
  - Added "Forgot Password?" links to User and Admin login pages
  - Frontend routes: `/forgot-password` and `/admin/forgot-password`
  - Backend endpoints: `/api/auth/forgot-password/*` and `/api/admin/forgot-pin/*`
  - Fixed datetime comparison bug in recovery endpoints
  - Refactored: Moved static content from `mockData.js` to `data/staticContent.js`
  - Deprecated: `mockData.js` renamed to `DEPRECATED_mockData.js.bak`
  - Created `test_credentials.md` for testing documentation
  - Added `STATUS.md` to `frontend-next/` clarifying its side-lined status
- **18 Mar 2026**: Comprehensive AI/LLM SEO Optimization based on user recommendations:
  - Created `/our-quality` page (quality standards & artisan craftsmanship)
  - Created `/ingredients` page (detailed natural ingredients guide)
  - Created `/why-choose-addrika` page (competitive differentiation vs Phool, Nirmalaya + "Where to Buy")
  - Enhanced Product Schema with burnTime, material, smokeEmission, charcoalFree, suitableFor properties
  - Expanded FAQ with 20+ questions covering safety (children/pets), daily puja, Made in India
  - Fixed "hand-rolled" references (Addrika is NOT hand-rolled)
  - Updated burn time to 40-50 minutes across all pages
  - Added internal cross-linking between all SEO content pages
- **16 Mar 2026**: SEO Audit & Optimization Phase 1, 2 completed. Next.js migration started
- **14 Mar 2026 (Session 2)**: Store Pickup flow verified, Frontend product loading refactored to use API
- **14 Mar 2026 (Session 1)**: Oriental Oudh 200g images updated, Floating Delivery Checker added, ₹11 token disabled, Fast-Track Pickup marketing, Time slots updated

---

## Original Problem Statement
Build a premium incense e-commerce platform for Addrika with:
- Product catalog with multiple sizes and images
- Shopping cart and checkout flow
- Razorpay payment integration
- Self-pickup from retail partners
- B2B wholesale functionality
- Admin panel for order management
- Retailer portal for partner stores

---

## Core Requirements

### Next.js Migration Status
- [x] Homepage with SSR
- [x] Product pages with SSG (4 products)
- [x] SEO pages (About, FAQ, Blog, etc.)
- [x] Auth flow (Login, Register, Forgot Password)
- [x] Admin Auth (Login with 2FA, Forgot PIN)
- [x] Cart & Checkout with Razorpay
- [x] Orders & Order Success
- [x] Wishlist
- [x] Account Dashboard
- [ ] Admin Dashboard (not started)
- [ ] Retailer Portal (not started)
- [ ] Account sub-pages (addresses, settings, etc.)

### Customer Features
- [x] Product browsing with image galleries
- [x] Cart management with quantity controls
- [x] Shipping mode (delivery to address)
- [x] Self-pickup mode (from retail partners)
- [x] Razorpay payment integration
- [x] Order tracking
- [x] PIN code delivery estimates (floating checker)
- [x] User accounts and order history
- [x] Wishlist functionality
- [x] **Individual product pages with SEO** (NEW - 16 Mar 2026)
- [x] **Related Products section on product pages** (NEW - 16 Mar 2026)
- [x] **Password Recovery via Mobile Number** (NEW - 27 Mar 2026)

### Admin Features
- [x] 2FA login (MongoDB-backed)
- [x] Order management
- [x] B2B order management
- [x] Retailer management
- [x] Profile change tickets
- [x] Retailer activity dashboard (basic)
- [x] Analytics dashboard
- [x] **PIN Recovery via Email** (NEW - 27 Mar 2026)

### Retailer Features
- [x] Retailer portal login
- [x] Order viewing and status updates
- [x] Badge system

---

## What's Implemented

### Session: 16 Mar 2026 - SEO Audit & Optimization
**Phase 1: Quick SEO Fixes (COMPLETED)**
1. **Static Structured Data in index.html**
   - Organization schema (visible to all crawlers without JS)
   - WebSite schema with SearchAction
   - Product ItemList schema with all 4 products
   - AggregateRating for each product

2. **SEO Component Added to All Pages**
   - AboutUs.jsx - unique title/description
   - OurStory.jsx - unique title/description
   - FindRetailers.jsx - unique title/description
   - ShippingReturns.jsx - unique title/description
   - PrivacyPolicy.jsx - unique title/description
   - TermsOfService.jsx - unique title/description
   - BlogPage.jsx - unique title/description
   - BlogPostPage.jsx - dynamic title from post content
   - TrackOrder.jsx - noIndex=true (user-specific)
   - WishlistPage.jsx - noIndex=true (user-specific)

3. **Sitemap Updated**
   - Removed hash-based URLs (#fragrances)
   - Added product page URLs

**Phase 2: Individual Product Pages (COMPLETED)**
1. **ProductPage.jsx Created**
   - Route: `/products/:slug`
   - Full product SEO with product schema
   - Image gallery with navigation
   - Size selection
   - Add to cart functionality
   - Wishlist toggle
   - Breadcrumb navigation
   - Trust badges

2. **FragranceGrid.jsx Updated**
   - Added "View Full Product Details" link on each product card
   - Links to individual product pages

3. **Sitemap with Product URLs**
   - /products/kesar-chandan
   - /products/regal-rose
   - /products/oriental-oudh
   - /products/bold-bakhoor

### Session: 14 Mar 2026 (Session 2)
1. **Store Pickup Flow Verified**
   - ₹11 token payment disabled (TOKEN_PAYMENT_ENABLED=false)
   - "Fast-Track Pickup" branding throughout checkout
   - 3 time slots only (4:30pm-7:30pm peak hours excluded)
   - Manual store selection (State → District → Store) working
   - Fixed: districts_by_state API key mismatch bug

2. **Frontend Product Loading Refactored (P1 COMPLETED)**
   - NEW: `/app/frontend/src/services/productService.js`
   - Products now fetched from `/api/products` backend endpoint
   - Merged with local enrichments for filtering (mood, notes, intensity)
   - Loading and error states added to FragranceGrid
   - Removed dependency on hardcoded mockData.js for products

3. **Recently Viewed Section Enhanced**
   - Now fetches live product data from API for current prices
   - Quick Add button with loading/success states (cart icon → "Adding..." → "Added!")
   - Shows product subtitles from API data
   - Toast notification on successful add
   - Cart count updates immediately
- ShipRocket delivery estimates
- B2B pricing (76.52% of MRP)
- Hybrid OTP verification (+ Master Password)
- Admin email notifications
- Profile change tickets system

---

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- ~~Refactor Frontend Product Loading~~ ✅ COMPLETED (14 Mar 2026)
- ~~SEO Audit & Optimization Phase 1~~ ✅ COMPLETED (16 Mar 2026)
- ~~Individual Product Pages (Phase 2)~~ ✅ COMPLETED (16 Mar 2026)
- ~~Related Products section~~ ✅ COMPLETED (16 Mar 2026)
- ~~Next.js Migration (Core Pages)~~ ✅ COMPLETED (16 Mar 2026)
- ~~AI/LLM SEO Content Pages~~ ✅ COMPLETED (18 Mar 2026)
  - `/our-quality` - Quality standards & craftsmanship page
  - `/ingredients` - Detailed natural ingredients guide
  - `/why-choose-addrika` - Competitive differentiation & Where to Buy
  - `/zero-charcoal` - Redirect to why-zero-charcoal
- ~~Enhanced Product Schema~~ ✅ COMPLETED (18 Mar 2026) - Added burnTime, material, smokeEmission, charcoalFree, suitableFor
- ~~Expanded FAQ~~ ✅ COMPLETED (18 Mar 2026) - 20+ questions covering safety, daily puja, Made in India
- ~~Fixed hand-rolled references~~ ✅ COMPLETED (18 Mar 2026) - Updated to "crafted by skilled artisans"
- ~~Updated burn time~~ ✅ COMPLETED (18 Mar 2026) - Changed to 40-50 minutes across all pages

### P2 - Medium Priority
- Next.js Migration (Checkout, Auth, Admin) - Remaining
- GST Verification API stability check (GSTINCheck.co.in)
- Admin Retailer Onboarding Form verification (implemented but unverified)

### P3 - Future
- Subdomain configuration (requires Emergent support)
- Instagram & WhatsApp API integration (pending credentials)
- Export & migration tools

---

## Next.js Migration Status

### Completed (16 Mar 2026) - 16 Pages
- [x] Homepage with SSR (products pre-rendered)
- [x] Product pages (4) with SSG + Product schema
- [x] About Us page
- [x] Our Story page  
- [x] Blog index page
- [x] Blog post page (dynamic)
- [x] Find Retailers page with LocalBusiness schema
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Shipping & Returns page
- [x] Track Order page (client-side)
- [x] Related products section
- [x] Sitemap with all URLs
- [x] mockData.js deprecated for products (API is source of truth)

### Remaining Migration Tasks
- [ ] Checkout flow
- [ ] Cart functionality (context provider)
- [ ] Auth flow (login, register)
- [ ] User account pages
- [ ] Admin panel
- [ ] Retailer portal

### Next.js Project Location
```
/app/frontend-next/
├── app/
│   ├── layout.js              # Root layout with metadata
│   ├── page.js                # Homepage (SSR)
│   ├── faq/page.js            # FAQ page with FAQPage schema
│   ├── ingredients/page.js    # Natural ingredients guide (NEW)
│   ├── low-smoke-incense/page.js  # Low smoke landing page
│   ├── our-quality/page.js    # Quality standards page (NEW)
│   ├── why-zero-charcoal/page.js  # Zero charcoal benefits
│   ├── zero-charcoal/page.js  # Redirect to why-zero-charcoal (NEW)
│   └── products/
│       └── [slug]/
│           ├── page.js         # Product page (SSG)
│           ├── ProductActions.js  # Client component
│           └── not-found.js    # 404 page
├── public/
│   └── sitemap.xml            # Updated with all SEO pages
├── styles/globals.css
├── tailwind.config.js
└── package.json
```

---

## Technical Architecture

### Frontend (Current - React SPA)
- React 18 with CRACO
- Shadcn/UI components
- Tailwind CSS
- React Router
- react-helmet-async (SEO)

### Frontend (In Progress - Next.js)
- Next.js 14 with App Router
- Server-Side Rendering (SSR)
- Static Site Generation (SSG)
- Built-in Image Optimization
- Native SEO support

### Backend
- FastAPI
- MongoDB
- APScheduler for jobs

### Integrations
- Razorpay (payments)
- Resend (emails)
- ShipRocket (shipping)
- Google Analytics
- Google Translate
- recharts (data visualization)

### SEO Implementation
- Static JSON-LD in index.html (Organization, WebSite, ProductList)
- Dynamic SEO via react-helmet-async
- Individual product pages at /products/:slug
- Updated sitemap.xml with product URLs
- robots.txt configured

---

## Key Files Changed (16 Mar 2026)
- `frontend/public/index.html` - Added static structured data
- `frontend/public/sitemap.xml` - Updated with product URLs
- `frontend/src/pages/ProductPage.jsx` - NEW: Individual product page
- `frontend/src/App.js` - Added product page route
- `frontend/src/components/FragranceGrid.jsx` - Added "View Details" link
- `frontend/src/pages/AboutUs.jsx` - Added SEO
- `frontend/src/pages/OurStory.jsx` - Added SEO
- `frontend/src/pages/FindRetailers.jsx` - Added SEO
- `frontend/src/pages/ShippingReturns.jsx` - Added SEO
- `frontend/src/pages/PrivacyPolicy.jsx` - Added SEO
- `frontend/src/pages/TermsOfService.jsx` - Added SEO
- `frontend/src/pages/BlogPage.jsx` - Added SEO
- `frontend/src/pages/BlogPostPage.jsx` - Added dynamic SEO
- `frontend/src/pages/TrackOrder.jsx` - Added SEO (noIndex)
- `frontend/src/pages/WishlistPage.jsx` - Added SEO (noIndex)

---

## Credentials

### Admin
- Email: contact.us@centraders.com
- Password: 110078
- Master Password: addrika_admin_override

### Test User
- Email: test.user@example.com
- Password: Test@123

### Test Retailer
- Email: info@addrika.com
- Password: 12345
