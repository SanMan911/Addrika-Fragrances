# Addrika E-Commerce Platform - PRD

## 🔴 CURRENT PRIORITY ITEMS (always pinned at top)
> These get reminded with every PRD update until completed.

- 🟠 **P1** — ~~Drop in `ZOHO_REFRESH_TOKEN` + `ZOHO_ORG_ID` to activate Sales Order + Customer Payment auto-sync to Zoho Books~~ ✅ **DONE Apr 25, 2026** — connected via in-app OAuth flow (refresh_token in `admin_settings.zoho_oauth`, org_id `60057247059`).
- 🟠 **P1** — Replace placeholder images for Bilvapatra Fragrance Agarbatti, 8" Bambooless Dhoop, and Royal Kewda once real product photos are provided.
- 🟠 **P1** — ~~Sandbox API KYC infrastructure~~ ✅ **LIVE Apr 26, 2026** — keys plugged in, end-to-end verified with real PAN (returned `GE VERNOVA T&D INDIA LIMITED`). KYC widget embedded in `/admin/b2b/waitlist` and `/retailer/setup-password` flows.

## 🔑 Required API Keys / Credentials Summary
| Integration | Env var(s) | Status | Where to obtain |
| --- | --- | --- | --- |
| Razorpay (payments) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | ✅ in .env | razorpay.com/dashboard |
| Resend (emails) | `RESEND_API_KEY`, `SENDER_EMAIL` | ✅ in .env | resend.com → API Keys |
| Appyflow GST verify | `APPYFLOW_API_KEY` | ✅ in .env (Apr 25) | appyflow.in/gst-api |
| Zoho Books (ERP) | `ZOHO_REFRESH_TOKEN`, `ZOHO_ORG_ID` | ✅ live (Apr 25) — refresh_token saved in `admin_settings.zoho_oauth`, org_id `60057247059` | api-console.zoho.in (Self-Client) + Zoho Books → Settings → Organization Profile |
| Google Analytics 4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ❌ pending | analytics.google.com → Admin → Data Streams |
| AEPS India (PAN+Aadhaar eKYC) | `AEPS_API_KEY`, `AEPS_API_SECRET` | ❌ deprecated — replaced by Sandbox API | aepsindia.com developer portal |
| Sandbox API KYC | `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`, `SANDBOX_API_VERSION` | ✅ LIVE (Apr 26) — verified end-to-end with real PAN | app.sandbox.co.in/signup |
| Emergent LLM Key (object storage) | `EMERGENT_LLM_KEY` | ✅ live (Apr 26) — required for object storage / bills migration | platform-managed |
| Optional invoice header overrides | `SELLER_NAME`, `SELLER_GSTIN`, `SELLER_ADDRESS`, `SELLER_STATE`, `SELLER_EMAIL`, `SELLER_PHONE` | optional, defaults shipped | hard-coded fallback to Centsibl Traders / Delhi |

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

### April 24, 2026 — B2B Phase 2 (Waitlist · Loyalty · Bills · Messaging · Refactor)
- **Retailer Waitlist** captured on `/retailer/login` while portal is disabled. Public `POST /api/retailer-auth/waitlist` (deduped on email). Admin view at `/admin/b2b/waitlist` with status workflow (new → contacted → onboarded → archived).
- **Quarterly Loyalty Bonus** — admin-configurable milestones (defaults seeded: ₹10k→0.5%, ₹25k→1%, ₹50k→2%). Highest-matched milestone applied automatically on subtotal **AFTER tier discount** and **BEFORE 1.5% cash discount**. Retailer sees a progress bar + next-milestone hint on `/retailer/b2b`. Admin manages milestones at `/admin/settings/b2b/loyalty`. New endpoint `GET /api/retailer-dashboard/b2b/loyalty`.
- **Bills & Invoices** — admin uploads PDFs/images per retailer at `/admin/b2b/retailers/{id}` (Bills tab); retailer downloads at `/retailer/bills`. Base64 in Mongo, 5MB cap, allowed: PDF/PNG/JPG/WEBP. List endpoints strip `file_base64` for performance.
- **Admin↔Retailer Messaging** — threaded chat with safe attachments (5MB, same MIME whitelist). Retailer at `/retailer/admin-chat`, admin at `/admin/b2b/retailers/{id}` (Messages tab). Endpoints: `GET/POST /api/retailer-dashboard/admin-chat`, `GET /api/retailer-dashboard/admin-chat/attachment/{id}/{i}`; admin: `GET /api/admin/b2b/threads`, `GET/POST /api/admin/b2b/retailers/{id}/messages`, `GET /api/admin/b2b/messages/attachment/{id}/{i}`.
- **Per-retailer admin detail page** at `/admin/b2b/retailers/[id]` with 3 tabs: **Orders** (status + payment_status), **Bills**, **Messages**.
- **Refactor** — `B2B_PRODUCTS` extracted from `b2b_orders.py` into `services/b2b_catalog.py`; `admin_b2b_settings.py` now imports the shared module (no more cross-router coupling).
- **Tested** — iteration_61 (initial), iteration_62 (after route-collision fix). 40/40 backend tests green. Pytest regression: `tests/test_b2b_expansion.py`, `tests/test_b2b_iteration_61.py`.

### April 24, 2026 — B2B Phase 3 (Reports · UX rules · GA · Hero · GST-after-discount)
- **GST is now calculated AFTER all known-at-supply discounts** (tier → loyalty → voucher → cash) per Indian GST law. New `taxable_value` field and per-line `line_total_after_loyalty` / `taxable_value`.
- **Top 5 Retailers widget** on `/admin` dashboard — `GET /api/admin/b2b/reports/top-retailers` (period=quarter|fy). Highlights retailers within 10% of their next loyalty tier so admin can nudge them.
- **Sales Reports** at `/admin/b2b/reports` — `GET /api/admin/b2b/reports/sales` with `period=quarter|fy|custom`, `group_by=retailer|quarter|month`, plus combined totals and CSV export. Indian FY (Apr 1 → Mar 31).
- **Waitlist UX rules** — GST now mandatory + format-validated, best-effort auto-verify (non-blocking), country-code dropdown (defaults `+91`), WhatsApp number, **server-side title-case** for names/city, lowercase email. Stores `whatsapp_full = country_code + phone`. New `frontend-next/lib/formHelpers.js` — `titleCase`, `lowerEmail`, `COUNTRY_CODES`, `GST_REGEX` reusable across all future forms.
- **Bills 15-month retention** — `purge_old_bills(db)` runs on backend startup; deletes `retailer_bills` older than 458 days.
- **Refactor** — `send_b2b_admin_notification_email` extracted from `b2b_orders.py` into `services/b2b_emails.py`.
- **Google Analytics + cookie consent** — `NEXT_PUBLIC_GA_MEASUREMENT_ID` placeholder; `<CookieConsentAndGA />` only loads GA after Accept and only on public paths (skips `/admin/**` and `/retailer/**`); IP anonymization on.
- **Hero smoke wisps** — `<HeroSmoke />` pure-CSS layered radial-gradient blurs drifting upward at low opacity; respects `prefers-reduced-motion`; ~3 KB, no video. Rendered behind hero text via `z-index: 0`.
- **Tested** — iteration_63.json: 55/55 backend (15 iter63 + 13 iter61 + 7 expansion + 20 killswitch). Public frontend (cookie/hero/waitlist) verified.

### April 24, 2026 — Zoho Books · Nudge · Magic-number · Coming-Soon Blast
- **Zoho Books direct integration** (single-tenant OAuth refresh-token, region `in`). Auto-creates Sales Order on B2B order placement and records Customer Payment on Razorpay verify. Discounts (loyalty + voucher + cash) split proportionally per line so Zoho's GST math matches ours. Tier discount stays inside `line_total`. Best-effort, gated behind `is_configured()` — silently no-ops if `ZOHO_REFRESH_TOKEN` / `ZOHO_ORG_ID` blank, never breaks the user-facing flow.
- **Admin Zoho controls**: `GET /api/admin/zoho/status` (health), `POST /api/admin/zoho/resync/{order_id}` (idempotent retry); per-row "Sync" button on retailer-detail Orders tab (only renders for orders not yet synced).
- **Nudge button** on Top-5 Retailers widget → opens `wa.me/{cc}{phone}?text=…` with a pre-filled INR-localized message; only shown for retailers within 10% of next milestone AND who have a phone number on file. `country_code` now in projection (no `+91` fallback).
- **Magic-number sniffing** on bill / message attachments — server-side validates first 16 bytes against PDF / PNG / JPEG / WEBP signatures AND asserts sniffed MIME == declared `file_type` (with `image/jpg` ↔ `image/jpeg` alias). Defense in depth on top of the 5MB cap and MIME whitelist.
- **Coming Soon → Available email blast**: `POST /api/admin/notify-me/{product_id}/blast` — emails every subscriber, sets `notified_at` so re-runs are idempotent. 400 if product still flagged comingSoon, 404 if unknown.
- **`.env` cleanup**: pre-existing `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` (from the old Sheets work) are reused; only `ZOHO_REFRESH_TOKEN` and `ZOHO_ORG_ID` need to be plugged in to flip the integration on.
- **Tested** — iteration_64.json: 72/72 (17 new + 55 regression). All Zoho calls covered for the no-op path so production is safe with creds blank.

### Zoho Books — to flip on
1. Visit https://api-console.zoho.in → Self Client → use the existing CLIENT_ID/SECRET in `.env`.
2. Generate a code with scope: `ZohoBooks.contacts.CREATE,ZohoBooks.contacts.UPDATE,ZohoBooks.contacts.READ,ZohoBooks.salesorders.CREATE,ZohoBooks.salesorders.READ,ZohoBooks.customerpayments.CREATE,ZohoBooks.customerpayments.READ` (offline access).
3. Exchange the code for a refresh_token (one-time).
4. Find your `organization_id` under **Settings → Organization Profile** in Zoho Books.
5. Set `ZOHO_REFRESH_TOKEN` and `ZOHO_ORG_ID` in `backend/.env`, restart backend. Done.

### April 24, 2026 (later) — GST-after-discount visibility · Object storage · Form rules · Email layout
- **Admin notification email rewritten** — explicit row-by-row breakdown: `Subtotal → bulk-tier savings (info) → Loyalty Discount → Voucher Discount → Online Payment Discount → Taxable Value → GST @ 18% (on taxable value) → Credit Note → Grand Total`. GST is now visually proven to be on the post-discount taxable value. Persisted on order doc: `subtotal_after_loyalty`, `tier_discount_total`, `taxable_value`. New regression test `tests/test_b2b_email_layout.py`.
- **Object-storage support for bills**: `services/object_storage.py` + Emergent managed bucket. Bill upload tries object storage first (≤5MB), falls back to base64-in-Mongo if not configured. Download endpoints transparently hydrate either source — fully backwards-compatible with existing legacy bills. Records carry `storage_path` (new) or `file_base64` (legacy).
- **Form rules** applied to remaining customer-facing forms (`/register`, `<NotifyMeButton>`, `/track-order`): emails lowercase-normalized; existing register form already had title-case + WhatsApp + `+91` default. Helper at `lib/formHelpers.js` is the canonical source for any future form.
- **Tested** — 18/18 (1 new email-layout test + 17 iter64 regression). Full suite: 73/73 across all 6 test files.

### April 25, 2026 — PDF Invoices · Zoho Error Alerts · 90-day Thread Auto-Archive
- **Server-side B2B GST tax invoice (PDF)** via `reportlab` — `services/b2b_invoice_pdf.py`. Splits CGST+SGST when buyer & seller share state, IGST otherwise (state derived from GSTIN prefix). Uses persisted per-line `taxable_value` so GST math always equals the on-screen / email math. New endpoints:
  - Admin: `GET /api/admin/b2b/orders/{order_id}/invoice.pdf`
  - Retailer: `GET /api/retailer-dashboard/b2b/orders/{order_id}/invoice.pdf`
  Admin invoice button rendered on `/admin/b2b/retailers/[id]` Orders tab; retailer download button on `/retailer/b2b` Orders list. Both use blob-download via `authFetch`. Optional `SELLER_*` env vars override the hard-coded Centsibl Traders fallback.
- **Zoho Books sync error log**: `services/zoho_errors.py` + `zoho_sync_errors` collection. Every B2B order create + payment verify (and admin resync) records a row + emails `contact.us@centraders.com` when Zoho returns `None` or raises. New endpoints:
  - `GET /api/admin/zoho/errors` (admin), `GET /api/admin/zoho/errors/count`, `POST /api/admin/zoho/errors/{id}/resolve`
- **Admin Zoho Errors banner**: `<ZohoErrorsBanner />` rendered above Top-5 Retailers on `/admin`. Polls every 60s, expandable list with per-row Retry (calls existing `/api/admin/zoho/resync/{order_id}`) and Resolve buttons. Dismissible per session.
- **Auto-archive admin↔retailer threads idle > 90 days**: `services/b2b_thread_archive.py`. Runs on backend startup + daily 24h loop. Flags `archived: true` on `retailer_admin_threads` (no retailer status change). Posting a new message auto-unarchives. Admin threads list (`/api/admin/b2b/threads`) hides archived by default — pass `?include_archived=true` to see them.
- **Tested** — `tests/test_b2b_invoice_zoho_archive.py` (9 new tests: PDF magic-bytes, admin & retailer endpoints, 401/404 paths, Zoho error CRUD, idle thread flagging + filter). Full B2B suite: **82/82** (53 + 9 new + 20 killswitch).
- **Bug fix surfaced during this session**: `services/b2b_emails.py` had a duplicate `if loyalty_disc > 0:` causing IndentationError → backend crash on import. Fixed.
- **Required new env vars**: none. Optional: `SELLER_*` vars to override invoice header.

### April 25, 2026 (later) — Appyflow GST Verify · P2 Pricing Refactor
- **Appyflow GST verification integrated** as primary provider. `services/gst_verification.py` rewritten as `Appyflow → gstincheck` cascade: tries `https://appyflow.in/api/verifyGST?gstNo=…&key_secret=…` first, falls back to legacy free-tier if Appyflow returns non-verified or errors. Both providers reshape to the same internal dict, so all callers (`/api/admin/retailers/{id}/verify-gst`, `/api/retailer-auth/waitlist`, etc.) keep working. Live-tested — verified `27AAACR5055K1Z7` ⇒ `Appyflow Technologies` is Active.
- **Env**: `APPYFLOW_API_KEY` added to backend `.env`. `GST_VERIFICATION_API_KEY` retained as fallback.
- **P2 refactor — pricing engine extracted**: `routers/b2b_orders.py` shrank from **881 → 621 lines** (-30%). New `services/b2b_pricing.py` owns: `calculate_line_total`, `validate_retailer_voucher`, `validate_credit_note`, and the entire `calculate_b2b_order` discount-cascade (subtotal → tier → loyalty → voucher/cash → taxable → GST → credit-note → grand_total). Router now just auth-gates and delegates; the order-create path reuses the same service so create/calculate are guaranteed identical.
- **Tested** — full B2B suite: **90/90** passing (82 prior + 8 new GST shape tests in `tests/test_gst_verification.py`). No behavior change in pricing math; refactor is pure code-locality cleanup.

### April 25, 2026 (final) — GSTIN Autofill · Email Invoice · Catalog to MongoDB · Bills Migrator
- **Waitlist GSTIN autofill (Appyflow-powered)**: typing a complete GSTIN on `/retailer/login` fires a debounced call to public endpoint `GET /api/retailer-auth/waitlist/gst-lookup/{gst_number}` and auto-prefills `Business Name`, `City` and `State` from the verified GSTN record. GST input border turns emerald on verify / amber on lookup-miss; state is always derivable from the 2-digit GSTIN prefix as a graceful fallback. New **State** field added next to City. Fixed a pre-existing waitlist bug that read the wrong shape keys (`valid`/`legal_name`) — now reads `verified`/`taxpayer_name`. **Live-tested**: `27AAACR5055K1Z7` ⇒ "Reliance Industries Limited / Navi Mumbai / Maharashtra" ✓.
- **One-click email invoice**: `POST /api/admin/b2b/orders/{order_id}/email-invoice` generates the PDF + attaches it via Resend to the retailer's account email. Sets `invoice_emailed_at` + `invoice_emailed_to` on the order doc. "Email" button added next to the "PDF" button on `/admin/b2b/retailers/[id]` Orders tab — shows ✓ once sent (with last-sent timestamp tooltip). `services/email_service.py` extended to accept `attachments=[{filename, content}]`.
- **B2B catalog → MongoDB**: new `b2b_products` collection. `services/b2b_catalog.py` exposes the same synchronous `B2B_PRODUCTS` / `find_b2b_product` API on top of an in-memory cache warmed at startup from the DB. One-time idempotent seeding happens on boot (`seed_b2b_catalog`). Admin CRUD endpoints: `GET/POST /api/admin/b2b/products`, `DELETE /api/admin/b2b/products/{id}`.
- **Bills migrator** (one-shot): `scripts/migrate_bills_to_object_storage.py` — walks `retailer_bills` with `file_base64` + no `storage_path`, decodes + uploads to Emergent object storage, unsets `file_base64`, writes `storage_path`. Idempotent + dry-run flag. Exposed via `POST /api/admin/b2b/maintenance/migrate-bills[?dry_run=true]`.
- **Tested** — `tests/test_b2b_autofill_backlog.py` adds 11 new tests (GST lookup happy/invalid/unverified, catalog CRUD, migrator dry-run, email-invoice 404/401/send). Full B2B suite: **101/101** passing.

### April 25, 2026 (later still) — One-Click Waitlist → Retailer Onboarding
- **`POST /api/admin/b2b-waitlist/{id}/onboard`** — creates the retailer record using freshly re-fetched Appyflow GSTN data (legal_name, address, city, state, pincode), generates a single-use 24h invite token, and emails a magic-link `setup-password` page via Resend. Marks the waitlist row `onboarded` + links the new `retailer_id`. Returns 409 if already onboarded.
- **`GET /api/retailer-auth/setup-password/validate/{token}`** + **`POST /api/retailer-auth/setup-password`** — public endpoints. Validation returns the welcome name + business name; setup is single-use (token + invite_expires_at unset on success), enforces 8-char minimum.
- **New page**: `/retailer/setup-password?token=…` — pre-greets the user with their business name, asks for new password + confirmation, redirects to login on success. Works with the existing portal kill-switch (login still gated).
- **Admin UI**: green "Onboard as Retailer" button on `/admin/b2b/waitlist` for any non-onboarded entry. Once onboarded, the row shows a "View RTL_…" deep-link to the retailer detail page instead.
- **Tested** — 7 new tests in `tests/test_b2b_onboarding.py` (full happy-path with Appyflow address pull, double-onboard returns 409, single-use token semantics, password length validation, unauth/404 paths). Full B2B suite: **108/108**.

### April 26, 2026 — Sandbox API KYC Infrastructure (PAN + Aadhaar OTP)
- **Sandbox API integrated** at `services/kyc_sandbox.py`. Auth flow uses `x-api-key` + `x-api-secret` headers → `/authenticate` returns short-lived `access_token` (cached in-memory ~24h with 5-min refresh buffer). Token reused across PAN + Aadhaar calls.
- **Endpoints exposed** under both retailer-facing (`/api/retailer-auth/kyc/*`) and admin-facing (`/api/admin/kyc/*`) routers:
  - `GET /status` — public health check, returns `{enabled, provider}`.
  - `POST /pan/verify` — body `{pan_number, name_to_match?, waitlist_id?, retailer_id?}`; persists `pan_verified, pan_full_name, pan_status, pan_verified_at` on the linked doc.

### April 26, 2026 (later) — KYC Live · Retailer Self-KYC · GST-First Waitlist · Dark-OS Fix
- **Sandbox API KYC activated** (live keys plugged into `backend/.env`). End-to-end smoke verified — real PAN `AAACG2115R` returns `{"verified":true, "full_name":"GE VERNOVA T&D INDIA LIMITED", "status":"VALID", "category":"Company"}`. Invalid PAN surfaces Sandbox's actual error message ("Invalid Pan pattern") instead of generic HTTP code.
- **Retailer self-KYC during onboarding**: `/retailer/setup-password?token=…` is now a 2-step wizard. After password is set, retailer is shown the embedded `<KYCVerificationCard retailerId={…} />` so they can verify their PAN + Aadhaar OTP themselves before first login. Skip option preserved (can be done later from dashboard). New `retailer_id` returned by `/setup-password/validate/{token}` so the widget knows which retailer record to persist on.
- **GST-first waitlist form** on `/retailer/login` (Coming Soon screen): GSTIN is now Step 1, full-width prominent field, autofocus + required (form-level + Pydantic-pattern validated). Step 2 (business name / contact / email / phone / city / state) is dimmed + non-interactive until a valid 15-character GSTIN is entered, then revealed with Appyflow auto-fill. Submission blocked client-side if GST missing/invalid.
- **Dark-OS white-input bug FIXED** on `/retailer/*` pages: root cause was browsers in dark-mode OS auto-styling native inputs with white text, ignoring our light theme. Fixed in `globals.css` with `color-scheme: light` on `:root` plus a defensive `input/select/textarea { color: #1a1918 }` rule (admin's `dark:text-*` classes still override correctly via `.dark` parent selector).
- **Bills object-storage migration completed**: `migrate_bills(db)` ran successfully in production — 3 legacy base64 bills moved to Emergent object storage, `file_base64` unset, `storage_path` written. Idempotent re-run shows `{moved: 3, already_in_storage: 3, failed: 0}`.
- **Sandbox error transparency**: new `_extract_error_message()` in `services/kyc_sandbox.py` pulls Sandbox's `message` / `error` field into the user-facing response on non-200, so `verified:false` carries an actionable reason rather than just `"Sandbox API error (422)"`.
- **Tested** — all 17 KYC + 41 P1 regression tests still pass (58/58). Live curl: `/kyc/status` → `{enabled:true}`, `/pan/verify` with real PAN → 200 with full_name; bad PAN → 422 with Sandbox's "Invalid Pan pattern" message.

  - `POST /aadhaar/otp` — body `{aadhaar_number}`; returns `reference_id` for the OTP flow.
  - `POST /aadhaar/verify` — body `{reference_id, otp, waitlist_id?, retailer_id?}`; persists `aadhaar_verified, aadhaar_last_4, aadhaar_name, aadhaar_dob, aadhaar_address, aadhaar_state, aadhaar_pincode, aadhaar_verified_at`.
  - Admin-only: `GET /summary/{retailer|waitlist}/{id}` — fully composed KYC status (GST + PAN + Aadhaar).
- **Graceful degrade**: `is_configured()` short-circuits when `SANDBOX_API_KEY` / `SANDBOX_API_SECRET` blank (current state). Verify endpoints return 503 "KYC service not configured"; status returns `{enabled:false}` (200) so frontend can show an amber notice.
- **Frontend widget**: reusable `<KYCVerificationCard waitlistId|retailerId admin? />` at `components/KYCVerificationCard.js`. Auto-renders amber "KYC service not yet activated" panel (with sandbox.co.in signup link) when service disabled. Embedded as a per-row chevron-toggle on `/admin/b2b/waitlist`.
- **Tested** — 17 new tests in `tests/test_kyc_sandbox.py` (graceful-degrade paths, format validation, monkey-patched happy-path & HTTP-error path for PAN + Aadhaar OTP + verify, route auth gates). Live URL curl: `/status` ⇒ 200 `{enabled:false}`, `/pan/verify` ⇒ 503, bad PAN ⇒ 422, admin status w/o auth ⇒ 401. Frontend testing-agent (iteration_65): backend 65/65 pass, KYC widget renders amber state correctly. Full B2B suite: **125/125** (17 new + 41 P1 + 67 prior).
- **To flip on**: sign up free at https://app.sandbox.co.in/signup → API Keys → set `SANDBOX_API_KEY` + `SANDBOX_API_SECRET` in `backend/.env`, restart backend. Free tier ~100 calls/month for PAN + Aadhaar.
- **Side fix**: cleaned up duplicate stale lines at bottom of `components/ZohoSyncHealthCard.js` that were causing webpack build errors. Added `data-testid="zoho-sync-health-card"` (root) and renamed Backfill testid to `zoho-backfill-button` per testing-agent feedback.

### P1 Verification Status (Apr 26, 2026)
- ✅ **GA4 cookie consent** — banner appears on public routes, suppressed on `/admin/**` and `/retailer/**`. Verified by testing agent.
- ✅ **Zoho Sync Health card** — renders on `/admin` with live metrics + Connect/Re-auth/Backfill buttons.
- ✅ **Zoho Backfill** — `POST /api/admin/zoho/backfill` working (verified via pytest `test_zoho_health_tour::TestZohoBackfill`). UI confirm dialog uses `window.confirm()` — testing agent's auto-accept didn't catch it but endpoint itself is verified.
- ⏳ **Retailer First-Login Tour** — pytest-verified (`test_zoho_health_tour::TestRetailerTour`); end-to-end browser flow not visually re-verified this iteration. Use B2B test retailer `test_b2b_retailer@example.com / Test@12345` to self-verify on `/retailer/b2b`.

### P2 (Medium)
- [ ] Drop actual `G-XXXXXXXXXX` into `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] Migrator script to move existing Mongo-base64 bills into object storage (new uploads already go there)
- [ ] Further split `b2b_orders.py` calculate/order body (catalog ✅ + email ✅ already extracted)

### Frontend dev workflow note (Apr 26, 2026)
- Next.js runs in production mode (`next start`) under supervisor — code edits do **NOT** hot-reload. After any frontend change, run `cd /app/frontend-next && yarn build && sudo supervisorctl restart frontend` (~95s).

- [ ] Apply title-case rules form-by-form across the remaining surface (helper ready; high-traffic forms done)

### P3 (Low)
- [ ] B2B product catalog in MongoDB
