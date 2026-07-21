-- Fix: new users never get a public.wishlist (user_id -> collection_id) mapping row.
--
-- ensure_default_collections_for_user() creates the wishlist `collections` row
-- (is_wishlist = true) on signup, but it never populated public.wishlist, which is
-- the table wishlist_toggle() reads to resolve a user's wishlist collection. The
-- mapping table was only seeded once, in 20251204080430_wishlist_to_collection.sql,
-- so every user created afterwards hit:
--   'Wishlist collection not found for user %'  (raised by wishlist_toggle)
--
-- This migration:
--   1. Makes ensure_default_collections_for_user() the single source of truth for the
--      mapping -- it now upserts public.wishlist whenever it ensures a wishlist
--      collection (safeguard for all future users, idempotent).
--   2. Backfills every existing auth user via the same function.

create or replace function public.ensure_default_collections_for_user(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_wishlist uuid;
  existing_selling uuid;
  existing_vault uuid;
begin
  if p_user_id is null then
    raise exception 'ensure_default_collections_for_user: user_id is required';
  end if;

  select id
    into existing_wishlist
  from public.collections
  where user_id = p_user_id
    and is_wishlist = true
  limit 1;

  select id
    into existing_selling
  from public.collections
  where user_id = p_user_id
    and coalesce(is_selling, false) = true
  limit 1;

  select id
    into existing_vault
  from public.collections
  where user_id = p_user_id
    and coalesce(is_vault, false) = true
  limit 1;

  if existing_wishlist is null then
    insert into public.collections (
      user_id,
      name,
      visibility,
      is_wishlist,
      description
    )
    values (
      p_user_id,
      'Wishlist',
      'private',
      true,
      'All wishlisted items, prices are updated daily.'
    )
    returning id into existing_wishlist;
  end if;

  -- Keep public.wishlist in sync with the user's wishlist collection. This is the
  -- mapping wishlist_toggle() resolves; without it the RPC raises
  -- 'Wishlist collection not found for user'.
  if existing_wishlist is not null then
    insert into public.wishlist (user_id, collection_id)
    values (p_user_id, existing_wishlist)
    on conflict (user_id) do update
      set collection_id = excluded.collection_id;
  end if;

  if existing_selling is null then
    insert into public.collections (
      user_id,
      name,
      visibility,
      is_selling,
      description
    )
    values (
      p_user_id,
      'Selling',
      'private',
      true,
      'Items from all your storefronts.'
    );
  end if;

  if existing_vault is null then
    insert into public.collections (
      user_id,
      name,
      visibility,
      is_vault,
      description
    )
    values (
      p_user_id,
      'Vault',
      'private',
      true,
      'Items that are closely monitored for prices and are hidden from the public'
    );
  end if;
end;
$$;

-- Backfill: ensure every existing auth user has default collections AND a wishlist
-- mapping row. Idempotent -- users who already have collections only gain the
-- missing public.wishlist row.
do $$
declare
  rec record;
begin
  for rec in select id from auth.users loop
    perform public.ensure_default_collections_for_user(rec.id);
  end loop;
end;
$$;
