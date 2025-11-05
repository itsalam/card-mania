create or replace function public.collections_with_membership(
  p_user uuid,
  p_card uuid,
  p_query text default null
) returns table (
  id uuid,
  user_id uuid,
  name text,
  description text,
  visibility text,
  cover_image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  has_item boolean
)
language sql
security definer
as $$
  select
    c.id, c.user_id, c.name, c.description, c.visibility,
    c.cover_image_url, c.created_at, c.updated_at,
    exists (
      select 1
      from collection_items ci
      where ci.collection_id = c.id
        and ci.user_id = p_user
        and ci.ref_id = p_card
    ) as has_item
  from collections c
  where c.user_id = p_user
    and (
      p_query is null or
      c.name ilike '%' || p_query || '%' or
      c.description ilike '%' || p_query || '%'
    )
  order by c.created_at desc;
$$;
