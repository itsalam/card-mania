-- pgTAP suite for ITS-40's trg_card_images_mark_enriched trigger: the live
-- lazy-enrichment path (any READY card_images write) marks cards.enriched_at
-- so the backfill job stops claiming that row.
--
-- Covers: a non-READY image doesn't mark the card, flipping it to READY does,
-- inserting a READY image directly does, an existing enriched_at is never
-- moved, the write doesn't bump last_updated, and a live-enriched card is no
-- longer claimable by the backfill.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- See claim_cards_for_backfill_enrichment.sql: keep seed rows out of the
-- claim assertion below.
update public.cards set enriched_at = now() where enriched_at is null;

insert into public.cards (id, name, set_name, genre, enriched_at, last_updated)
values
  ('40000000-0000-0000-0000-0000000000c1', 'Zzyx Live Card C', 'Zzyx Set', 'trading_card', null, '2000-01-01'),
  ('40000000-0000-0000-0000-0000000000d1', 'Zzyx Live Card D', 'Zzyx Set', 'trading_card', null, '2000-01-01'),
  ('40000000-0000-0000-0000-0000000000e1', 'Zzyx Live Card E', 'Zzyx Set', 'trading_card', '2001-01-01', '2000-01-01');

-- ── PROCESSING image doesn't mark the card ─────────────────────────────────

insert into public.card_images (id, card_id, status, kind)
values ('40000000-0000-0000-0000-0000000001c1', '40000000-0000-0000-0000-0000000000c1', 'PROCESSING', 'front');

select ok(
  (select enriched_at is null from public.cards where id = '40000000-0000-0000-0000-0000000000c1'),
  'a PROCESSING card_images row leaves enriched_at null'
);

-- ── Flipping it to READY marks the card ────────────────────────────────────

update public.card_images set status = 'READY' where id = '40000000-0000-0000-0000-0000000001c1';

select ok(
  (select enriched_at is not null from public.cards where id = '40000000-0000-0000-0000-0000000000c1'),
  'updating a card_images row to READY sets enriched_at'
);

-- ── Inserting a READY image marks the card ─────────────────────────────────

insert into public.card_images (card_id, status, kind)
values ('40000000-0000-0000-0000-0000000000d1', 'READY', 'front');

select ok(
  (select enriched_at is not null from public.cards where id = '40000000-0000-0000-0000-0000000000d1'),
  'inserting a READY card_images row sets enriched_at'
);

-- ── Existing enriched_at is never moved ────────────────────────────────────

insert into public.card_images (card_id, status, kind)
values ('40000000-0000-0000-0000-0000000000e1', 'READY', 'front');

select ok(
  (select enriched_at from public.cards where id = '40000000-0000-0000-0000-0000000000e1')
    = '2001-01-01'::timestamptz,
  'an already-enriched card keeps its original enriched_at'
);

-- ── Doesn't bump last_updated ──────────────────────────────────────────────

select ok(
  (select last_updated from public.cards where id = '40000000-0000-0000-0000-0000000000d1')
    = '2000-01-01'::timestamptz,
  'marking enriched_at from the trigger does not bump last_updated'
);

-- ── Live-enriched cards aren't claimed by the backfill ─────────────────────

select is(
  (select count(*) from public.claim_cards_for_backfill_enrichment(10, 0)
   where id in ('40000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-0000000000d1')),
  0::bigint,
  'cards enriched via the live path are never claimed by the backfill'
);

select * from finish();
rollback;
