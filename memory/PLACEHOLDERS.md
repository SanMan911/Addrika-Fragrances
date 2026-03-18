# Addrika Platform - Placeholders & Configuration Guide

This document tracks all placeholders and pending configurations in the Addrika e-commerce platform.

---

## 🔴 HIGH PRIORITY - Required for Production

### 1. Google Analytics (GA4)
**File:** `/frontend/src/lib/analytics.js`  
**Line:** 14  
**Current Value:** `G-XXXXXXXXXX`  
**What to do:**
1. Go to https://analytics.google.com
2. Admin → Data Streams → Select/Create web stream
3. Copy the Measurement ID (format: `G-XXXXXXXXXX`)
4. Replace the placeholder in the file

**Status:** ⏳ PLACEHOLDER

---

### 2. Flag Counter Widget  
**File:** `/frontend/src/components/Footer.jsx`  
**Location:** Flag Counter section (around line 245)  
**Current Value:** Generic flag counter URL  
**What to do:**
1. Go to https://www.flagcounter.com
2. Customize your counter (background: #1A252F, text: #FFFFFF, border: #C19A6B)
3. Copy the generated `<img>` src URL
4. Replace the img src in Footer.jsx

**Status:** ⏳ PLACEHOLDER (using generic counter)

---

### 3. Facebook QR Code
**File:** `/frontend/src/components/InstagramFeed.jsx`  
**Location:** `socialQRCodes` object  
**Current Value:** `image: null, enabled: false`  
**What to do:**
1. Create Facebook QR code image
2. Save to `/frontend/public/images/facebook-qr.png`
3. Update in InstagramFeed.jsx:
   ```javascript
   facebook: {
     image: '/images/facebook-qr.png',
     enabled: true,
     // ... rest stays same
   }
   ```

**Status:** ⏳ WAITING FOR QR CODE

---

### 4. International Shipping API Integration
**File:** `/frontend/src/lib/shipping.js`  
**Current:** Zone-based estimated rates  
**What to do for real-time rates:**
1. Sign up for ShipRocket (recommended for India) or EasyPost
2. Get API credentials
3. Replace estimated rates with API calls
4. Options:
   - ShipRocket: https://www.shiprocket.in/api/
   - EasyPost: https://www.easypost.com/
   - Shippo: https://goshippo.com/

**Status:** ⏳ USING ESTIMATED RATES

---

### 5. Exchange Rates API
**File:** `/frontend/src/lib/international.js`  
**Current:** Static exchange rates in `EXCHANGE_RATES_TO_USD`  
**What to do:**
1. Sign up for exchange rate API (e.g., exchangerate-api.com, openexchangerates.org)
2. Replace static rates with API calls
3. Cache rates and refresh daily

**Status:** ⏳ USING STATIC RATES (Updated Feb 2026)

---

### 6. PayPal Integration
**Status:** 🔲 NOT IMPLEMENTED (kept as future option)
**When needed:** For international customers whose local currency isn't supported by RazorPay
**Notes:** RazorPay international is enabled; PayPal is a fallback option

---

## 🟡 MEDIUM PRIORITY - Enhancement Features

### 7. Instagram Feed Posts
**File:** `/frontend/src/components/InstagramFeed.jsx`  
**Location:** `instagramPosts` array (line 7)  
**Current Value:** Empty array `[]`  
**What to do:**
1. Get public Instagram post URLs from @addrika.fragrances
2. Add URLs to the array:
   ```javascript
   const instagramPosts = [
     'https://www.instagram.com/p/ABC123/',
     'https://www.instagram.com/p/DEF456/',
     'https://www.instagram.com/p/GHI789/',
   ];
   ```

**Status:** ⏳ SHOWING PLACEHOLDERS

---

### 8. Firebase Cloud Messaging (FCM) - User Tokens
**File:** `/backend/services/push_service.py`  
**Issue:** Currently uses hardcoded device token  
**What to do:**
1. Implement user-specific FCM token storage
2. Update token on user login/registration
3. Send targeted push notifications

**Status:** ⏳ BASIC IMPLEMENTATION (needs user-specific tokens)

---

### 9. Product Images - New Categories
**Location:** Product images folder  
**Missing:**
- Dhoop Collection images
- Bakhoor & Oud images
- Home & Personal Care images
- Regal Rose fragrance image
- Oriental Oudh fragrance image
- Bold Bakhoor fragrance image

**Status:** ⏳ USING PLACEHOLDERS

---

### 10. Partner/Distributor Inquiry Form
**File:** Footer links to `#partner`  
**Current:** Links to anchor (no dedicated page)  
**What to do:**
1. Create `/partner` page with distributor inquiry form
2. Or link to contact form with "Distributor Inquiry" subject

**Status:** ⏳ LINK ADDED, FORM PENDING

---

## 🟢 LOW PRIORITY - Future Enhancements

### 11. Social Login Providers
**Files:** Auth system  
**Missing:** Facebook Login, Apple Login  
**Status:** ⏳ NOT IMPLEMENTED

### 12. Automated Review Request Emails
**Description:** Send email 3 days after delivery asking for review  
**Status:** ⏳ NOT IMPLEMENTED

### 13. Instagram New Post Notifications
**Description:** Auto-notify users when new Instagram post is published  
**Status:** ⏳ NOT IMPLEMENTED

---

## ✅ COMPLETED CONFIGURATIONS

| Item | File | Status |
|------|------|--------|
| Razorpay Integration | `.env` | ✅ Configured |
| Razorpay International | Backend | ✅ Enabled |
| Resend Email | `.env` | ✅ Configured |
| MongoDB | `.env` | ✅ Configured |
| Firebase FCM | `/lib/firebase.js` | ✅ Basic Setup |
| Zoho Sheets OAuth | Backend routes | ✅ Implemented |
| Instagram QR Code | `/public/images/` | ✅ Added |
| Google OAuth | Backend | ✅ Emergent-managed |
| Dark Mode Fixes | Components | ✅ Fixed |
| Women SHG Content | USPSection | ✅ Added |
| International Pricing | `/lib/international.js` | ✅ Implemented |
| International Shipping | `/lib/shipping.js` | ✅ Implemented |
| Thank You Page | `/pages/ThankYou.jsx` | ✅ Implemented |

---

## Quick Reference - File Locations

```
/app
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── analytics.js      # Google Analytics config
│   │   │   ├── firebase.js       # Firebase FCM config
│   │   │   ├── international.js  # Multi-currency & regional pricing
│   │   │   └── shipping.js       # International shipping zones & carriers
│   │   ├── components/
│   │   │   ├── Footer.jsx        # Flag Counter widget, Partner link
│   │   │   ├── InstagramFeed.jsx # Instagram posts & QR codes
│   │   │   ├── FragranceGrid.jsx # Product cards (dark mode fixed)
│   │   │   ├── PackagingSection.jsx # Size options (dark mode fixed)
│   │   │   └── USPSection.jsx    # Why Choose Addrika (Women SHG added)
│   │   └── pages/
│   │       ├── ThankYou.jsx      # Post-purchase thank you page
│   │       └── Checkout.jsx      # Checkout (redirects to ThankYou)
│   └── public/
│       └── images/
│           ├── instagram-qr.png  # ✅ Added
│           └── facebook-qr.png   # ⏳ Pending
└── backend/
    ├── .env                      # API keys & secrets
    └── services/
        └── push_service.py       # FCM push notifications
```

---

*Last Updated: February 14, 2026*
