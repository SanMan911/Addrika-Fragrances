# Addrika E-Commerce Platform - PRD

## Original Problem Statement
Build a premium e-commerce platform for Addrika natural incense brand by Centsibl Traders. Features include:
- Username-based authentication with case-sensitive registration
- Admin portal with 2FA login
- Product catalog with Agarbatti, Dhoop, and Bakhoor categories
- Retailer dashboard and B2B features
- SEO optimization for organic search visibility

## User Personas
- **End Consumers**: Purchase premium incense for personal/spiritual use
- **Retailers**: B2B buyers placing bulk orders
- **Admins**: Manage orders, products, users, and analytics

## Core Requirements
1. User authentication (email + username login, forgot password/username)
2. Product catalog with multiple variants (sizes, categories)
3. Shopping cart and checkout with Razorpay
4. Order tracking
5. Admin dashboard with 2FA
6. Retailer portal
7. SEO-optimized pages

## Tech Stack
- **Frontend**: Next.js 14 (App Router) with Tailwind CSS
- **Backend**: FastAPI with MongoDB
- **Payments**: Razorpay
- **Email**: Resend
- **Deployment**: Vercel (frontend) + Emergent (backend)

## What's Been Implemented

### December 2025 - April 2026
- Full e-commerce flow (cart, checkout, orders)
- Username-based authentication with case-sensitivity
- Forgot Username feature via mobile number
- Reserved usernames blocking
- Admin 2FA login with email OTP
- Admin PIN forgot/reset flow (fixed collection mismatch bug)
- Admin notifications for new registrations
- "Mystical Meharishi" Dhoop product added
- Dynamic product badges (Zero Charcoal vs Bambooless Dhoop)
- Text updates (1000+ Customers, packaging copy)
- Admin dark-theme login/forgot-password pages
- SEO Audit & Fixes (metadata, canonical URLs, structured data, sitemap, PWA manifest)
- Product Loading & Size Image Fixes (SSR conversion)
- URL Cleanup (removed all hardcoded preview URLs from 42+ files)
- Title Case auto-capitalization on all forms
- Coupon Analytics & Delete Confirmation with enhanced admin marketing page
- Mission & Vision Statements on Our Story page
- Low Carbon Footprint messaging across the site
- Website Consistency (60%+ smoke reduction standardized, bamboo/bambooless clarification)
- Sustainability Page (/sustainability) with interactive impact dashboard
- Tree Donation Checkout Integration (₹5 toggle, backend tracking, admin metrics)

### April 7, 2026 - Bakhoor Products & Refactoring
- **NEW: 2 Bakhoor Placeholder Products** added:
  - Grated Omani Bakhoor (₹249, 50g) - "Traditional Arabian Luxury"
  - Yemeni Bakhoor Chips (₹399, 40g) - "Exotic Handcrafted Fragrance"
  - Both marked `comingSoon: true` — display in catalog but cannot be added to cart
  - AI-generated placeholder product images
  - Rich descriptions about each bakhoor variant
  - "Coming Soon" purple badge on product cards
  - "Coming Soon — Stay Tuned!" replaces Add to Cart button
  - No rating stars displayed for 0-review coming soon products
  - Backend cart guard rejects add-to-cart attempts (400 error)
- **FIXED: Trust badges** on product detail pages changed from "Natural Ingredients / 100% Pure" to "Ethical Sourcing / Premium Ingredients"
- **REFACTORED: Legacy frontend deleted** — `/app/frontend` is now a symlink to `/app/frontend-next` (Next.js)
- **UPDATED: next.config.js** — Added `static.prod-images.emergentagent.com` to image remotePatterns
- **UPDATED: Structured data** — Bakhoor category recognized in SEO schema

## Messaging Consistency Rules (CRITICAL)
1. **Smoke Reduction**: MUST say "60%+" or "over 60% less smoke". Never 40%, 80%, etc.
2. **Bamboo**: ONLY Dhoop is bambooless. Agarbattis contain bamboo sticks.
3. **Ingredients**: Do NOT use "100% natural". Use "Ethical Sourcing" instead.
4. **Tree Donation**: Strictly ₹5 customer contribution, Addrika matches ₹5.

## Prioritized Backlog

### P0 (Critical)
- [x] Remove hardcoded preview URLs from codebase (DONE)
- [ ] **DEPLOY TO VERCEL** - See deployment instructions below

### P1 (High)
- [x] Add Bakhoor category products (DONE - placeholders with Coming Soon)
- [ ] Additional Dhoop product images
- [ ] Replace Bakhoor placeholder images with actual product photos (when user provides)

### P2 (Medium)
- [ ] Google Search Console setup (submit dynamically generated sitemap.xml)
- [ ] GST Verification API stability (recurring issue)
- [ ] WhatsApp API integration

### P3 (Low)
- [x] Delete legacy /app/frontend folder (DONE - symlinked to frontend-next)
- [ ] Google Analytics integration
- [ ] Migrate hardcoded products to MongoDB for dynamic catalog

## API Endpoints (Key)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/products` - Product list (returns 7 products)
- `GET /api/products/:slug` - Product details
- `POST /api/cart/{session_id}/add` - Add to cart (blocks comingSoon products)
- `POST /api/orders/create` - Create order (accepts pricing.tree_donation)
- `GET /api/admin/analytics/tree-donations` - Tree donation metrics (admin auth required)

## Database Collections
- `users` - User accounts (email, username, username_lower)
- `admin_settings` - Admin credentials (pin_hash)
- `orders` - Customer orders (includes pricing.tree_donation)
- `discount_codes` - Coupon codes
- `products` - (served from routers/products.py as static data)

## Known Issues
- GST Verification API occasionally times out (external API issue)

---

## VERCEL DEPLOYMENT INSTRUCTIONS

**CRITICAL**: Before pushing to GitHub, configure Vercel Environment Variables.

### Step 1: Go to Vercel Dashboard
1. Log in to [vercel.com](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variable
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend-url.com` | Production, Preview, Development |

### Step 3: Save and Push to GitHub
1. Click "Save" in Vercel
2. Come back to Emergent → Click "Save to Github"
3. Vercel will auto-redeploy

### Step 4: Add image domain to Vercel
Ensure `static.prod-images.emergentagent.com` is allowed in Next.js image config (already configured in next.config.js).
