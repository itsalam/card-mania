-- pgTAP suite for ITS-40's public.claim_cards_for_backfill_enrichment(...)
-- and the accompanying set_cards_last_updated() trigger guard.
--
-- Covers: claiming leases a row, a second claim within the lease window
-- excludes it, an expired lease is reclaimable, enriched_at permanently
-- excludes a row, and bookkeeping-only updates don't bump last_updated
-- while a content-column update still does.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Neutralize any pre-existing un-enriched seed rows for the duration of this
-- transaction (rolled back at the end) so the claim assertions below aren't
-- sensitive to how many other un-enriched cards happen to exist in
-- supabase/seed.sql, or to ordering against them.
update public.cards set enriched_at = now() where enriched_at is null;

-- ── Seed two un-enriched stub cards ───────────────────────────────────────

insert into public.cards (id, name, set_name, genre, enriched_at, enrichment_locked_at)
values
  ('40000000-0000-0000-0000-00000000000a', 'Zzyx Claim Card A', 'Zzyx Set', 'trading_card', null, null),
  ('40000000-0000-0000-0000-00000000000b', 'Zzyx Claim Card B', 'Zzyx Set', 'trading_card', null, null);

-- ── Claim leases a row ─────────────────────────────────────────────────────

select is(
  (select count(*) from public.claim_cards_for_backfill_enrichment(10, 600)
   where id in ('40000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000b')),
  2::bigint,
  'first claim call returns both un-enriched stub rows'
);

select is(
  (select count(*) from public.cards
   where id in ('40000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000b')
     and enrichment_locked_at is not null),
  2::bigint,
  'claimed rows have enrichment_locked_at set'
);

-- ── Second claim within the lease window excludes them ────────────────────

select is(
  (select count(*) from public.claim_cards_for_backfill_enrichment(10, 600)
   where id in ('40000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000b')),
  0::bigint,
  'second claim within lease window returns neither row'
);

-- ── Expired lease is reclaimable ───────────────────────────────────────────

update public.cards
set enrichment_locked_at = now() - interval '20 minutes'
where id = '40000000-0000-0000-0000-00000000000a';

select is(
  (select count(*) from public.claim_cards_for_backfill_enrichment(10, 600)
   where id = '40000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'a stale-locked row is reclaimed once its lease has expired'
);

-- ── enriched_at permanently excludes a row ─────────────────────────────────

update public.cards
set enriched_at = now(), enrichment_locked_at = null
where id = '40000000-0000-0000-0000-00000000000a';

select is(
  (select count(*) from public.claim_cards_for_backfill_enrichment(10, 0)
   where id = '40000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'an enriched row is never claimed again, even with a zero-second lease'
);

-- ── last_updated trigger guard ──────────────────────────────────────────────
--
-- now() is stable for the whole test transaction in Postgres (it's really
-- transaction_timestamp()), so comparing "before vs. after now()" wouldn't
-- distinguish a fired trigger from a no-op one here. Instead, plant a
-- deliberately-stale sentinel directly into last_updated (itself excluded
-- from the trigger's diff, so a lone last_updated write is a no-op for the
-- guard) and check whether it survives an otherwise bookkeeping-only update
-- vs. gets overwritten by a real content-column update.

update public.cards set last_updated = '2000-01-01'::timestamptz
where id = '40000000-0000-0000-0000-00000000000b';

-- Bookkeeping-only write (mirrors what the backfill job's lease-release does)
update public.cards set enrichment_locked_at = now() where id = '40000000-0000-0000-0000-00000000000b';

select ok(
  (select last_updated from public.cards where id = '40000000-0000-0000-0000-00000000000b')
    = '2000-01-01'::timestamptz,
  'a bookkeeping-only update (enrichment_locked_at) does not bump last_updated'
);

update public.cards set last_updated = '2000-01-01'::timestamptz
where id = '40000000-0000-0000-0000-00000000000b';

-- A real content-column write still bumps it
update public.cards set name = 'Zzyx Claim Card B (renamed)' where id = '40000000-0000-0000-0000-00000000000b';

select ok(
  (select last_updated from public.cards where id = '40000000-0000-0000-0000-00000000000b')
    > '2000-01-01'::timestamptz,
  'a content-column update (name) still bumps last_updated'
);

select * from finish();
rollback;
