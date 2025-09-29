
-- 1) Add the new UUID column
alter table public.card_images
  add column if not exists image_cache_id uuid;

-- 2) Backfill from a legacy key column if you had one (adjust column name)
--    e.g. if you had card_images.image_cache_key or card_images.key:
-- update public.card_images ci
-- set image_cache_id = ic.id
-- from public.image_cache ic
-- where ci.image_cache_key = ic.key;

-- If you have no legacy column, you’ll start populating image_cache_id from /image_commit going forward.

-- 3) Optional: enforce not null once you’ve backfilled everything
-- alter table public.card_images
--   alter column image_cache_id set not null;

-- 4) Add the FK
alter table public.card_images
  add constraint card_images_image_cache_id_fkey
  foreign key (image_cache_id)
  references public.image_cache(id)
  on delete cascade;

-- (Re)create the helpful indexes/uniques
create unique index if not exists idx_card_images_unique_type
  on public.card_images(card_id, kind)
  where kind in ('front','back');

create unique index if not exists idx_card_images_unique_extra
  on public.card_images(card_id, kind, image_cache_id)
  where kind = 'extra';
