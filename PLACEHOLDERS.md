# Addrika - Placeholders and Pending Configurations

This document tracks all placeholder implementations and configurations that need to be completed before production deployment.

## Last Updated: February 14, 2026

---

## ✅ COMPLETED - Shipping & Communications

### ShipRocket API (LIVE)
**Status**: ✅ Fully Integrated and Working (Domestic Only)
**Files**: 
- `/backend/services/shiprocket_service.py` - API client
- `/backend/routers/shipping.py` - API endpoints
- `/backend/.env` - Credentials configured

**Configuration**:
- API Email: contact.us@centraders.com
- Pickup Pincode: 110078 (Delhi)
- Weight adjustments: 50g packet → 80g, 200g jar → 350g
- International shipping: DISABLED (pending IEC documentation)

**Webhook Setup** (for real-time tracking updates):
- **URL**: `https://centraders.com/api/shipping/webhook/shiprocket`
- **Token**: `addrika_sr_wh_2026_xK9mP4qL7vN2`

### Review Request Emails (LIVE)
**Status**: ✅ Implemented
**Files**:
- `/backend/services/email_service.py` - Review email template
- `/backend/services/scheduler_service.py` - Background scheduler

**How it works**:
1. ShipRocket webhook receives "delivered" status (status_id=7)
2. Review email automatically scheduled for 3 days later
3. Background scheduler sends emails at 10 AM IST
4. Admin can view/manage scheduled emails at `/api/admin/scheduled-reviews`

---

## 🟡 MEDIUM PRIORITY - Pending Configurations

### 1. Google Analytics
**Status**: ⏳ Placeholder
**Files**: 
- `/frontend/src/lib/analytics.js`
- `/frontend/src/index.js`

**Required Configuration**:
```env
# In frontend/.env
REACT_APP_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**How to Get**: 
1. Go to https://analytics.google.com/
2. Create or select a property
3. Copy the Measurement ID (starts with G-)

---

### 2. International Shipping
**Status**: ⏳ Disabled - Pending Documentation
**Reason**: Requires Import Export Code (IEC) and GST name updates
**Files**: `/backend/routers/shipping.py` - International routes disabled

**To Enable Later**:
1. Obtain IEC from DGFT
2. Update GST registration if needed
3. Uncomment international shipping code in shipping.py

---

### 3. Instagram Feed Placeholders
**Status**: ⏳ Placeholder content
**Files**: `/frontend/src/components/InstagramFeed.jsx`
**Action**: Replace hardcoded posts with actual Instagram content or dynamic feed

### 4. Facebook QR Code
**Status**: ⏳ Placeholder
**Files**: `/frontend/src/components/InstagramFeed.jsx`
**Action**: Add actual Facebook QR code image to `/frontend/public/images/facebook-qr.png`
**Config**: Set `facebook.enabled: true` in the component

---

## ✅ COMPLETED

- **ShipRocket Integration** (LIVE - Domestic) - Real-time shipping rates
- **ShipRocket Webhooks** (READY) - Real-time tracking updates
- **Review Request Emails** (LIVE) - 3 days after delivery
- **Dark Mode Default** - New visitors see dark mode
- **Logo Updates** - Light mode hero now has full 'A' emblem logo
- **Favicon** - Updated to use Addrika 'A' logo
- **Razorpay Integration** (LIVE)
- **Resend Email Service** (LIVE)
- **Firebase Cloud Messaging** (Configured)
- **Zoho Sheets Integration** (OAuth2 Complete)
- **Google OAuth Login** (LIVE)
- **Dark Mode Theme** (LIVE)
- **Google Translate** (LIVE)
- **Flag Counter Widget** (LIVE)
- **Thank You Page** (LIVE)
- **Women SHGs Content** (LIVE)
- **Partner With Us Link** (LIVE)

---

## ❌ REMOVED FROM BACKLOG

- ~~User-specific FCM tokens~~ - Browser-only limitation, not practical
- ~~Social login (Facebook/Apple)~~ - Doesn't capture phone numbers
- ~~PayPal Integration~~ - Not needed for now

---

## Configuration Checklist for Production

- [x] ShipRocket API credentials configured
- [x] Pickup pincode set to 110078 (Delhi)
- [x] Weight adjustments applied (50g→80g, 200g→350g)
- [x] Dark mode as default
- [x] Logo consistency (light/dark modes)
- [x] Favicon with 'A' logo
- [x] Review request email system
- [ ] Configure ShipRocket webhook in ShipRocket dashboard
- [ ] Add Google Analytics Measurement ID
- [ ] Replace Instagram placeholder posts
- [ ] Add Facebook QR code image
- [ ] Obtain IEC for international shipping
