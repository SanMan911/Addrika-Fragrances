# Addrika E-Commerce Platform - PRD

## Original Problem Statement
Build a premium e-commerce platform for Addrika natural incense brand by Centsibl Traders. Features include product catalog, user auth, admin portal, retailer dashboard, SEO, and messaging consistency enforcement.

## Tech Stack
- **Frontend**: Next.js 14 (App Router) at `/app/frontend-next`
- **Backend**: FastAPI with MongoDB at `/app/backend`
- **Payments**: Razorpay
- **Email**: Resend
- **Deployment**: Vercel (frontend) + Render (backend)

## Messaging Consistency Rules (CRITICAL)
1. **Smoke Reduction**: "60%+" or "over 60% less smoke". Never 40%, 80%.
2. **Bamboo**: ONLY Dhoop is bambooless. Agarbattis have bamboo.
3. **Ingredients**: "Ethical Sourcing" — NOT "100% natural".
4. **Tree Donation**: Strictly ₹5 customer + ₹5 Addrika match.
5. **Burn Time**: Do NOT show burn time for Bakhoor products.

## What's Been Implemented

### Core Features (Dec 2025 – Mar 2026)
- Full e-commerce (cart, checkout, orders, Razorpay)
- Username-based auth, forgot password/username
- Admin 2FA with email OTP
- Product catalog (agarbatti, dhoop, bakhoor)
- Retailer dashboard & B2B features
- SEO (metadata, canonical, sitemap, structured data)
- Title Case auto-capitalization on forms

### Content & Messaging (Mar 2026)
- Sustainability page (/sustainability)
- Mission & Vision on Our Story
- Low Carbon Footprint cards
- Strict consistency enforcement (60%+, bambooless dhoop, ethical sourcing)
- Coupon Analytics + Delete in admin
- Return Policy cleanup

### Tree Donation (Mar 2026)
- ₹5 toggle in checkout flow
- Thank-you message on order success
- Backend analytics endpoint + admin tree-donations page

### April 7, 2026 — Products Migration & New Features
- **MongoDB Product Migration**: Products moved from hardcoded Python list to MongoDB `products` collection with in-memory cache
- **Admin Product Management** (`/admin/products`): Full CRUD — create, edit, delete, toggle active/coming-soon, size variants
- **2 Bakhoor Products**: Grated Omani Bakhoor (₹249) + Yemeni Bakhoor Chips (₹399) — orderable with real product images
- **"Notify Me" Email Capture**: For Coming Soon products. Stored in `notify_me` collection.
- **Admin Notify Me Dashboard** (`/admin/notify-me`): View signups grouped by product
- **Announcement Marquee**: Infinite scrolling ticker on homepage
- **SEO**: Dynamic sitemap, robots.txt
- **Trust Badges Fixed**: "Ethical Sourcing / Premium Ingredients" across all product pages

### April 7, 2026 — Bakhoor Reviews & WhatsApp
- **Bakhoor Ratings Added**: Grated Omani Bakhoor (4.9 rating, 7 reviews), Yemeni Bakhoor Chips (4.8 rating, 5 reviews) — meager but mostly 5-star for recently launched products
- **Rating Fallback Bug Fixed**: Removed `|| 4.5` fallback in FragranceGrid.js, FragranceGridServer.js, and QuickViewModal.js so products with 0 rating don't show fake 4.5 stars
- **WhatsApp Click-to-Chat Button**: Floating green WhatsApp button (bottom-right) linking to `wa.me/919667269711` with pre-filled message. Visible on all pages.
- **Customer Reviews Section**: Premium review section on Bakhoor product detail pages with verified badges, rating breakdown bar chart, and expandable "Show All" button. Only displays for products with `customerReviews` data.
- **Migration Script**: Auto-updates Bakhoor ratings and reviews in MongoDB on backend startup

### April 10, 2026 — Royal Kewda Product
- **Royal Kewda Added**: New agarbatti product (50g @ ₹110 MRP), available for purchase. Placeholder stock images from Unsplash — to be replaced with actual product photos.
- Fragrance notes: Kewda, Jasmine, White Musk. Burn time: 40+ minutes.
- Auto-migrates into MongoDB on backend startup.

### April 10, 2026 — AI SEO/GEO Optimization
- **llms.txt & llms-full.txt**: AI manifest files in `/public/` for LLM crawlers (ChatGPT, Perplexity, Claude, Gemini) with brand identity, product catalog, use cases, FAQs, and contact info.
- **robots.txt expanded**: Added 11 AI crawler user agents (GPTBot, ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, Bytespider, CCBot, cohere-ai, GoogleOther, Applebot-Extended).
- **Structured Data enhancements**:
  - Organization: Added `knowsAbout`, `Brand` entity, WhatsApp contact, `alternateName` array
  - Store: Full product catalog with nested `OfferCatalog` (Agarbatti, Dhoop, Bakhoor categories)
  - Product: Added individual `Review` schemas for Bakhoor, `countryOfOrigin`, `shippingDetails`, `Fragrance Notes` property, conditional `aggregateRating` (omitted for 0-review products)
  - WebSite: Added `inLanguage`, richer `description`, `alternateName` array
- **Metadata enriched**: Richer descriptions with "Addrika Fragrances" brand name, expanded keyword sets covering meditation, yoga, luxury, and purchase intent queries.
- **Sitemap**: Updated fallback to include all 10 products + 4 blog posts.

### April 10, 2026 — Blog Articles for AI Discoverability
- **4 SEO-optimized blog articles** seeded into MongoDB (`blog_posts` collection):
  1. "Best Charcoal-Free Incense Sticks in India (2026)" — brand comparison, health benefits
  2. "How to Use Arabian Bakhoor at Home" — beginner's guide, Omani vs Yemeni
  3. "Best Incense for Meditation and Yoga" — fragrance-brain science, product recommendations
  4. "Charcoal-Free vs Regular Agarbatti" — side-by-side comparison with HTML table
- Each article features natural "Addrika Fragrances" brand mentions with internal product links.
- Article structured data: `Speakable`, `inLanguage`, `keywords`, author, publisher.
- Blog URLs added to `llms.txt`, sitemap, and full AI documentation.
- Auto-seeded on backend startup via `scripts/seed_blog.py` (skips if already seeded).

## Database Collections
- `users` - User accounts
- `admin_settings` - Admin credentials
- `orders` - Customer orders (includes pricing.tree_donation)
- `discount_codes` - Coupon codes
- `products` - Product catalog (migrated from hardcoded data)
- `notify_me` - Email signups for coming-soon products
- `carts` - Shopping carts

## Key API Endpoints
- `GET /api/products` - All active products (from MongoDB cache)
- `GET /api/products/:slug` - Single product
- `POST /api/cart/{session}/add` - Add to cart (blocks comingSoon)
- `POST /api/notify-me` - Subscribe to product launch notification
- `POST /api/orders/create` - Create order
- `GET /api/admin/products` - All products (admin)
- `POST /api/admin/products` - Create product (admin)
- `PUT /api/admin/products/:id` - Update product (admin)
- `DELETE /api/admin/products/:id` - Delete product (admin)
- `PATCH /api/admin/products/:id/toggle-active` - Toggle active (admin)
- `PATCH /api/admin/products/:id/toggle-coming-soon` - Toggle coming soon (admin)
- `GET /api/admin/notify-me` - Signups grouped by product (admin)
- `GET /api/admin/analytics/tree-donations` - Tree donation metrics (admin)

## Prioritized Backlog

### April 24, 2026 — B2B Portal Infrastructure (Hidden/Disabled by default)
- **Admin kill-switch**: `admin_settings` key `b2b_enabled` (default `false`). When off, `/api/retailer-auth/login`, `/api/retailer-auth/portal-status`, and all `/api/retailer-dashboard/b2b/*` endpoints return 403 with a "portal unavailable" message.
- **Public portal-status endpoint** `GET /api/retailer-auth/portal-status` so the retailer login page renders a "Retailer Portal Coming Soon" screen when disabled.
- **1.5% online-payment discount** (was 2%). Stored in `admin_settings.b2b_cash_discount_percent`, admin-editable. Auto-applied at Razorpay when retailer toggles "Pay Now & Save additional 1.5%" at checkout.
- **Quantity-tiered wholesale pricing** per B2B product (new collection `b2b_pricing_tiers`). Line-level discount picks highest `min_boxes` tier that applies. Returned as `tier_discount_percent`, `tier_discount_amount` per item and `tier_discount_total` in calculate response.
- **Admin order-notification email** to `contact.us@centraders.com` fired on every B2B order creation (B2B orders bypass ShipRocket — Addrika team contacts the retailer to arrange delivery).
- **Admin UI** `/admin/settings/b2b` — toggle portal, edit discount %, manage per-product quantity tiers.
- **GST gating preserved** — retailer accounts still require `is_verified`/`gst_verified` status; kill-switch is an additional global layer.
- **Tested** — iteration_60.json, 20/20 backend tests pass.

### P1 (High)
- [ ] Replace Bilvapatra & 8" Dhoop placeholder images with actual product photos (when provided)
- [ ] Replace Royal Kewda placeholder images with actual product photos (when provided)
- [ ] Integrate Appyflow (GST Verification) + AEPS India (PAN/Aadhaar eKYC) for retailer onboarding

### P2 (Medium)
- [ ] Send notification emails when Coming Soon products become available
- [ ] Google Analytics Integration
- [ ] Split `b2b_orders.py` (~950 lines) into catalog/calculate/order/email submodules
- [ ] Move `B2B_PRODUCTS` list out of `b2b_orders.py` into a shared catalog module

### P3 (Low)
- [ ] B2B product catalog in MongoDB
