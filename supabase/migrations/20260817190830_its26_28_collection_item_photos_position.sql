-- ITS-26/28 follow-up: collection_item_images.position was never set by the
-- client insert, so every row defaulted to 0. useCollectionItemPhotos orders
-- by position alone, so ties are broken by whatever order Postgres's query
-- plan happens to produce for that execution — not guaranteed stable across
-- refetches (e.g. right after an UPDATE relocates a tuple, as
-- set_primary_collection_item_photo does). This showed up as the photo grid
-- visibly reshuffling when a user tapped a photo to set it primary.

-- ── Backfill: assign distinct positions to existing rows ────────────────
-- Orders by created_at (insertion order) per item; id is a final tiebreaker
-- for any rows inserted in the same instant.
with ranked as (
  select
    id,
    row_number() over (
      partition by collection_item_id
      order by created_at asc, id asc
    ) - 1 as new_position
  from public.collection_item_images
)
update public.collection_item_images cii
set position = ranked.new_position
from ranked
where ranked.id = cii.id
  and cii.position is distinct from ranked.new_position;

-- ── Auto-assign position on insert ───────────────────────────────────────
-- The client never sets position explicitly, so relying on its default
-- would leave every future row tied at 0 again. Assign the next position
-- atomically per collection_item on the server side instead of trusting the
-- client to compute it (which would race under concurrent uploads of a
-- multi-photo batch).
create or replace function public.trg_collection_item_images_set_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(position), -1) + 1
    into new.position
    from public.collection_item_images
    where collection_item_id = new.collection_item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_collection_item_images_set_position on public.collection_item_images;
create trigger trg_collection_item_images_set_position
  before insert on public.collection_item_images
  for each row execute function public.trg_collection_item_images_set_position();
