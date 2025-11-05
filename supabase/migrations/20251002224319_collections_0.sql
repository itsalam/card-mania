create extension if not exists pgcrypto; -- for gen_random_uuid()

--Collections and Collection Items -------------------------
drop table if exists public.collections cascade;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  visibility text not null default 'private', -- private | unlisted | public (authoring view only)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on public.collections (user_id, lower(name));

create type public.item_kind as enum ('card'); -- extend later

drop table if exists public.collection_items cascade;
create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id       uuid not null,  -- denormalized for RLS
  item_kind     public.item_kind not null default 'card',
  ref_id        uuid not null,           -- cards.id when kind='card'
  grade         text not null default 'ungraded',
  condition     text,                    -- nullable by design
  condition_key text generated always as (coalesce(condition, '')) stored,
  quantity      int  not null check (quantity > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (collection_id, item_kind, ref_id, grade, condition_key)
);

create index ci_by_collection on public.collection_items (collection_id);
create index ci_by_user_ref on public.collection_items (user_id, ref_id);
create index ci_by_user_kind_grade on public.collection_items (user_id, item_kind, grade);

-- Optional hot stats (trigger-maintained)
create table public.collection_stats (
  collection_id uuid primary key references public.collections(id) on delete cascade,
  item_count int not null default 0,
  last_item_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Public Snapspots -------------------------

create table public.public_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_collection_id uuid references public.collections(id) on delete set null,
  slug text not null,              -- stable public id (e.g., ULID/KSUID/slug)
  title text not null,
  status text not null default 'active',  -- active | archived | sold_out
  version int not null default 1,         -- bump on republish
  total_items int not null default 0,
  total_est_value numeric,                -- optional precomputed
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index on public.public_snapshots (slug);
create index on public.public_snapshots (owner_user_id, published_at desc);

create unique index on public.public_snapshots (slug);
create index on public.public_snapshots (owner_user_id, published_at desc);

create table public.public_snapshot_items (
  snapshot_id uuid not null references public.public_snapshots(id) on delete cascade,
  item_kind public.item_kind not null,
  ref_id uuid not null,           -- cards.id
  grade text default 'ungraded',
  condition text,
  condition_key text generated always as (coalesce(condition, '')) stored,
  quantity int not null check (quantity > 0),
  unit_price numeric,             -- optional ask price; can be null for offers
  display jsonb,                  -- denormalized fields (name, set, image url, last_price)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (snapshot_id, item_kind, ref_id, grade, condition_key)
);

create index psi_by_ref on public.public_snapshot_items (ref_id);
create index psi_by_snapshot on public.public_snapshot_items (snapshot_id);
create index psi_by_user_kind_grade on public.collection_items (user_id, item_kind, grade);

-- Selling and inventory -------------------------

-- A listing binds price/terms to a snapshot (or subset).
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.public_snapshots(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active',  -- active | paused | closed
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- Items for sale (default to snapshot qty, but can limit)
create table public.listing_items (
  listing_id uuid not null references public.listings(id) on delete cascade,
  item_kind public.item_kind not null,
  ref_id uuid not null,
  grade text default 'ungraded',
  condition text,
  condition_key text generated always as (coalesce(condition, '')) stored,
  ask_unit_price numeric not null,
  max_available int not null check (max_available >= 0), -- cap <= snapshot qty
  primary key (listing_id, item_kind, ref_id, grade, condition_key)
);

-- Short-lived holds while buyer is checking out
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_user_id uuid,
  item_kind public.item_kind not null,
  ref_id uuid not null,
  grade text default 'ungraded',
  condition text,
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index on public.reservations (listing_id, expires_at);

-- Confirmed purchases
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_user_id uuid,
  status text not null default 'paid', -- paid | cancelled | refunded
  created_at timestamptz not null default now()
);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  item_kind public.item_kind not null,
  ref_id uuid not null,
  grade text default 'ungraded',
  condition text,
  condition_key text generated always as (coalesce(condition, '')) stored,
  quantity int not null check (quantity > 0),
  unit_price numeric not null,
  primary key (order_id, item_kind, ref_id, grade, condition_key)
);

-- RLS + policies -------------------------

-- Roles: Supabase creates these:
--   authenticated, anon, service_role
-- We'll rely on them and RLS.

----------------------------
-- PRIVATE AUTHORING TABLES
----------------------------

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.collection_stats enable row level security;

-- Ownership policies (owner can do everything on their own rows)
drop policy if exists collections_owner_all on public.collections;
create policy collections_owner_all
on public.collections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists collection_items_owner_all on public.collection_items;
create policy collection_items_owner_all
on public.collection_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Stats: readable by owner only; write protected (only triggers or SECURITY DEFINER fns)
drop policy if exists collection_stats_owner_select on public.collection_stats;
create policy collection_stats_owner_select
on public.collection_stats
for select
using (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
);

-- Optional: shared members (comment out if you don't want sharing yet)
-- create table public.collection_members (
--   collection_id uuid references public.collections(id) on delete cascade,
--   user_id uuid not null,
--   role text not null check (role in ('viewer','editor')),
--   primary key (collection_id, user_id)
-- );
-- alter table public.collection_members enable row level security;
-- create policy cmember_self on public.collection_members
-- for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy collections_member_read on public.collections
-- for select using (
--   exists (select 1 from public.collection_members m where m.collection_id = id and m.user_id = auth.uid())
-- );
-- create policy citems_member_access on public.collection_items
-- for select using (
--   exists (select 1 from public.collection_members m where m.collection_id = collection_id and m.user_id = auth.uid())
-- );

-- Least-privileged GRANTs (rely on RLS to filter)
revoke all on public.collections from anon, authenticated;
grant select, insert, update, delete on public.collections to authenticated;

revoke all on public.collection_items from anon, authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;

revoke all on public.collection_stats from anon, authenticated;
grant select on public.collection_stats to authenticated;  -- writes via triggers/functions only

-- If you want to harden: forbid direct writes to stats
revoke insert, update, delete on public.collection_stats from authenticated;

---------------------------------
-- PUBLIC PROJECTION (READ-ONLY)
---------------------------------

alter table public.public_snapshots enable row level security;
alter table public.public_snapshot_items enable row level security;

-- Public read for everyone:
drop policy if exists public_snapshots_read on public.public_snapshots;
create policy public_snapshots_read
on public.public_snapshots
for select
using (true);

drop policy if exists public_snapshot_items_read on public.public_snapshot_items;
create policy public_snapshot_items_read
on public.public_snapshot_items
for select
using (true);

-- No public writes: do NOT grant insert/update/delete to anon/authenticated
revoke all on public.public_snapshots from anon, authenticated;
grant select on public.public_snapshots to anon, authenticated;

revoke all on public.public_snapshot_items from anon, authenticated;
grant select on public.public_snapshot_items to anon, authenticated;

-- Writes occur via SECURITY DEFINER functions or service role only.


-- SQL Helpers ----------------------

-- Ensure function owner is a privileged role (e.g., postgres)
-- and set a safe search_path.
create or replace function public.publish_snapshot(
  p_owner uuid,
  p_collection_id uuid,
  p_slug text,
  p_title text,
  p_subset jsonb default null  -- optional: [{ref_id, grade, condition, quantity}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_is_owner boolean;
begin
  -- Ownership check against collections
  select exists (
    select 1 from public.collections c
    where c.id = p_collection_id and c.user_id = p_owner
  )
  into v_is_owner;

  if not v_is_owner then
    raise exception 'not_owner' using detail = 'Caller does not own the collection';
  end if;

  -- Create snapshot header
  insert into public.public_snapshots (owner_user_id, source_collection_id, slug, title)
  values (p_owner, p_collection_id, p_slug, p_title)
  returning id into v_snapshot_id;

  -- Build chosen set
  if p_subset is null then
    -- entire collection
    insert into public.public_snapshot_items (snapshot_id, item_kind, ref_id, grade, condition, quantity, display)
    select v_snapshot_id, ci.item_kind, ci.ref_id, ci.grade, ci.condition, ci.quantity,
      jsonb_build_object(
        'name', c.name,
        'set', c.set_name,
        'year', c.release_year,
        'image', c.image_url,
        'latest_price', pc.latest_price
      )
    from public.collection_items ci
    join public.cards c on c.id = ci.ref_id
    left join public.price_cache pc on pc.card_id = ci.ref_id
    where ci.collection_id = p_collection_id and ci.user_id = p_owner;
  else
    -- subset explicit rows
    insert into public.public_snapshot_items (snapshot_id, item_kind, ref_id, grade, condition, quantity, display)
    select v_snapshot_id, 'card'::public.item_kind, (x->>'ref_id')::uuid,
           coalesce(x->>'grade','ungraded'), nullif(x->>'condition',''),
           greatest(1, coalesce((x->>'quantity')::int, 1)),
           jsonb_build_object(
             'name', c.name,
             'set', c.set_name,
             'year', c.release_year,
             'image', c.image_url,
             'latest_price', pc.latest_price
           )
    from jsonb_array_elements(p_subset) as x
    join public.cards c on c.id = (x->>'ref_id')::uuid
    left join public.price_cache pc on pc.card_id = c.id;
  end if;

  -- Update header aggregates
  update public.public_snapshots s
     set total_items = coalesce((
           select sum(quantity) from public.public_snapshot_items psi
           where psi.snapshot_id = s.id
         ),0)
   where s.id = v_snapshot_id;

  return v_snapshot_id;
end;
$$;

grant execute on function public.publish_snapshot(uuid, uuid, text, text, jsonb) to authenticated;


-- Bulk upsert items (authoring)
create or replace function public.upsert_collection_items(
  p_owner uuid,
  p_collection_id uuid,
  p_items jsonb  -- [{ref_id, grade?, condition?, quantity_delta}]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
  x jsonb;
  v_ref uuid;
  v_grade text;
  v_condition text;
  v_delta int;
begin
  select exists (
    select 1 from public.collections c
    where c.id = p_collection_id and c.user_id = p_owner
  ) into v_is_owner;

  if not v_is_owner then
    raise exception 'not_owner';
  end if;

  for x in select * from jsonb_array_elements(p_items)
  loop
    v_ref := (x->>'ref_id')::uuid;
    v_grade := coalesce(x->>'grade','ungraded');
    v_condition := nullif(x->>'condition','');
    v_delta := coalesce((x->>'quantity_delta')::int, 0);

    if v_delta = 0 then
      continue;
    end if;

    -- Upsert (quantity += delta), delete if falls to 0
    insert into public.collection_items (collection_id, user_id, item_kind, ref_id, grade, condition, quantity)
    values (p_collection_id, p_owner, 'card', v_ref, v_grade, v_condition, greatest(1, v_delta))
    on conflict (collection_id, item_kind, ref_id, grade, coalesce(condition,''))
    do update set quantity = public.collection_items.quantity + v_delta,
                  updated_at = now();

    -- Remove zero/negative rows (guard)
    delete from public.collection_items
    where collection_id = p_collection_id
      and user_id = p_owner
      and item_kind = 'card'
      and ref_id = v_ref
      and grade = v_grade
      and coalesce(condition,'') = coalesce(v_condition,'')
      and quantity <= 0;
  end loop;
end;
$$;

grant execute on function public.upsert_collection_items(uuid, uuid, jsonb) to authenticated;
