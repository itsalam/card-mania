-- Add optional vault/selling flags to collections

alter table public.collections
  add column if not exists is_vault boolean,
  add column if not exists is_selling boolean;

-- Link back from mirrored selling items to their source collection
alter table public.collection_items
  add column if not exists collection_ref uuid references public.collections(id);
