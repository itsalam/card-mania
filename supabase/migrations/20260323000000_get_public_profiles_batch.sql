-- Batch variant of get_public_profile: accepts an array of user IDs and returns
-- all matching profiles in a single round trip. Used for offer counterparty
-- name resolution without N+1 RPC calls.
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

-- Match the access rules of the single-user variant
revoke execute on function get_public_profiles(uuid[]) from public, anon;
grant  execute on function get_public_profiles(uuid[]) to authenticated;
