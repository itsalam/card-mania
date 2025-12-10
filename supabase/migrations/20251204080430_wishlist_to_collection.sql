-- Move wishlist rows into collection_items and re-point wishlist to a user's collection

-- 1) Backup existing wishlist rows so we can read after schema changes
create table if not exists public.wishlist_backup_20251204 as
select * from public.wishlist;

-- 2) Drop old triggers tied to the legacy wishlist layout
drop trigger if exists wishlist_fk_check on public.wishlist;
drop trigger if exists wishlist_totals_bump_aiud on public.wishlist;

-- 3) Collections: add is_wishlist flag + index
alter table public.collections
  add column if not exists is_wishlist boolean not null default false;

create index if not exists collections_user_is_wishlist_idx
  on public.collections (user_id, is_wishlist);

-- 4) Create a wishlist collection per user that had wishlist rows (skip if already present)
with distinct_users as (
  select distinct user_id from public.wishlist_backup_20251204
),
existing as (
  select user_id, id as collection_id
  from public.collections
  where is_wishlist = true
),
to_create as (
  select u.user_id
  from distinct_users u
  left join existing e on e.user_id = u.user_id
  where e.collection_id is null
)
insert into public.collections (
  id,
  user_id,
  name,
  description,
  visibility,
  cover_image_url,
  created_at,
  updated_at,
  is_wishlist
)
select
  gen_random_uuid(),
  user_id,
  'Wishlist',
  'Wishlist',
  'private',
  null,
  now(),
  now(),
  true
from to_create;

-- 5) Move wishlist items into collection_items
with wishlist_collections as (
  select user_id, id as collection_id
  from public.collections
  where is_wishlist = true
)
insert into public.collection_items (
  collection_id,
  user_id,
  item_kind,
  ref_id,
  grade_condition_id,
  grading_company,
  position,
  quantity,
  variants,
  created_at,
  updated_at
)
select
  wc.collection_id,
  w.user_id,
  w.kind::public.item_kind,
  w.ref_id,
  null,
  null,
  0,
  1,
  null,
  w.created_at,
  now()
from public.wishlist_backup_20251204 w
join wishlist_collections wc on wc.user_id = w.user_id
on conflict do nothing;

-- 6) Rebuild wishlist table to point at the per-user wishlist collection
drop table if exists public.wishlist cascade;

create table public.wishlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists wishlist_collection_id_idx
  on public.wishlist (collection_id);

-- Seed the new wishlist table from the created collections
insert into public.wishlist (user_id, collection_id)
select user_id, id
from public.collections
where is_wishlist = true
on conflict (user_id) do update set collection_id = excluded.collection_id;

-- 7) Recreate wishlist total bumpers to observe wishlist-backed collection_items
-- Drop old helpers (they referenced the legacy wishlist table)
drop function if exists public._wishlist_totals_bump_on_wishlist cascade;
drop function if exists public._wishlist_totals_bump_on_card_prices cascade;
drop function if exists public._wishlist_row_cost_cents cascade;

-- Re-add minimal cost calculator (metadata is no longer present; default to quantity-based cost = 0)
create or replace function public._wishlist_row_cost_cents(
  p_kind text,
  p_ref_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns int
language sql
stable
as $$
  select 0;
$$;

create or replace function public._wishlist_totals_bump_on_wishlist()
returns trigger
language plpgsql
as $$
declare
  v_user uuid;
  v_before int := 0;
  v_after  int := 0;
  v_delta  int := 0;
begin
  -- only react for rows inside a wishlist collection
  if not exists (
    select 1
    from public.collections c
    where c.id = coalesce(NEW.collection_id, OLD.collection_id)
      and c.is_wishlist = true
  ) then
    if TG_OP = 'DELETE' then
      return OLD;
    else
      return NEW;
    end if;
  end if;

  if TG_OP = 'INSERT' then
    v_user  := NEW.user_id;
    v_after := public._wishlist_row_cost_cents(NEW.item_kind::text, NEW.ref_id, '{}'::jsonb);
  elsif TG_OP = 'DELETE' then
    v_user   := OLD.user_id;
    v_before := public._wishlist_row_cost_cents(OLD.item_kind::text, OLD.ref_id, '{}'::jsonb);
  else -- UPDATE
    v_user   := NEW.user_id;
    v_before := public._wishlist_row_cost_cents(OLD.item_kind::text, OLD.ref_id, '{}'::jsonb);
    v_after  := public._wishlist_row_cost_cents(NEW.item_kind::text, NEW.ref_id, '{}'::jsonb);
  end if;

  v_delta := v_after - v_before;

  if v_delta <> 0 then
    insert into public.wishlist_totals(user_id, total_cents, computed_at)
    values (v_user, v_delta, now())
    on conflict (user_id) do update
      set total_cents = public.wishlist_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

create or replace function public._wishlist_totals_bump_on_card_prices()
returns trigger
language plpgsql
as $$
begin
  -- Only react when grades_prices changes, and only for wishlist collections
  if TG_OP = 'UPDATE' and (NEW.grades_prices is distinct from OLD.grades_prices) then
    update public.wishlist_totals t
    set total_cents = t.total_cents + 0,
        computed_at = now()
    where exists (
      select 1
      from public.collection_items ci
      join public.collections c on c.id = ci.collection_id and c.is_wishlist = true
      where ci.item_kind = 'card'::public.item_kind
        and ci.ref_id = NEW.id
        and ci.user_id = t.user_id
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists wishlist_totals_bump_aiud on public.collection_items;
create trigger wishlist_totals_bump_aiud
after insert or update of item_kind, ref_id or delete
on public.collection_items
for each row execute function public._wishlist_totals_bump_on_wishlist();

drop trigger if exists wishlist_totals_bump_card_prices_au on public.cards;
create trigger wishlist_totals_bump_card_prices_au
after update of grades_prices on public.cards
for each row execute function public._wishlist_totals_bump_on_card_prices();
