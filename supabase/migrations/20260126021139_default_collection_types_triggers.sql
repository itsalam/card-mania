-- Ensure each user has default collections for wishlist, selling, and vault
create
or replace function public .ensure_default_collections_for_user(p_user_id uuid) returns void language plpgsql security definer
set
  search_path = public as $$
declare
  existing_wishlist uuid;

existing_selling uuid;

existing_vault uuid;

begin
  if p_user_id is null then raise
  exception
    'ensure_default_collections_for_user: user_id is required';

end if;

select
  id into existing_wishlist
from
  public .collections
where
  user_id = p_user_id
  and is_wishlist = true
limit
  1;

select
  id into existing_selling
from
  public .collections
where
  user_id = p_user_id
  and coalesce(is_selling, false) = true
limit
  1;

select
  id into existing_vault
from
  public .collections
where
  user_id = p_user_id
  and coalesce(is_vault, false) = true
limit
  1;

if existing_wishlist is null then
insert into
  public .collections (
    user_id,
    name,
    visibility,
    is_wishlist,
    description
  )
values
  (
    p_user_id,
    'Wishlist',
    'private',
    true,
    'All wishlisted items, prices are updated daily.'
  );

end if;

if existing_selling is null then
insert into
  public .collections (
    user_id,
    name,
    visibility,
    is_selling,
    description
  )
values
  (
    p_user_id,
    'Selling',
    'private',
    true,
    'Items from all your storefronts.'
  );

end if;

if existing_vault is null then
insert into
  public .collections (user_id, name, visibility, is_vault, description)
values
  (
    p_user_id,
    'Vault',
    'private',
    true,
    'Items that are closely monitored for prices and are hidden from the public'
  );

end if;

end;

$$;

create
or replace function public .ensure_default_collections() returns void language plpgsql security definer
set
  search_path = public as $$
declare
  current_user_id uuid;

begin
  -- require authenticated user
  if session_user = 'authenticator' then
  select
    auth.uid() into current_user_id;

else current_user_id := session_user :: uuid;

end if;

if current_user_id is null then raise
exception
  'ensure_default_collections: no authenticated user';

end if;

perform public .ensure_default_collections_for_user(current_user_id);

end;

$$;

grant execute on function public .ensure_default_collections() to authenticated;

grant execute on function public .ensure_default_collections_for_user(uuid) to authenticated;

-- Trigger function: when a collection is marked storefront, mirror its items into the user's is_selling collection
create
or replace function public .sync_storefront_item_to_selling() returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  is_storefront boolean := false;

selling_collection_id uuid;

begin
  select
    coalesce(is_storefront, false) into is_storefront
  from
    public .collections
  where
    id = new .collection_id
  limit
    1;

if not is_storefront then return new;

end if;

-- find the user's selling collection
select
  id into selling_collection_id
from
  public .collections
where
  user_id = new .user_id
  and coalesce(is_selling, false) = true
limit
  1;

if selling_collection_id is null then -- no selling collection to sync into
return new;

end if;

-- avoid duplicates on the same item characteristics
if exists (
  select
    1
  from
    public .collection_items ci
  where
    ci.collection_id = selling_collection_id
    and ci.item_kind = new .item_kind
    and ci.ref_id = new .ref_id
    and coalesce(ci.grade_condition_id :: text, '') = coalesce(new .grade_condition_id :: text, '')
    and coalesce(ci.grading_company, '') = coalesce(new .grading_company, '')
    and coalesce(ci.variants, '{}' :: text [ ]) = coalesce(new .variants, '{}' :: text [ ])
) then return new;

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
    new .collection_id,
    new .user_id,
    new .item_kind,
    new .ref_id,
    new .quantity,
    0,
    new .grading_company,
    new .variants,
    now(),
    now(),
    new .grade_condition_id
  );

return new;

end;

$$;

drop trigger if exists trg_storefront_items_to_selling on public .collection_items;

create trigger trg_storefront_items_to_selling after
insert
  on public .collection_items for each row execute function public .sync_storefront_item_to_selling();

-- Trigger function to remove mirrored selling items when storefront item is deleted
create
or replace function public .sync_storefront_item_remove_from_selling() returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  is_storefront boolean := false;

selling_collection_id uuid;

begin
  select
    coalesce(is_storefront, false) into is_storefront
  from
    public .collections
  where
    id = old .collection_id
  limit
    1;

if not is_storefront then return old;

end if;

select
  id into selling_collection_id
from
  public .collections
where
  user_id = old .user_id
  and coalesce(is_selling, false) = true
limit
  1;

if selling_collection_id is null then return old;

end if;

delete from
  public .collection_items ci
where
  ci.collection_id = selling_collection_id
  and ci.item_kind = old .item_kind
  and ci.ref_id = old .ref_id
  and coalesce(ci.grade_condition_id :: text, '') = coalesce(old .grade_condition_id :: text, '')
  and coalesce(ci.grading_company, '') = coalesce(old .grading_company, '')
  and coalesce(ci.variants, '{}' :: text [ ]) = coalesce(old .variants, '{}' :: text [ ]);

return old;

end;

$$;

drop trigger if exists trg_storefront_items_from_selling on public .collection_items;

create trigger trg_storefront_items_from_selling after
delete
  on public .collection_items for each row execute function public .sync_storefront_item_remove_from_selling();

-- Trigger function to sync updates from selling mirror back to source collection
create
or replace function public .sync_selling_item_update_to_source() returns trigger language plpgsql security definer
set
  search_path = public as $$ begin
    -- only process updates originating from selling collections
    if not exists (
      select
        1
      from
        public .collections c
      where
        c .id = new .collection_id
        and coalesce(c .is_selling, false) = true
    ) then return new;

end if;

if new .collection_ref is null then return new;

end if;

update
  public .collection_items ci
set
  quantity = new .quantity,
  grading_company = new .grading_company,
  variants = new .variants,
  grade_condition_id = new .grade_condition_id,
  updated_at = now()
where
  ci.collection_id = new .collection_ref
  and ci.item_kind = old .item_kind
  and ci.ref_id = old .ref_id
  and coalesce(ci.grade_condition_id :: text, '') = coalesce(old .grade_condition_id :: text, '')
  and coalesce(ci.grading_company, '') = coalesce(old .grading_company, '')
  and coalesce(ci.variants, '{}' :: text [ ]) = coalesce(old .variants, '{}' :: text [ ]);

return new;

end;

$$;

drop trigger if exists trg_selling_items_update_source on public .collection_items;

create trigger trg_selling_items_update_source after
update
  on public .collection_items for each row execute function public .sync_selling_item_update_to_source();

-- Trigger to ensure defaults when a new profile/user is created
create
or replace function public .trg_profiles_ensure_defaults() returns trigger language plpgsql security definer
set
  search_path = public as $$ begin
    perform public .ensure_default_collections_for_user(new .id);

return new;

end;

$$;

drop trigger if exists trg_profiles_defaults on public .profiles;

create trigger trg_profiles_defaults after
insert
  on public .profiles for each row execute function public .trg_profiles_ensure_defaults();