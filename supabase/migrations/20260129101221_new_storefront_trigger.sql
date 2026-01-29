-- Mirror storefront collections into selling collections when toggled, and clean up when unset.
-- Also fixes ambiguous is_storefront references by avoiding variable/column name collisions.
-- 1) When a collection's is_storefront is toggled ON/OFF, mirror/remove all its items into/from the user's Selling collection.
create
or replace function public .sync_storefront_collection_to_selling() returns trigger language plpgsql security definer
set
  search_path = public as $$ #variable_conflict use_column
declare
  selling_collection_id uuid;

begin
  -- Marked as storefront: mirror items into selling collection
  if TG_OP = 'UPDATE'
  and NEW .is_storefront is distinct
  from
    OLD .is_storefront
    and coalesce(NEW .is_storefront, false) = true then
  select
    c .id into selling_collection_id
  from
    public .collections c
  where
    c .user_id = NEW .user_id
    and coalesce(c .is_selling, false) = true
  limit
    1;

if selling_collection_id is null then return NEW;

end if;

insert into
  public .collection_items (
    id,
    collection_id,
    collection_ref,
    user_id,
    item_kind,
    ref_id,
    quantity,
    position,
    grading_company,
    variants,
    created_at,
    updated_at,
    grade_condition_id
  )
select
  gen_random_uuid(),
  selling_collection_id,
  ci.collection_id,
  -- back-ref to storefront collection
  ci.user_id,
  ci.item_kind,
  ci.ref_id,
  ci.quantity,
  0,
  ci.grading_company,
  ci.variants,
  now(),
  now(),
  ci.grade_condition_id
from
  public .collection_items ci
where
  ci.collection_id = NEW .id
  and not exists (
    select
      1
    from
      public .collection_items existing
    where
      existing.collection_id = selling_collection_id
      and existing.item_kind = ci.item_kind
      and existing.ref_id = ci.ref_id
      and coalesce(existing.grade_condition_id :: text, '') = coalesce(ci.grade_condition_id :: text, '')
      and coalesce(existing.grading_company, '') = coalesce(ci.grading_company, '')
      and coalesce(existing.variants, '{}' :: text [ ]) = coalesce(ci.variants, '{}' :: text [ ])
  );

-- Unmarked: remove mirrored items
elsif TG_OP = 'UPDATE'
and NEW .is_storefront is distinct
from
  OLD .is_storefront
  and coalesce(NEW .is_storefront, false) = false then
select
  c .id into selling_collection_id
from
  public .collections c
where
  c .user_id = NEW .user_id
  and coalesce(c .is_selling, false) = true
limit
  1;

if selling_collection_id is null then return NEW;

end if;

delete from
  public .collection_items ci
where
  ci.collection_id = selling_collection_id
  and ci.collection_ref = NEW .id;

end if;

return NEW;

end;

$$;

drop trigger if exists trg_storefront_collection_sync on public .collections;

create trigger trg_storefront_collection_sync after
update
  on public .collections for each row execute function public .sync_storefront_collection_to_selling();

-- 2) Per-item sync: when inserting an item into a storefront collection, mirror into selling.
-- FIX: avoid ambiguity by renaming variable and qualifying column (c.is_storefront)
create
or replace function public .sync_storefront_item_to_selling() returns trigger language plpgsql security definer
set
  search_path = public as $$ #variable_conflict use_column
declare
  v_is_storefront boolean := false;

selling_collection_id uuid;

begin
  select
    coalesce(c .is_storefront, false) into v_is_storefront
  from
    public .collections c
  where
    c .id = NEW .collection_id
  limit
    1;

if not v_is_storefront then return NEW;

end if;

-- find the user's selling collection
select
  c2.id into selling_collection_id
from
  public .collections c2
where
  c2.user_id = NEW .user_id
  and coalesce(c2.is_selling, false) = true
limit
  1;

if selling_collection_id is null then return NEW;

end if;

-- avoid duplicates on the same item characteristics
if exists (
  select
    1
  from
    public .collection_items ci
  where
    ci.collection_id = selling_collection_id
    and ci.item_kind = NEW .item_kind
    and ci.ref_id = NEW .ref_id
    and coalesce(ci.grade_condition_id :: text, '') = coalesce(NEW .grade_condition_id :: text, '')
    and coalesce(ci.grading_company, '') = coalesce(NEW .grading_company, '')
    and coalesce(ci.variants, '{}' :: text [ ]) = coalesce(NEW .variants, '{}' :: text [ ])
) then return NEW;

end if;

insert into
  public .collection_items (
    id,
    collection_id,
    collection_ref,
    user_id,
    item_kind,
    ref_id,
    quantity,
    position,
    grading_company,
    variants,
    created_at,
    updated_at,
    grade_condition_id
  )
values
  (
    gen_random_uuid(),
    selling_collection_id,
    NEW .collection_id,
    NEW .user_id,
    NEW .item_kind,
    NEW .ref_id,
    NEW .quantity,
    0,
    NEW .grading_company,
    NEW .variants,
    now(),
    now(),
    NEW .grade_condition_id
  );

return NEW;

end;

$$;

drop trigger if exists trg_storefront_items_to_selling on public .collection_items;

create trigger trg_storefront_items_to_selling after
insert
  on public .collection_items for each row execute function public .sync_storefront_item_to_selling();

-- 3) Per-item cleanup: when deleting an item from a storefront collection, delete the mirrored selling item.
-- FIX: avoid ambiguity by renaming variable and qualifying column (c.is_storefront)
create
or replace function public .sync_storefront_item_remove_from_selling() returns trigger language plpgsql security definer
set
  search_path = public as $$ #variable_conflict use_column
declare
  v_is_storefront boolean := false;

selling_collection_id uuid;

begin
  select
    coalesce(c .is_storefront, false) into v_is_storefront
  from
    public .collections c
  where
    c .id = OLD .collection_id
  limit
    1;

if not v_is_storefront then return OLD;

end if;

select
  c2.id into selling_collection_id
from
  public .collections c2
where
  c2.user_id = OLD .user_id
  and coalesce(c2.is_selling, false) = true
limit
  1;

if selling_collection_id is null then return OLD;

end if;

delete from
  public .collection_items ci
where
  ci.collection_id = selling_collection_id
  and ci.item_kind = OLD .item_kind
  and ci.ref_id = OLD .ref_id
  and coalesce(ci.grade_condition_id :: text, '') = coalesce(OLD .grade_condition_id :: text, '')
  and coalesce(ci.grading_company, '') = coalesce(OLD .grading_company, '')
  and coalesce(ci.variants, '{}' :: text [ ]) = coalesce(OLD .variants, '{}' :: text [ ]);

return OLD;

end;

$$;

drop trigger if exists trg_storefront_items_from_selling on public .collection_items;

create trigger trg_storefront_items_from_selling after
delete
  on public .collection_items for each row execute function public .sync_storefront_item_remove_from_selling();

-- 4) Backfill: ensure existing storefront collections are mirrored into selling collections
insert into
  public .collection_items (
    id,
    collection_id,
    collection_ref,
    user_id,
    item_kind,
    ref_id,
    quantity,
    position,
    grading_company,
    variants,
    created_at,
    updated_at,
    grade_condition_id
  )
select
  gen_random_uuid(),
  s.selling_collection_id,
  sf.id as collection_ref,
  -- storefront collection id
  ci.user_id,
  ci.item_kind,
  ci.ref_id,
  ci.quantity,
  0,
  ci.grading_company,
  ci.variants,
  now(),
  now(),
  ci.grade_condition_id
from
  public .collections sf
  join public .collection_items ci on ci.collection_id = sf.id
  join lateral (
    select
      c2.id as selling_collection_id
    from
      public .collections c2
    where
      c2.user_id = sf.user_id
      and coalesce(c2.is_selling, false) = true
    limit
      1
  ) s on true
where
  coalesce(sf.is_storefront, false) = true
  and not exists (
    select
      1
    from
      public .collection_items existing
    where
      existing.collection_id = s.selling_collection_id
      and existing.item_kind = ci.item_kind
      and existing.ref_id = ci.ref_id
      and coalesce(existing.grade_condition_id :: text, '') = coalesce(ci.grade_condition_id :: text, '')
      and coalesce(existing.grading_company, '') = coalesce(ci.grading_company, '')
      and coalesce(existing.variants, '{}' :: text [ ]) = coalesce(ci.variants, '{}' :: text [ ])
  );