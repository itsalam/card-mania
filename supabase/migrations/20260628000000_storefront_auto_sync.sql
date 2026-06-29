-- ITS-31 / marketplace fix: auto-sync storefronts table from collections.is_storefront
--
-- Problem: storefronts table was empty — get_featured_listings() always returned zero rows
-- because it joins through storefronts. Collections marked is_storefront=true had no
-- corresponding storefront row, so nothing appeared in the marketplace tab.
--
-- Fix:
--   1. Unique constraint — one storefront row per user (enforces the upsert target).
--   2. Trigger on collections UPDATE — creates/updates the storefront row when
--      is_storefront toggles, so the tables stay in sync without manual intervention.
--   3. Backfill — creates storefront rows for the existing is_storefront=true collections.

-- ============================================================
-- 1. Unique constraint on storefronts.user_id
-- ============================================================
alter table public.storefronts
  add constraint storefronts_user_id_unique unique (user_id);

-- ============================================================
-- 2. Trigger function: sync storefronts row on is_storefront change
-- ============================================================
create or replace function public.sync_collection_to_storefront()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when is_storefront actually changes
  if new.is_storefront is not distinct from old.is_storefront then
    return new;
  end if;

  if coalesce(new.is_storefront, false) then
    -- Collection became a storefront: upsert the user's storefront row and add this collection.
    insert into public.storefronts (user_id, collection_ids, is_listed, listed_at)
    values (new.user_id, array[new.id], true, now())
    on conflict (user_id) do update
      set collection_ids = (
            select array_agg(distinct col_id)
            from unnest(storefronts.collection_ids || array[new.id]) as col_id
          ),
          is_listed  = true,
          listed_at  = coalesce(storefronts.listed_at, now()),
          updated_at = now();
  else
    -- Collection is no longer a storefront: remove it from the user's collection_ids.
    update public.storefronts
      set collection_ids = array_remove(collection_ids, new.id),
          updated_at     = now()
    where user_id = new.user_id;

    -- If no storefront collections remain, un-list the storefront.
    update public.storefronts
      set is_listed  = false,
          updated_at = now()
    where user_id = new.user_id
      and cardinality(collection_ids) = 0;
  end if;

  return new;
end;
$$;

create trigger trg_sync_collection_to_storefront
  after update of is_storefront on public.collections
  for each row
  execute function public.sync_collection_to_storefront();

-- ============================================================
-- 3. Backfill: create storefront rows for existing is_storefront=true collections
-- ============================================================
insert into public.storefronts (user_id, collection_ids, is_listed, listed_at)
select
  c.user_id,
  array_agg(c.id) as collection_ids,
  true             as is_listed,
  now()            as listed_at
from public.collections c
where coalesce(c.is_storefront, false) = true
  and coalesce(c.visibility, 'private') = 'public'
group by c.user_id
on conflict (user_id) do update
  set collection_ids = excluded.collection_ids,
      is_listed      = true,
      listed_at      = coalesce(storefronts.listed_at, excluded.listed_at),
      updated_at     = now();
