-- Migrate wishlist_toggle_grade to use wishlist-backed collections/collection_items

drop function if exists public.wishlist_toggle_grade(text, uuid, text, boolean);

create or replace function public.wishlist_toggle_grade(
  p_kind text,
  p_ref_id uuid,
  p_grade text,
  p_delete_when_empty boolean default false
) returns table(grades text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_collection_id uuid;
  v_item_id uuid;
  v_grades text[];
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Find the user's wishlist collection
  select w.collection_id
  into v_collection_id
  from public.wishlist w
  where w.user_id = v_user;

  if v_collection_id is null then
    raise exception 'Wishlist collection not found for user %', v_user;
  end if;

  -- Lock and fetch the existing row (if any)
  select id, array_remove(variants, null) into v_item_id, v_grades
  from public.collection_items
  where collection_id = v_collection_id
    and user_id = v_user
    and item_kind = p_kind::public.item_kind
    and ref_id = p_ref_id
  for update;

  -- If missing, create with this single grade
  if not found then
    insert into public.collection_items (
      collection_id,
      user_id,
      item_kind,
      ref_id,
      variants,
      quantity,
      position
    ) values (
      v_collection_id,
      v_user,
      p_kind::public.item_kind,
      p_ref_id,
      array[p_grade],
      1,
      0
    )
    returning variants into v_grades;

    return query select v_grades;
    return;
  end if;

  -- Toggle grade in variants array
  if v_grades is null then
    v_grades := array[p_grade];
  elsif p_grade = any(v_grades) then
    v_grades := array_remove(v_grades, p_grade);
  else
    v_grades := array_cat(v_grades, array[p_grade]);
  end if;

  -- If empty and delete flag set, remove the row
  if p_delete_when_empty and (v_grades is null or cardinality(v_grades) = 0) then
    delete from public.collection_items where id = v_item_id;
    return query select '{}'::text[];
    return;
  end if;

  -- Persist the toggled variants
  update public.collection_items
  set variants = case when v_grades is null or cardinality(v_grades) = 0 then null else v_grades end
  where id = v_item_id;

  return query select coalesce(v_grades, '{}'::text[]);
end;
$$;

grant execute on function public.wishlist_toggle_grade(text, uuid, text, boolean) to authenticated;
