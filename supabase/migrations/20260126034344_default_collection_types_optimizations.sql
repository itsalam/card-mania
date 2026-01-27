-- Indexing/optimizations for default collection types

-- Partial indexes for single-flag lookups per user
create index if not exists collections_user_selling_idx
  on public.collections (user_id)
  where coalesce(is_selling, false) = true;

create index if not exists collections_user_vault_idx
  on public.collections (user_id)
  where coalesce(is_vault, false) = true;

create index if not exists collections_user_wishlist_idx
  on public.collections (user_id)
  where coalesce(is_wishlist, false) = true;

-- Partial index to speed storefront checks by id
create index if not exists collections_storefront_id_idx
  on public.collections (id)
  where coalesce(is_storefront, false) = true;

-- Composite index for storefront/selling dedupe + sync paths
create index if not exists collection_items_collection_match_idx
  on public.collection_items (
    collection_id,
    item_kind,
    ref_id,
    grade_condition_id,
    grading_company,
    variants
  );

-- Back-reference for mirrored selling items
create index if not exists collection_items_collection_ref_idx
  on public.collection_items (collection_ref);

-- Support common pagination/filter by collection + created_at
create index if not exists collection_items_collection_created_at_idx
  on public.collection_items (collection_id, created_at desc);
