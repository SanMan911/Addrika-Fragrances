# Addrika E-Commerce Platform - PRD

## Original Problem Statement
Build a premium e-commerce platform for Addrika natural incense brand by Centsibl Traders. Features include:
- Username-based authentication with case-sensitive registration
- Admin portal with 2FA login
- Product catalog with Agarbatti and Dhoop categories
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
- ✅ Full e-commerce flow (cart, checkout, orders)
- ✅ Username-based authentication with case-sensitivity
- ✅ Forgot Username feature via mobile number
- ✅ Reserved usernames blocking
- ✅ Admin 2FA login with email OTP
- ✅ Admin PIN forgot/reset flow (fixed collection mismatch bug)
- ✅ Admin notifications for new registrations
- ✅ "Mystical Meharishi" Dhoop product added
- ✅ Dynamic product badges (Zero Charcoal vs Bambooless Dhoop)
- ✅ Text updates (1000+ Customers, packaging copy)
- ✅ Admin dark-theme login/forgot-password pages

### April 2, 2026 - SEO Audit & Fixes
- ✅ Added page-level metadata to auth/account pages
- ✅ Enhanced homepage meta with additional keywords
- ✅ Added canonical URLs to product pages
- ✅ Added BreadcrumbList schema to products
- ✅ Updated sitemap with Dhoop product
- ✅ Added manifest.json for PWA
- ✅ Enhanced structured data (Organization, Store, WebSite)
- ✅ Fixed admin PIN reset collection mismatch bug

### April 3, 2026 - Product Loading & Size Image Fixes
- ✅ **CRITICAL FIX: Products now load via Server-Side Rendering (SSR)**
  - Homepage converted from client component to server component
  - Products fetched server-side using `NEXT_PUBLIC_BACKEND_URL`
  - Created `FragranceGridServer.js` that accepts pre-fetched products
  - Eliminates random loading failures on production (Vercel)
- ✅ Fixed product size image switching (50g → 200g updates gallery)
- ✅ Removed "100% Natural" messaging (replaced with CSR focus)
  - Hero badge: "CSR Driven"
  - USP card: "CSR Commitment" - supports local artisans
  - Product descriptions updated throughout
- ✅ Fixed Find Retailers page - API endpoint and map added
- ✅ Replaced dummy retailers with correct 2 stores (M.G. Shoppie, Mela Stores)
- ✅ Removed GST display from retailer cards
- ✅ Fixed Mystical Meharishi product type: "dhoop" (was showing "Agarbatti")
- ✅ Updated CSR stats: 50+ trees, 7 families, 12 student years
- ✅ Updated product ratings to average 4.3★ (more realistic)
- ✅ Updated footer stats: "Ethical Sourcing" instead of "Natural Ingredients"
- ✅ Increased Hero logo size
- ✅ **Fixed ALL pages with hardcoded production backend URL fallback**
  - Cart, Checkout, Wishlist, Account, Admin, Retailer pages all fixed
  - Context files (AuthContext, RetailerAuthContext) fixed
  - Components (FragranceGrid) fixed
- ✅ Fixed coupon validation API endpoint and request format
- ✅ Replaced OpenStreetMap with Google Maps (correct Indian borders)
- ✅ Added WhatsApp button to retailer cards
- ✅ Cleaned up Find Retailers page (map section + retailer details section)
- ✅ Removed all default coupon codes from database
- ✅ Updated all SEO metadata to remove "100% natural" claims (replaced with "ethically sourced")
- ✅ Updated "Our Story" > Ethical Sourcing section - removed "synthetic fragrances" claims, now focuses on transparency

### April 3, 2026 - URL Cleanup (CRITICAL)
- ✅ **REMOVED ALL HARDCODED PREVIEW URLs** from 42+ frontend files
  - Cleaned `csr-metrics-update.preview.emergentagent.com` references
  - Cleaned `product-size-sync.preview.emergentagent.com` references
  - Updated `/app/frontend-next/lib/config.js` to use env vars only
  - Client-side API calls use empty string (relative paths via Next.js rewrites)
  - Server-side SSR calls require `NEXT_PUBLIC_BACKEND_URL` env var
  - Updated `.env.local` to not have hardcoded URLs

### April 5, 2026 - Admin Panel Forms & Title Case
- ✅ **VERIFIED: Title Case auto-capitalization working**
  - Registration form: name, address, landmark, city, state fields
  - Checkout form: name, address, landmark fields
  - Admin Retailers form: business_name, trade_name, owner_name, address, city, district, state
  - All inputs auto-capitalize first letter of every word
- ✅ **VERIFIED: Admin Add Retailer form** - works end-to-end with backend
- ✅ **VERIFIED: Admin Create Coupon form** - works end-to-end with backend
- ✅ **VERIFIED: Return Policy text cleanup** - No mention of "damaged/defective/wrong deliveries"
- ✅ **FIXED: test_credentials.md** - Corrected Admin PIN from 110078 to 050499

### April 5, 2026 - Coupon Analytics & Delete Confirmation
- ✅ **Enhanced Delete Coupon** - Confirmation modal requires typing exact coupon code
- ✅ **Toggle Coupon Status** - Click Active/Inactive badge to toggle coupon on/off
- ✅ **NEW: Analytics Tab** in Marketing page with:
  - Summary Cards: Total Uses, Total Cart Value, Total Discount Given, Unique Customers
  - Coupon Performance Table: Code, Uses, Customers, Cart Value, Discount Given, Net Revenue, Avg Cart, Status
  - Recent Usage/Invoice Details: User email, Order ID, cart value, discount amount, timestamp
- ✅ **Per-Coupon Usage History** - Click Eye icon on any coupon to see its usage breakdown
- ✅ **Mission & Vision Statements** added to Our Story page:
  - Mission: Elevate everyday rituals with premium zero-charcoal incense supporting artisan communities
  - Vision: Become India's most trusted name in ethical, premium incense
- ✅ **Low Carbon Footprint messaging** added across the site:
  - CSR Section: New "Low Carbon Footprint" card - "40% less smoke and fewer carbon emissions"
  - Our Story Values: New "Low Carbon Footprint" value highlighting cleaner burning formula

## Prioritized Backlog

### P0 (Critical)
- [x] Remove hardcoded preview URLs from codebase (DONE)
- [ ] **DEPLOY TO VERCEL** - See deployment instructions below

### P1 (High)
- [ ] Add Bakhoor category products (awaiting images/prices)
- [ ] Additional Dhoop product images

### P2 (Medium)
- [ ] Google Search Console setup
- [ ] GST Verification API stability
- [ ] WhatsApp API integration

### P3 (Low)
- [ ] Delete legacy /app/frontend folder
- [ ] Google Analytics integration

## API Endpoints (Key)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/forgot-username` - Username recovery
- `POST /api/admin/login/initiate` - Admin 2FA step 1
- `POST /api/admin/login/verify-otp` - Admin 2FA step 2
- `POST /api/admin/forgot-pin/reset` - Admin PIN reset
- `GET /api/products` - Product list
- `GET /api/products/:slug` - Product details

## Database Collections
- `users` - User accounts (email, username, username_lower)
- `admin_settings` - Admin credentials (pin_hash)
- `orders` - Customer orders
- `products` - (served from routers/products.py as static data)

## Known Issues
- GST Verification API occasionally times out (external API issue)

---

## 🚀 VERCEL DEPLOYMENT INSTRUCTIONS

**CRITICAL**: Before pushing to GitHub, you MUST configure your Vercel Environment Variables.

### Step 1: Go to Vercel Dashboard
1. Log in to [vercel.com](https://vercel.com)
2. Select your project (the one connected to centraders.com)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variable
Add the following environment variable:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend-url.com` | Production, Preview, Development |

**Replace `https://your-backend-url.com`** with your actual backend server URL. This is where your FastAPI backend is hosted.

### Step 3: Save and Push to GitHub
1. Click "Save" in Vercel
2. Come back to Emergent
3. Click **"Save to Github"** in the chat input
4. Vercel will automatically redeploy with the new environment variable

### Why This Matters
- The Next.js frontend uses **Server-Side Rendering (SSR)** to load products
- SSR runs on Vercel's servers, which need the backend URL to fetch data
- Without `NEXT_PUBLIC_BACKEND_URL`, product loading will fail
- Client-side API calls use relative paths (`/api/*`) which Next.js rewrites handle

