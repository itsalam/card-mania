-- ITS-40: the live lazy-enrichment path also marks cards.enriched_at, so the
-- backfill job and live lookups don't both spend vendor quota on the same row.
--
-- Live enrichment is query-keyed (price-charting caches vendor results by
-- query hash, not card id); the per-card artifact it produces is a READY
-- card_images row. Several paths write those — image-commit-from-query
-- (hot-query / commit_images commits from price-charting), image-commit,
-- fetch-card, and the ensure_card_stub RPC — so this hooks the table once
-- rather than each writer. Once a card has a READY image the backfill has
-- nothing left to add for it, and claim_cards_for_backfill_enrichment skips
-- it from then on.
--
-- Only fills a null enriched_at (never moves an existing timestamp) and
-- never touches enrichment_locked_at: if the backfill holds a lease on the
-- row it still finishes and marks it itself. enriched_at is excluded from
-- set_cards_last_updated()'s diff, so this doesn't bump cards.last_updated.
--
-- security definer: ensure_card_stub is callable by `authenticated`, and an
-- invoker-rights trigger would fail that insert if the caller can't update
-- public.cards.
create or replace function public.mark_card_enriched_on_ready_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cards
  set enriched_at = now()
  where id = new.card_id
    and enriched_at is null;
  return null;
end;
$$;

drop trigger if exists trg_card_images_mark_enriched on public.card_images;
create trigger trg_card_images_mark_enriched
  after insert or update of status on public.card_images
  for each row
  when (new.status = 'READY' and new.card_id is not null)
  execute function public.mark_card_enriched_on_ready_image();

-- One-time catch-up: the trigger only sees writes from here on, so cards that
-- already got a READY image from the live path before this migration would
-- otherwise still be claimed (and spend vendor quota) on the backfill's
-- first runs.
update public.cards c
set enriched_at = now()
where c.enriched_at is null
  and exists (
    select 1 from public.card_images ci
    where ci.card_id = c.id and ci.status = 'READY'
  );
