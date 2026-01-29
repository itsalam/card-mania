-- Fix ensure_default_collections_for_user to use proper string literals and schema qualification
-- Also grant migration role access and backfill defaults for all existing users.

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
    );
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

-- Make sure the migration role can call the functions.
grant execute on function public.ensure_default_collections_for_user(uuid) to supabase_admin;
grant execute on function public.ensure_default_collections() to supabase_admin;

-- Backfill defaults for all existing users.
do $$
declare
  rec record;
begin
  for rec in select id from auth.users loop
    perform public.ensure_default_collections_for_user(rec.id);
  end loop;
end;
$$;
