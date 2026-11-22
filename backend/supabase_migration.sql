-- =========================================================================
-- Aarohmm Pad — one-time migration. Run this ONCE in Supabase SQL Editor.
-- Dashboard → SQL Editor → New query → paste → Run.
-- =========================================================================

-- pad_users: profile row for every signed-up user (retailer / distributor / admin)
create table if not exists public.pad_users (
    id uuid primary key references auth.users(id) on delete cascade,
    gstin text not null unique,
    email text,
    name text not null,
    business_name text,
    phone text,
    role text not null check (role in ('retailer','distributor','admin')),
    assigned_distributor_id uuid references public.pad_users(id) on delete set null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists pad_users_role_idx on public.pad_users(role);
create index if not exists pad_users_assigned_distributor_idx on public.pad_users(assigned_distributor_id);
create index if not exists pad_users_gstin_idx on public.pad_users(gstin);

-- pad_orders: every order punched by a retailer or distributor
create table if not exists public.pad_orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    placed_by_id uuid not null references public.pad_users(id) on delete restrict,
    placed_by_role text not null check (placed_by_role in ('retailer','distributor')),
    distributor_id uuid references public.pad_users(id) on delete set null,
    items jsonb not null default '[]'::jsonb,
    subtotal numeric(12,2) not null default 0,
    gst_amount numeric(12,2) not null default 0,
    total_amount numeric(12,2) not null default 0,
    status text not null default 'placed' check (status in ('placed','confirmed','dispatched','delivered','cancelled')),
    notes text,
    -- Payment-ready (not used now, future-proof)
    payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
    payment_provider text,
    payment_reference text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists pad_orders_placed_by_idx on public.pad_orders(placed_by_id);
create index if not exists pad_orders_distributor_idx on public.pad_orders(distributor_id);
create index if not exists pad_orders_status_idx on public.pad_orders(status);
create index if not exists pad_orders_created_at_idx on public.pad_orders(created_at desc);

-- Row-level security: backend uses service_role which bypasses RLS, so we enable
-- RLS as a safety net and add no permissive policies (clients cannot touch it).
alter table public.pad_users enable row level security;
alter table public.pad_orders enable row level security;
