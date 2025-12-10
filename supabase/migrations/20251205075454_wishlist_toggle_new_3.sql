-- Resolve function overload ambiguity for wishlist_toggle by dropping old signatures

-- Remove all existing wishlist_toggle definitions to avoid PostgREST overload conflicts
drop function if exists public.wishlist_toggle(text, uuid);
drop function if exists public.wishlist_toggle(text, uuid, jsonb);
drop function if exists public.wishlist_toggle(text, uuid, uuid);

-- Recreate the single unambiguous signature
create or replace function public.wishlist_toggle(
  p_kind     text,
  p_ref_id   uuid,
  p_grade_cond_id uuid default null
) returns table(is_wishlisted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_collection_id uuid;
  v_grade_cond_id uuid := p_grade_cond_id;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve wishlist collection for this user
  select w.collection_id
  into v_collection_id
  from public.wishlist w
  where w.user_id = v_user;

  if v_collection_id is null then
    raise exception 'Wishlist collection not found for user %', v_user;
  end if;

  -- Try delete first (acts as toggle off)
  delete from public.collection_items
  where collection_id = v_collection_id
    and user_id = v_user
    and item_kind = p_kind::public.item_kind
    and ref_id = p_ref_id
    and (p_grade_cond_id is null or grade_condition_id = p_grade_cond_id);

  if found then
    return query select false as is_wishlisted;
    return;
  end if;

  -- Insert new wishlist row into collection_items
  insert into public.collection_items (
    collection_id,
    user_id,
    item_kind,
    ref_id,
    grade_condition_id,
    quantity,
    position
  ) values (
    v_collection_id,
    v_user,
    p_kind::public.item_kind,
    p_ref_id,
    v_grade_cond_id,
    1,
    0
  );

  return query select true as is_wishlisted;
end;
$$;

grant execute on function public.wishlist_toggle(text, uuid, uuid) to authenticated;
