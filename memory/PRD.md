# Addrika E-commerce Platform - PRD

## Latest Updates
- **28 Mar 2026**: ✅ **USERNAME FEATURE & ADMIN NOTIFICATIONS COMPLETE**
  - Added **username field** to registration (case-sensitive for display, case-insensitive for lookups)
  - Username can be used for login alongside email
  - Added **"Forgot Username"** feature - retrieves username via phone number, sends to masked email
  - Blocked reserved usernames: `SanMan911`, `911SanMan`, `SanMan`
  - Admin panel now logs all new registrations with unread notification count
  - Updated "Premium & Eco-Conscious" section with AI-generated Bakhoor jar image

- **28 Mar 2026**: ✅ **DARK THEME, CART FIXES & QUICK VIEW COMPLETE**
  - Fixed CartContext to support both addToCart signatures
  - Added isCartOpen/setIsCartOpen state for cart sidebar
  - Created CartSidebar component for smooth cart experience
  - **NEW: Quick View Modal** - Add products to cart without leaving the page
  - Switched frontend from React SPA to Next.js (now serving on port 3000)
  - All auxiliary pages now use shared Header/Footer with dark theme
  - Fixed routing so all routes serve from Next.js app
  - Cart badge updates correctly when adding items

- **December 2025**: ✅ **NEXT.JS MIGRATION COMPLETE**
  - **Retailer Portal (9 pages)**: Login, Dashboard, Orders, B2B Ordering, Badges, Leaderboard, Grievances, Messages, Profile Requests
  - **Account Sub-pages (4 pages)**: Addresses, Notifications, Payments, Settings
  - Total routes: 63 pages fully migrated and tested
  - All protected routes properly redirect to login when unauthenticated
  - Build verified successful

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

### Next.js Migration Status ✅ COMPLETE
- [x] Homepage with SSR
- [x] Product pages with SSG (4 products)
- [x] SEO pages (About, FAQ, Blog, etc.)
- [x] Auth flow (Login, Register, Forgot Password)
- [x] Admin Auth (Login with 2FA, Forgot PIN)
- [x] Cart & Checkout with Razorpay
- [x] Orders & Order Success
- [x] Wishlist
- [x] Account Dashboard
- [x] **Admin Dashboard (13 pages)**
- [x] **Retailer Portal (9 pages)**
- [x] **Account Sub-pages (4 pages)**

### Dark Theme Status ✅ COMPLETE
All public-facing pages now use consistent dark theme with shared Header/Footer:
- [x] Homepage
- [x] Product pages
- [x] Our Story
- [x] FAQ
- [x] Blog
- [x] Find Retailers
- [x] Track Order
- [x] Wishlist
- [x] Cart
- [x] Checkout
- [x] Privacy Policy
- [x] Terms of Service
- [x] Shipping & Returns
- [x] About Us

### Cart Functionality ✅ FIXED
- [x] CartContext supports both signatures: `addToCart(item)` and `addToCart(product, size, quantity)`
- [x] Header cart icon shows badge with cart count
- [x] Cart sidebar opens when clicking cart icon
- [x] Add to cart shows toast notification
- [x] Cart persists in localStorage

---

## Technical Architecture

### Frontend (Next.js)
- **Directory**: `/app/frontend-next/`
- **Port**: 3000 (production)
- **Framework**: Next.js 14.2.28 (App Router)
- **Styling**: Tailwind CSS + Shadcn UI
- **State**: React Context (Auth, Cart, Wishlist, Theme)

### Backend (FastAPI)
- **Directory**: `/app/backend/`
- **Port**: 8001
- **Database**: MongoDB
- **Auth**: JWT + bcrypt
- **Payments**: Razorpay
- **Emails**: Resend

### Key Files
- `/app/frontend-next/context/CartContext.js` - Cart state management
- `/app/frontend-next/components/Header.js` - Shared header with cart icon
- `/app/frontend-next/components/Footer.js` - Shared footer
- `/app/frontend-next/components/CartSidebar.js` - Cart sidebar component
- `/app/frontend-next/components/QuickViewModal.js` - Quick view modal for products
- `/app/frontend-next/components/FragranceGrid.js` - Product grid with Quick View buttons
- `/app/frontend-next/components/PackagingSection.js` - Premium & Eco-Conscious section with AI image
- `/app/frontend-next/app/forgot-username/page.js` - Forgot Username page
- `/app/backend/routers/auth.py` - Auth endpoints including username validation, forgot-username
- `/app/backend/routers/admin/admin_users.py` - Admin user management + registration logs

---

## P0 (Critical) - DONE
- [x] Full Next.js migration
- [x] Dark theme consistency
- [x] Cart functionality
- [x] Shared Header/Footer
- [x] Username registration & login
- [x] Forgot Username feature
- [x] Admin registration notifications

## P1 (High Priority)
- [ ] Google Search Console setup (submit sitemap.xml)
- [ ] Vercel production deployment
- [ ] Delete legacy `/app/frontend` folder after production verification

## P2 (Medium Priority)
- [ ] Instagram API integration
- [ ] WhatsApp Business API
- [ ] GST Verification API stability

## P3 (Low Priority/Future)
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Subscription boxes

---

## Deployment Notes

### For Vercel Deployment:
1. Root Directory: `frontend-next`
2. Framework Preset: Next.js
3. Build Command: `yarn build`
4. Output Directory: `.next`

### Environment Variables:
- `NEXT_PUBLIC_API_URL`: Backend API URL
