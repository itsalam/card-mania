-- Restrict storefront read policies to the authenticated role only.
-- Raw anon-key requests (no JWT) can no longer read storefront data.
-- Web visitors auto-sign-in anonymously and run as 'authenticated', so they are unaffected.

drop policy if exists collections_storefront_public_read on public.collections;
create policy collections_storefront_public_read
  on public.collections
  for select
  to authenticated
  using (is_storefront = true);

drop policy if exists collection_items_storefront_public_read on public.collection_items;
create policy collection_items_storefront_public_read
  on public.collection_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id
        and c.is_storefront = true
    )
  );

drop policy if exists collection_stats_storefront_public_read on public.collection_stats;
create policy collection_stats_storefront_public_read
  on public.collection_stats
  for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_stats.collection_id
        and c.is_storefront = true
    )
  );

-- user_profile and demo_user_map currently have no RLS. Enable it and add an
-- authenticated-only policy so raw anon-key requests are also blocked there.

alter table public.user_profile enable row level security;

create policy user_profile_public_read
  on public.user_profile
  for select
  to authenticated
  using (true);

-- Owner writes — preserve existing insert/update behaviour for the user's own row.
create policy user_profile_owner_write
  on public.user_profile
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.demo_user_map enable row level security;

create policy demo_user_map_public_read
  on public.demo_user_map
  for select
  to authenticated
  using (true);
