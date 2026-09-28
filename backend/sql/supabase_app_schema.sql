-- ============================================================
-- Aarohmm B2B mobile app — Supabase application schema
-- Idempotent. Safe to re-run.
--
-- Identity model: a retailer signs in with Supabase Auth (email OTP).
-- Their auth email is matched against app_retailers.email to resolve
-- the retailer they belong to. Row-Level Security then confines every
-- query to that retailer's own rows — enforced by Postgres, not by
-- app code, so a tampered client still cannot read another shop's data.
-- ============================================================

-- ============================ TABLES ============================

create table if not exists public.app_retailers (
  id             text primary key,
  gstin          text unique,
  business_name  text,
  contact_name   text,
  email          text,
  phone          text,
  city           text,
  state          text,
  tier           text,
  credit_limit   numeric(14,2) default 0,
  is_active      boolean not null default true,
  updated_at     timestamptz not null default now()
);
create index if not exists app_retailers_email_idx on public.app_retailers (lower(email));
create index if not exists app_retailers_gstin_idx on public.app_retailers (gstin);

create table if not exists public.app_products (
  sku                text primary key,
  name               text not null,
  category           text,
  size_label         text,
  pieces_per_carton  integer not null default 12,
  mrp                numeric(12,2),
  b2b_price          numeric(12,2),
  stock_pieces       integer not null default 0,
  image_url          text,
  is_active          boolean not null default true,
  updated_at         timestamptz not null default now()
);

create table if not exists public.app_schemes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  terms        text,
  min_cartons  integer,
  discount_pct numeric(5,2),
  banner_url   text,
  valid_from   date,
  valid_to     date,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table if not exists public.app_brochures (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  file_url     text not null,
  version      text,
  published_at timestamptz default now(),
  is_active    boolean not null default true
);

create table if not exists public.app_orders (
  id             text primary key,
  order_number   text,
  retailer_id    text references public.app_retailers (id) on delete cascade,
  status         text,
  payment_status text,
  subtotal       numeric(14,2),
  gst_amount     numeric(14,2),
  total_amount   numeric(14,2),
  items          jsonb not null default '[]'::jsonb,
  invoice_url    text,
  placed_at      timestamptz,
  fy             text,
  updated_at     timestamptz not null default now()
);
create index if not exists app_orders_retailer_idx on public.app_orders (retailer_id, placed_at desc);
create index if not exists app_orders_fy_idx on public.app_orders (retailer_id, fy);

create table if not exists public.app_grievances (
  id           uuid primary key default gen_random_uuid(),
  retailer_id  text not null references public.app_retailers (id) on delete cascade,
  order_number text,
  category     text not null default 'other',
  subject      text not null,
  message      text not null,
  status       text not null default 'open',
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists app_grievances_retailer_idx
  on public.app_grievances (retailer_id, created_at desc);

create table if not exists public.app_grievance_images (
  id            uuid primary key default gen_random_uuid(),
  grievance_id  uuid not null references public.app_grievances (id) on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists app_grievance_images_g_idx
  on public.app_grievance_images (grievance_id);

-- ============================ HELPERS ============================
-- Created after the tables because `language sql` bodies are validated
-- at creation time.

-- Current retailer, resolved from the signed-in user's JWT email.
create or replace function public.app_current_retailer_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.app_retailers r
  where lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and r.is_active
  limit 1
$$;

-- Indian financial year label (Apr 1 – Mar 31) for a timestamp.
create or replace function public.app_fy(ts timestamptz)
returns text
language sql
immutable
as $$
  select case
    when extract(month from ts) >= 4
      then to_char(ts, 'YYYY') || '-' || to_char((ts + interval '1 year'), 'YY')
    else to_char((ts - interval '1 year'), 'YYYY') || '-' || to_char(ts, 'YY')
  end
$$;

-- ============================ RLS ============================

alter table public.app_retailers        enable row level security;
alter table public.app_products         enable row level security;
alter table public.app_schemes          enable row level security;
alter table public.app_brochures        enable row level security;
alter table public.app_orders           enable row level security;
alter table public.app_grievances       enable row level security;
alter table public.app_grievance_images enable row level security;

-- A retailer may read ONLY their own profile row.
drop policy if exists app_retailers_self_read on public.app_retailers;
create policy app_retailers_self_read on public.app_retailers
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and is_active);

-- Catalogue, schemes and brochures are shared across all signed-in retailers.
drop policy if exists app_products_read on public.app_products;
create policy app_products_read on public.app_products
  for select to authenticated using (is_active);

drop policy if exists app_schemes_read on public.app_schemes;
create policy app_schemes_read on public.app_schemes
  for select to authenticated
  using (
    is_active
    and (valid_from is null or valid_from <= current_date)
    and (valid_to   is null or valid_to   >= current_date)
  );

drop policy if exists app_brochures_read on public.app_brochures;
create policy app_brochures_read on public.app_brochures
  for select to authenticated using (is_active);

-- Orders: strictly the signing-in retailer's own history.
drop policy if exists app_orders_own_read on public.app_orders;
create policy app_orders_own_read on public.app_orders
  for select to authenticated
  using (retailer_id = public.app_current_retailer_id());

-- Grievances: read + raise their own. Edits/replies are admin-side only
-- (service_role bypasses RLS), so a retailer cannot alter a ticket's
-- status or forge an admin reply.
drop policy if exists app_grievances_own_read on public.app_grievances;
create policy app_grievances_own_read on public.app_grievances
  for select to authenticated
  using (retailer_id = public.app_current_retailer_id());

drop policy if exists app_grievances_own_insert on public.app_grievances;
create policy app_grievances_own_insert on public.app_grievances
  for insert to authenticated
  with check (retailer_id = public.app_current_retailer_id());

drop policy if exists app_grievance_images_own_read on public.app_grievance_images;
create policy app_grievance_images_own_read on public.app_grievance_images
  for select to authenticated
  using (exists (
    select 1 from public.app_grievances g
    where g.id = grievance_id
      and g.retailer_id = public.app_current_retailer_id()
  ));

drop policy if exists app_grievance_images_own_insert on public.app_grievance_images;
create policy app_grievance_images_own_insert on public.app_grievance_images
  for insert to authenticated
  with check (exists (
    select 1 from public.app_grievances g
    where g.id = grievance_id
      and g.retailer_id = public.app_current_retailer_id()
  ));

-- ====================== GSTIN → email lookup ======================
-- Called BEFORE sign-in (so it must be callable by anon). Returns only a
-- MASKED email so the endpoint can't be used to harvest retailer contacts.
create or replace function public.app_gstin_lookup(p_gstin text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name  text;
  v_local text;
  v_dom   text;
begin
  select email, coalesce(business_name, contact_name)
    into v_email, v_name
  from public.app_retailers
  where gstin = upper(trim(p_gstin)) and is_active
  limit 1;

  if v_email is null then
    return json_build_object('found', false);
  end if;

  v_local := split_part(v_email, '@', 1);
  v_dom   := split_part(v_email, '@', 2);

  return json_build_object(
    'found', true,
    'business_name', v_name,
    'masked_email',
      case
        when length(v_local) <= 2 then repeat('*', length(v_local))
        else left(v_local, 2) || repeat('*', greatest(length(v_local) - 2, 1))
      end || '@' || v_dom
  );
end
$$;

revoke all on function public.app_gstin_lookup(text) from public;
grant execute on function public.app_gstin_lookup(text) to anon, authenticated;

-- ====================== Storage: grievance uploads ======================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grievance-uploads', 'grievance-uploads', false, 10485760,
  array['image/png','image/jpeg','image/jpg','image/webp','image/heic']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

-- Each retailer may only write/read inside a folder named after their
-- retailer id, e.g. grievance-uploads/RTL_TEST_B2B/<uuid>.jpg
drop policy if exists app_grievance_upload_insert on storage.objects;
create policy app_grievance_upload_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'grievance-uploads'
    and (storage.foldername(name))[1] = public.app_current_retailer_id()
  );

drop policy if exists app_grievance_upload_read on storage.objects;
create policy app_grievance_upload_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'grievance-uploads'
    and (storage.foldername(name))[1] = public.app_current_retailer_id()
  );
