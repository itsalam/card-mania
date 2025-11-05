ALTER TABLE collections
ADD COLUMN description TEXT,
ADD COLUMN cover_image_url TEXT;

-- fast membership checks
create index if not exists ci_user_ref on collection_items (user_id, ref_id);
create index if not exists ci_collection on collection_items (collection_id);

-- if you often filter by (user_id, collection_id, ref_id) together:
create index if not exists collections_user_created_at
  on collections (user_id, created_at desc);
create index if not exists ci_user_ref_collection
  on collection_items (user_id, ref_id, collection_id);

create or replace function public.collections_with_membership(
  p_user uuid,
  p_card uuid
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
  order by c.created_at desc;
$$;
