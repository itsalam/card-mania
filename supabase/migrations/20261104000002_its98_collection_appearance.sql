-- ITS-98: per-collection appearance — icon, accent color, background image.
--
-- Plain columns on public.collections rather than a side table: they're 1:1 with the row,
-- read everywhere a collection is (select('*'), the membership RPCs, collections_with_tags),
-- and covered by the existing collections RLS for free.
--
--   icon_key            a key from the client's curated icon set (components/collections/appearance.ts);
--                       unknown keys fall back to the default icon client-side, so the set can grow
--                       without a migration.
--   accent_color        a palette key, not a hex value — the client maps it to a theme palette
--                       color, so it stays consistent with light/dark mode.
--   background_image_id image_cache row for a user-uploaded background (same upload path as
--                       collection item photos: images bucket, user-uploads/{uid}/...).

alter table public.collections
  add column if not exists icon_key text,
  add column if not exists accent_color text,
  add column if not exists background_image_id uuid references public.image_cache (id) on delete set null;

alter table public.collections
  drop constraint if exists collections_icon_key_check,
  add constraint collections_icon_key_check
    check (icon_key is null or icon_key ~ '^[a-z0-9-]{1,40}$'),
  drop constraint if exists collections_accent_color_check,
  add constraint collections_accent_color_check
    check (accent_color is null
           or accent_color in ('violet', 'purple', 'blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'grey'));

-- collections_with_tags is `select c.*`, which Postgres expands when the view is created, so it
-- has to be recreated to pick up the new columns. Same definition as 20251014184302, plus
-- security_invoker from 20260910000002.
drop view if exists public.collections_with_tags;
create view public.collections_with_tags with (security_invoker = true) as
select
  c.*,
  coalesce(array_agg(distinct t.name) filter (where t.id is not null), '{}')::text[] as tags_cache
from public.collections c
left join public.collection_tags ct on ct.collection_id = c.id
left join public.tags t on t.id = ct.tag_id
group by c.id;

grant select on public.collections_with_tags to authenticated, anon, service_role;

-- The membership RPCs return an explicit column list (from 20251030191059); add the
-- appearance columns. Return type changes, so drop + recreate.
drop function if exists public.collections_with_membership(uuid, uuid);
drop function if exists public.collections_with_membership_query(uuid, uuid, text);

create function public.collections_with_membership(
  p_user uuid,
  p_card uuid
) returns table (
  id uuid,
  user_id uuid,
  name text,
  description text,
  visibility text,
  cover_image_url text,
  icon_key text,
  accent_color text,
  background_image_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  tags_cache text[],
  has_item boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, c.name, c.description, c.visibility,
    c.cover_image_url, c.icon_key, c.accent_color, c.background_image_id,
    c.created_at, c.updated_at, c.tags_cache,
    exists (
      select 1
      from collection_items ci
      where ci.collection_id = c.id
        and ci.user_id = p_user
        and ci.ref_id = p_card
    ) as has_item
  from collections_with_tags c
  where c.user_id = p_user
  order by c.created_at desc;
$$;

create function public.collections_with_membership_query(
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
  icon_key text,
  accent_color text,
  background_image_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  tags_cache text[],
  has_item boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, c.name, c.description, c.visibility,
    c.cover_image_url, c.icon_key, c.accent_color, c.background_image_id,
    c.created_at, c.updated_at, c.tags_cache,
    exists (
      select 1
      from collection_items ci
      where ci.collection_id = c.id
        and ci.user_id = p_user
        and ci.ref_id = p_card
    ) as has_item
  from collections_with_tags c
  where c.user_id = p_user
    and (
      p_query is null or
      c.name ilike '%' || p_query || '%' or
      c.description ilike '%' || p_query || '%'
    )
  order by c.created_at desc;
$$;
