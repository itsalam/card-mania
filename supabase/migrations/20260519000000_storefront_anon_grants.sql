-- user_profile: allow both anon key and anonymous JWT users to read public profiles.
-- Anonymous JWT users run as the 'authenticated' role, so both grants are required.
grant select on public.user_profile to anon;
grant select on public.user_profile to authenticated;

-- collection_stats: anon RLS policy (collection_stats_storefront_public_read) exists
-- but was unreachable because the anon role had no SELECT privilege on the table.
-- (authenticated already has grant from existing migrations)
grant select on public.collection_stats to anon;
