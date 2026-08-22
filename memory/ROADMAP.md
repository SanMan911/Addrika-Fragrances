# Addrika Platform — Roadmap

_Prioritized backlog. Completed items move to CHANGELOG.md. Last synced Feb 2026._

---

## 🔴 P0 (blockers)
_None currently._

## 🟠 P1 (next up)
- **B2C flow in mobile app** — currently hidden/disabled per user decision
  (Iter 98). Code paths remain (`loginCustomer`, /cart route, B2C product
  filters) — re-enable when we re-open retail to phone users. Revisit after
  in-app payments decision (P2 below).
- **In-app Razorpay payment wall (Path B)** — deferred at user's request
  after Iter 98 pivot. If revisited, needs Razorpay React Native SDK,
  Expo dev-client, and duplicating KYC-gate / voucher / shipping-quote
  UIs on mobile.
- **Verify Vercel Web Redeploy** — walk through
  `frontend-next/VERCEL_REDEPLOY_CHECKLIST.md` after every push to `main`
  so the retailer handoff + `/retailer/b2b` hydration chunk land in prod.
- **Wire non-interactive `yarn lint`** so CI can gate PRs on lint +
  brand-audit + expo-doctor together.

## 🟡 P2 (medium)
- **401 XHR on `/retailer/b2b` first paint** — an authed XHR fires before
  the retailer session resolves; page renders fine but noisy in the
  console. Gate the initial fetch on `isAuthenticated`.
- **Suppress B2B Quick Tour** when a mobile cart handoff was just
  consumed (skip on `?cart=` presence in the initial URL).
- **Split `b2b_orders.py` further** — calculate/order-body already extracted;
  pull remaining verify-payment + post-payment hooks into `services/`.
- **Retailer Onboarding Video** — 60-second walkthrough of Aaroviah cart →
  auto-login → `/retailer/b2b` hydration → Order Placed celebration flow,
  pinned inside the retailer portal's first-login tour.
- **Order Mirror Analytics endpoint** — `/api/admin/supabase-mirror/orders-summary`
  surfacing mirror lag + row counts for ops.
- **Wipe-utility mirror consistency** — `wipe_all_data` and admin
  `delete_many({})` for orders currently leave stale Supabase mirror rows;
  wire them to purge the mirror side too.
- **GA4 measurement ID** — drop actual `G-XXXXXXXXXX` into
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` (currently using direct gtag injection).
- **Apply title-case rules form-by-form** across the remaining low-traffic
  forms (helper ready; high-traffic done).

## 🟢 P3 (low)
- Additional customer-facing forms: apply the `formHelpers.js` normalisation
  rules to any newly-added forms.
- Add a `<NewsletterSubscribeForm />` on `/blog` to start populating the
  auto-blog email blast list (currently 0 subscribers → blasts are no-ops).

---

_All completed roadmap items land in `CHANGELOG.md` with their iteration number._
