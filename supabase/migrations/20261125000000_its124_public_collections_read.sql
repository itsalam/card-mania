-- ITS-124: collections marked Public are readable by everyone.
--
-- The collection editor lets owners set visibility to private / unlisted / public, but the
-- only read policies were the owner's own rows and storefront collections, so "public"
-- did nothing. These policies give everyone (no role restriction, same as the storefront
-- policies) read access to public collections and what's needed to show them: their items,
-- the items' photos, and the collection's cached total.
--
-- Signed-out visitors are signed in anonymously by the app and run as `authenticated`, so
-- no new `anon` table grants are needed (storefronts work the same way).
-- `unlisted` stays owner-only until there's a share-link flow that needs it.

drop policy if exists "collections_public_read" on public.collections;
create policy "collections_public_read" on public.collections
  for select using (visibility = 'public');

drop policy if exists "collection_items_public_read" on public.collection_items;
create policy "collection_items_public_read" on public.collection_items
  for select using (
    exists (select 1 from public.collections c
             where c.id = collection_items.collection_id and c.visibility = 'public')
  );

drop policy if exists "collection_item_images_public_read" on public.collection_item_images;
create policy "collection_item_images_public_read" on public.collection_item_images
  for select using (
    exists (select 1
              from public.collection_items ci
              join public.collections c on c.id = ci.collection_id
             where ci.id = collection_item_images.collection_item_id and c.visibility = 'public')
  );

drop policy if exists "collection_totals_public_read" on public.collection_totals;
create policy "collection_totals_public_read" on public.collection_totals
  for select using (
    exists (select 1 from public.collections c
             where c.id = collection_totals.collection_id and c.visibility = 'public')
  );

-- The profile Collections tab lists a user's public collections.
create index if not exists collections_user_public_idx
  on public.collections (user_id, created_at desc)
  where visibility = 'public';
