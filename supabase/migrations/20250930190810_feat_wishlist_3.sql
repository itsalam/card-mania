-- Toggle wishlist item (add if not exists, remove if exists), with optional metadata
create or replace function public.wishlist_toggle(
  p_kind     text,
  p_ref_id   uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns table(is_wishlisted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_meta   jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_grades jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Try to delete first (acts as "if exists → remove")
  delete from public.wishlist 
  where user_id = v_user
    and kind    = p_kind
    and ref_id  = p_ref_id;

  if found then
    return query select false; -- now NOT wishlisted
    return;
  end if;

  -- Normalize metadata.grades -> unique, sorted text array (if provided)
  select coalesce(
           jsonb_agg(distinct g order by g),
           '[]'::jsonb
         )
    into v_grades
    from jsonb_array_elements_text(coalesce(v_meta->'grades', '[]'::jsonb)) as t(g);

  v_meta := jsonb_set('{}'::jsonb, '{grades}', v_grades, true);

  -- Insert with metadata
  insert into public.wishlist (user_id, kind, ref_id, metadata)
  values (v_user, p_kind, p_ref_id, v_meta)
  on conflict do nothing;

  return query select true; -- now wishlisted
end;
$$;

grant execute on function public.wishlist_toggle(text, uuid, jsonb) to authenticated;

-- Toggle a single grade inside metadata.grades for a wishlist row
create or replace function public.wishlist_toggle_grade(
  p_kind text,
  p_ref_id uuid,
  p_grade text,
  p_delete_when_empty boolean default false
)
returns table(grades text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
  v_old jsonb;
  v_new jsonb;
  v_arr jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure row exists; if not, create with this one grade
  select true, metadata into v_exists, v_old
  from public.wishlist
  where user_id = v_user and kind = p_kind and ref_id = p_ref_id
  for update;

  if not found then
    v_arr := jsonb_build_array(p_grade);
    v_new := jsonb_build_object('grades', v_arr);

    insert into public.wishlist(user_id, kind, ref_id, metadata)
    values (v_user, p_kind, p_ref_id, v_new);

    return query
      select array[p_grade]::text[];
    return;
  end if;

  -- Row exists: build toggled grades array
  with current as (
    select coalesce(jsonb_array_elements_text(coalesce(v_old->'grades','[]'::jsonb)), null) as g
  ),
  toggled as (
    -- if p_grade present -> remove; else add
    select case when exists(select 1 from current where g = p_grade)
                then (select jsonb_agg(x order by x)
                      from (select g as x from current where g <> p_grade) s)
                else (select jsonb_agg(x order by x)
                      from (
                        select g as x from current where g is not null
                        union all
                        select p_grade
                      ) s)
           end as grades_json
  )
  select coalesce(grades_json, '[]'::jsonb) into v_arr from toggled;

  -- If empty and configured, delete the row; triggers will fix totals
  if p_delete_when_empty and jsonb_array_length(v_arr) = 0 then
    delete from public.wishlist
    where user_id = v_user and kind = p_kind and ref_id = p_ref_id;
    return query select '{}'::text[]; -- empty
    return;
  end if;

  -- Save metadata with normalized grades
  v_new := jsonb_set(coalesce(v_old, '{}'::jsonb), '{grades}', v_arr, true);

  update public.wishlist
     set metadata = v_new
   where user_id = v_user and kind = p_kind and ref_id = p_ref_id;

  return query
    select coalesce(array_agg(x), '{}'::text[])
    from jsonb_array_elements_text(v_arr) as t(x);
end;
$$;

grant execute on function public.wishlist_toggle_grade(text, uuid, text, boolean) to authenticated;

create or replace function public.wishlist_set_grades(
  p_kind text,
  p_ref_id uuid,
  p_grades text[],
  p_delete_when_empty boolean default false
)
returns table(grades text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_arr jsonb;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  -- normalize: dedupe + sort
  select coalesce(jsonb_agg(distinct g order by g), '[]'::jsonb)
    into v_arr
  from unnest(coalesce(p_grades, '{}')) as t(g);

  if p_delete_when_empty and jsonb_array_length(v_arr) = 0 then
    delete from public.wishlist
    where user_id = v_user and kind = p_kind and ref_id = p_ref_id;
    return query select '{}'::text[];
    return;
  end if;

  insert into public.wishlist(user_id, kind, ref_id, metadata)
  values (v_user, p_kind, p_ref_id, jsonb_build_object('grades', v_arr))
  on conflict (user_id, kind, ref_id) do update
    set metadata = jsonb_set(coalesce(public.wishlist.metadata, '{}'::jsonb), '{grades}', v_arr, true);

  return query
    select coalesce(array_agg(x), '{}'::text[])
    from jsonb_array_elements_text(v_arr) as t(x);
end;
$$;

grant execute on function public.wishlist_set_grades(text, uuid, text[], boolean) to authenticated;
