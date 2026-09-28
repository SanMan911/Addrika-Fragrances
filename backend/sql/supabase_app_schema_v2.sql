-- ============================================================
-- Aarohmm B2B app — schema additions (iter114)
--   * grievance THREADS (two-way replies, admin close, unread alerts)
--   * brochure entries auto-synced from website product images
--   * razorpay payment intents against orders
-- Idempotent. Safe to re-run.
-- ============================================================

-- ---------------- Grievance threads ----------------
-- Replies from BOTH sides live in one table so the whole conversation reads
-- in order. `author` is 'retailer' | 'admin'.
create table if not exists public.app_grievance_messages (
  id            uuid primary key default gen_random_uuid(),
  grievance_id  uuid not null references public.app_grievances (id) on delete cascade,
  author        text not null check (author in ('retailer', 'admin')),
  author_name   text,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists app_grievance_messages_g_idx
  on public.app_grievance_messages (grievance_id, created_at);

-- Unread markers so each side can badge what the other has said.
alter table public.app_grievances
  add column if not exists unread_for_retailer boolean not null default false;
alter table public.app_grievances
  add column if not exists unread_for_admin boolean not null default true;
alter table public.app_grievances
  add column if not exists last_message_at timestamptz;
alter table public.app_grievances
  add column if not exists closed_at timestamptz;
alter table public.app_grievances
  add column if not exists closed_by text;

alter table public.app_grievance_messages enable row level security;

-- A retailer can read every message on their OWN ticket...
drop policy if exists app_grievance_messages_own_read on public.app_grievance_messages;
create policy app_grievance_messages_own_read on public.app_grievance_messages
  for select to authenticated
  using (exists (
    select 1 from public.app_grievances g
    where g.id = grievance_id
      and g.retailer_id = public.app_current_retailer_id()
  ));

-- ...and may append ONLY as 'retailer', and ONLY while the ticket is open.
-- They cannot forge an 'admin' reply, and cannot reopen a closed ticket by
-- posting to it. Admin writes go through the backend (service-side, RLS-exempt).
drop policy if exists app_grievance_messages_own_insert on public.app_grievance_messages;
create policy app_grievance_messages_own_insert on public.app_grievance_messages
  for insert to authenticated
  with check (
    author = 'retailer'
    and exists (
      select 1 from public.app_grievances g
      where g.id = grievance_id
        and g.retailer_id = public.app_current_retailer_id()
        and g.status <> 'closed'
    )
  );

-- ---------------- Brochure entries ----------------
-- One row per product, auto-synced from the website catalogue: the same
-- image the storefront shows plus a short fragrance/product note.
create table if not exists public.app_brochure_items (
  sku          text primary key,
  name         text not null,
  category     text,
  size_label   text,
  image_url    text,
  detail       text,
  notes        text,
  mrp          numeric(12,2),
  b2b_price    numeric(12,2),
  sort_order   integer not null default 100,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.app_brochure_items enable row level security;

drop policy if exists app_brochure_items_read on public.app_brochure_items;
create policy app_brochure_items_read on public.app_brochure_items
  for select to authenticated using (is_active);

-- ---------------- Payments ----------------
create table if not exists public.app_payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         text not null,
  retailer_id      text not null references public.app_retailers (id) on delete cascade,
  provider         text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount           numeric(14,2) not null,
  currency         text not null default 'INR',
  status           text not null default 'created',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists app_payments_order_idx on public.app_payments (order_id);
create index if not exists app_payments_retailer_idx on public.app_payments (retailer_id, created_at desc);

alter table public.app_payments enable row level security;

-- Read-only to the owning retailer; every write happens server-side after
-- signature verification, so a client can never mark its own order paid.
drop policy if exists app_payments_own_read on public.app_payments;
create policy app_payments_own_read on public.app_payments
  for select to authenticated
  using (retailer_id = public.app_current_retailer_id());
