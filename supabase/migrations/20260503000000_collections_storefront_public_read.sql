-- Allow any authenticated user to read storefront collections and their items.
-- The existing collections_owner_all policy covers owner access; these policies
-- layer on top to expose is_storefront=true rows to everyone else.

drop policy if exists collections_storefront_public_read on public.collections;
create policy collections_storefront_public_read
  on public.collections
  for select
  using (is_storefront = true);

drop policy if exists collection_items_storefront_public_read on public.collection_items;
create policy collection_items_storefront_public_read
  on public.collection_items
  for select
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
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_stats.collection_id
        and c.is_storefront = true
    )
  );
