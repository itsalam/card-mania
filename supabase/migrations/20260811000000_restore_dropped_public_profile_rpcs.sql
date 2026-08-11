-- get_public_profile(uuid) and get_public_profiles(uuid[]) were dropped by an
-- ad-hoc dashboard change on the remote project (2026-07-23, migration
-- "remote_schema", never captured as a file — see supabase migration list /
-- repair history around 20260723221410) without being recreated. Both are
-- still actively called from the app (features/users/client/load-user.ts),
-- so restore them here, unchanged from their original definitions.

create or replace function get_public_profile(target_user_id uuid) returns table (
    user_id uuid,
    username text,
    display_name text,
    avatar_url text,
    bio text,
    location text,
    is_seller boolean
) language sql security definer -- runs as DB owner, bypasses RLS
stable as $$
select
    user_id,
    username,
    display_name,
    avatar_url,
    bio,
    location,
    is_seller
from
    public.user_profile
where
    user_id = target_user_id;
$$;

revoke execute on function get_public_profile(uuid)
from
    public,
    anon;

grant execute on function get_public_profile(uuid) to authenticated;

create or replace function get_public_profiles(user_ids uuid[])
returns table (
  user_id     uuid,
  username    text,
  display_name text,
  avatar_url  text,
  is_seller   boolean
)
language sql
security definer  -- runs as DB owner, bypasses RLS (same as get_public_profile)
stable
as $$
  select
    user_id,
    username,
    display_name,
    avatar_url,
    is_seller
  from public.user_profile
  where user_id = any(user_ids);
$$;

revoke execute on function get_public_profiles(uuid[]) from public, anon;
grant  execute on function get_public_profiles(uuid[]) to authenticated;
