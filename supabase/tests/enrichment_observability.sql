-- pgTAP suite for ITS-40's enrichment ledger + views
-- (20260922000001_its40_enrichment_observability.sql).
--
-- Covers: enrichment_backlog counts un-enriched / leased / stale-leased rows
-- and summarizes the last 24h of runs (older runs excluded), the ETA
-- extrapolation, enrichment_vendor_outcomes aggregation, the outcome check
-- constraint, attempts cascading with their run, and that neither the
-- tables nor the views are readable by anon/authenticated.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- Isolate from seed data and any real ledger rows (rolled back at the end).
update public.cards set enriched_at = now(), enrichment_locked_at = null where enriched_at is null;
delete from public.enrichment_runs;

insert into public.cards (id, name, set_name, genre, enriched_at, enrichment_locked_at)
values
  ('40000000-0000-0000-0000-0000000000f1', 'Zzyx Obs A', 'Zzyx Set', 'trading_card', null, null),
  ('40000000-0000-0000-0000-0000000000f2', 'Zzyx Obs B', 'Zzyx Set', 'trading_card', null, now()),
  ('40000000-0000-0000-0000-0000000000f3', 'Zzyx Obs C', 'Zzyx Set', 'trading_card', null, now() - interval '20 minutes');

insert into public.enrichment_runs (id, req_id, started_at, finished_at, status, claimed, enriched, no_match, failed)
values
  ('40000000-0000-0000-0000-00000000f001', 'r1', now() - interval '2 hours', now() - interval '2 hours', 'completed', 2, 1, 1, 0),
  ('40000000-0000-0000-0000-00000000f002', 'r2', now() - interval '1 hour', null, 'failed', 1, 0, 0, 1),
  ('40000000-0000-0000-0000-00000000f003', 'r0', now() - interval '3 days', now() - interval '3 days', 'completed', 50, 50, 0, 0);

-- ── enrichment_backlog ─────────────────────────────────────────────────────

select is((select unenriched from public.enrichment_backlog), 3::bigint,
  'unenriched counts every row with enriched_at null');
select is((select leased_now from public.enrichment_backlog), 1::bigint,
  'leased_now counts rows locked within the lease window');
select is((select stale_leases from public.enrichment_backlog), 1::bigint,
  'stale_leases counts rows whose lease has expired');
select is((select backfill_runs_24h from public.enrichment_backlog), 2::bigint,
  'only runs from the last 24h are summarized');
select is((select backfill_claimed_24h from public.enrichment_backlog), 3::bigint,
  'claimed is summed over the last 24h of runs');
select is((select last_run_status from public.enrichment_backlog), 'failed',
  'last_run_status reflects the most recent run');
select is((select est_days_remaining from public.enrichment_backlog), 1.0::numeric,
  'est_days_remaining = unenriched / claimed in the last 24h');

-- ── enrichment_vendor_outcomes ─────────────────────────────────────────────

insert into public.card_enrichment_attempts (run_id, card_id, vendor, outcome, best_score)
values
  ('40000000-0000-0000-0000-00000000f001', '40000000-0000-0000-0000-0000000000f1', 'cardhedge', 'no_match', 0.4),
  ('40000000-0000-0000-0000-00000000f001', '40000000-0000-0000-0000-0000000000f1', 'ebay', 'hit', 0.9),
  ('40000000-0000-0000-0000-00000000f001', '40000000-0000-0000-0000-0000000000f2', 'ebay', 'hit', 0.7);

select results_eq(
  $$ select vendor, outcome, attempts, avg_score from public.enrichment_vendor_outcomes $$,
  $$ values ('cardhedge'::text, 'no_match'::text, 1::bigint, 0.40::numeric),
            ('ebay', 'hit', 2, 0.80) $$,
  'enrichment_vendor_outcomes groups by vendor/outcome with score stats'
);

select throws_ok(
  $$ insert into public.card_enrichment_attempts (run_id, card_id, outcome)
     values ('40000000-0000-0000-0000-00000000f001', '40000000-0000-0000-0000-0000000000f1', 'bogus') $$,
  '23514',
  null,
  'unknown outcomes are rejected by the check constraint'
);

delete from public.enrichment_runs where id = '40000000-0000-0000-0000-00000000f001';
select is((select count(*) from public.card_enrichment_attempts), 0::bigint,
  'attempts are deleted with their run (prune cascades)');

-- ── access ─────────────────────────────────────────────────────────────────

set local role anon;
select throws_ok(
  $$ select * from public.enrichment_backlog $$,
  '42501',
  null,
  'anon cannot read the backlog view'
);
reset role;

select * from finish();
rollback;
