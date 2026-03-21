create
or replace function get_public_profile(target_user_id uuid) returns table (
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
    public .user_profile
where
    user_id = target_user_id;

$$;

-- Revoke from public/anon, only allow authenticated
revoke execute on function get_public_profile(uuid)
from
    public,
    anon;

grant execute on function get_public_profile(uuid) to authenticated;