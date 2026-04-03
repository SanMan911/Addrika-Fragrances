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
- ✅ Fixed homepage product section random loading failures
  - Added robust retry logic with exponential backoff (500ms, 1s, 2s)
  - Added AbortController with 15s timeout for slow networks
  - Added `redirect: 'follow'` to handle 307 redirects properly
  - Fixed race condition where loading=false was set before retry completed
- ✅ Fixed product size image switching (50g → 200g updates gallery)
- ✅ Removed "100% Natural" messaging (replaced with CSR focus)
  - Hero badge: "CSR Driven"
  - USP card: "CSR Commitment" - supports local artisans
  - Product descriptions updated throughout
- ✅ Fixed Find Retailers page - was calling wrong API endpoint
  - Changed from `/api/retailers/public` to `/api/retailers`
  - Now shows all 4 verified retailers (Delhi, Mumbai, Bengaluru)

## Prioritized Backlog

### P0 (Critical)
- [ ] Vercel deployment with correct environment variables

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
