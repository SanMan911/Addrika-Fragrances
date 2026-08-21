# Addrika Platform — Roadmap

_Prioritized backlog. Completed items move to CHANGELOG.md. Last synced Feb 2026._

---

## 🔴 P0 (blockers)
_None currently._

## 🟠 P1 (next up)
- **Retailer session-handoff endpoint** — extend `/api/auth/handoff/*` to accept
  retailer bearer tokens and set the `retailer_session` cookie so
  `openWebCheckout(lines, 'retailer', bearerToken)` auto-logs retailers into
  `/retailer/b2b/cart`. Deferred from Iter 97 to avoid customer-flow regression.
  _Requested by user, Feb 2026._
- **Verify Vercel Web Redeploy** — walk through
  `frontend-next/VERCEL_REDEPLOY_CHECKLIST.md` after every push to `main` so
  the mobile→web deep-link JS chunk and `/track-order` 308 land in prod.
- **Wire non-interactive `yarn lint`** so CI can gate PRs on lint + brand-audit
  + expo-doctor together (currently `next lint` prompts interactively).

## 🟡 P2 (medium)
- **Split `b2b_orders.py` further** — calculate/order-body already extracted;
  pull remaining verify-payment + post-payment hooks into `services/`.
- **Retailer Onboarding Video** — 60-second walkthrough of Aaroviah cart →
  WhatsApp share flow, pinned inside the retailer portal's first-login tour.
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
