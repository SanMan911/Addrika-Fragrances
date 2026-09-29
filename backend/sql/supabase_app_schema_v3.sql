-- ============================================================
-- Aarohmm — scheme auto-pricing + PineLabs payments (iter115)
-- Idempotent. Safe to re-run.
-- ============================================================

-- ---------------- Scheme scoping / auto-pricing rules ----------------
-- `min_boxes` is the authoritative threshold used by the pricing engine and
-- is measured in BOXES — the same unit the retailer types on the order pad.
-- (The older `min_cartons` column is display-only and is NOT used for
-- pricing; mixing the two units would silently mis-trigger schemes.)
alter table public.app_schemes
  add column if not exists min_boxes numeric(10,2);
alter table public.app_schemes
  add column if not exists min_order_value numeric(14,2);
alter table public.app_schemes
  add column if not exists max_discount_inr numeric(14,2);

-- 'all' | 'category' | 'sku'
alter table public.app_schemes
  add column if not exists applies_to text not null default 'all';
alter table public.app_schemes
  add column if not exists categories text[] not null default '{}';
alter table public.app_schemes
  add column if not exists skus text[] not null default '{}';

-- Highest priority wins when several schemes qualify (ties broken by the
-- larger discount). Schemes are NOT stacked — exactly one applies.
alter table public.app_schemes
  add column if not exists priority integer not null default 100;

alter table public.app_schemes
  drop constraint if exists app_schemes_applies_to_check;
alter table public.app_schemes
  add constraint app_schemes_applies_to_check
  check (applies_to in ('all', 'category', 'sku'));

-- ---------------- PineLabs payments ----------------
-- app_payments already carries provider/status; PineLabs reuses it.
alter table public.app_payments
  drop constraint if exists app_payments_provider_check;
alter table public.app_payments
  add constraint app_payments_provider_check
  check (provider in ('razorpay', 'pinelabs'));
