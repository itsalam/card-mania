-- ITS-40: observability for the card-enrichment-backfill job.
--
-- The cron's net.http_post times out (pg_net default 5s) long before a batch
-- finishes, so neither cron.job_run_details nor net._http_response says how
-- a run went, and function logs only retain 1-7 days. The function writes
-- its own ledger here instead:
--   enrichment_runs           one row per invocation (incl. skipped/failed)
--   card_enrichment_attempts  one row per card per vendor tried, with the
--                             match score / matched title / image URL, so
--                             wrong-image audits and threshold tuning are
--                             plain SQL.
-- Plus two read-only views for checking on it:
--   enrichment_backlog          is it running, is the backlog shrinking, ETA
--   enrichment_vendor_outcomes  per-vendor outcome mix + score spread, 7d
--
-- Service-role only: RLS on with no policies, and the views are
-- security_invoker with anon/authenticated revoked.
--
-- Useful queries:
--   select * from enrichment_backlog;
--   select * from enrichment_vendor_outcomes;
--   -- lowest-confidence committed images, for a wrong-image spot check
--   select a.best_score, c.name, c.set_name, a.matched_title, a.image_url
--   from card_enrichment_attempts a join cards c on c.id = a.card_id
--   where a.outcome = 'hit' order by a.best_score asc limit 25;

create table if not exists public.enrichment_runs (
  id             uuid primary key default gen_random_uuid(),
  req_id         text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running'
                 check (status in ('running', 'completed', 'failed', 'skipped')),
  vendors        text[] not null default '{}',
  claimed        int not null default 0,
  enriched       int not null default 0,
  no_match       int not null default 0,
  failed         int not null default 0,
  hits_by_vendor jsonb not null default '{}'::jsonb,
  error          text
);

create index if not exists idx_enrichment_runs_started_at
  on public.enrichment_runs (started_at desc);

-- vendor is null for card-level outcomes that never reached a vendor
-- ('malformed' name) or aborted the card ('failed', retried next run).
create table if not exists public.card_enrichment_attempts (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references public.enrichment_runs (id) on delete cascade,
  card_id       uuid not null references public.cards (id) on delete cascade,
  vendor        text,
  outcome       text not null check (outcome in (
                  'hit', 'no_results', 'no_image', 'no_match', 'image_failed', 'error',
                  'malformed', 'failed')),
  results       int,
  with_image    int,
  best_score    real,
  matched_title text,
  image_url     text,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_card_enrichment_attempts_run_id
  on public.card_enrichment_attempts (run_id);
create index if not exists idx_card_enrichment_attempts_card_id
  on public.card_enrichment_attempts (card_id);
create index if not exists idx_card_enrichment_attempts_created_at
  on public.card_enrichment_attempts (created_at desc);

alter table public.enrichment_runs enable row level security;
alter table public.card_enrichment_attempts enable row level security;

-- Backlog / liveness snapshot. Lease window matches the function's default
-- ENRICHMENT_LEASE_SECONDS (600). est_days_remaining extrapolates the last
-- 24h of backfill throughput; null until there's been a run that claimed.
create or replace view public.enrichment_backlog
with (security_invoker = true) as
with runs_24h as (
  select
    count(*)                                        as runs,
    count(*) filter (where status = 'completed')    as completed,
    count(*) filter (where status = 'failed')       as failed_runs,
    coalesce(sum(claimed), 0)                       as claimed,
    coalesce(sum(enriched), 0)                      as enriched,
    coalesce(sum(no_match), 0)                      as no_match,
    coalesce(sum(failed), 0)                        as card_failures
  from public.enrichment_runs
  where started_at > now() - interval '24 hours'
)
select
  (select count(*) from public.cards where enriched_at is null)                as unenriched,
  (select count(*) from public.cards
    where enriched_at is null
      and enrichment_locked_at > now() - interval '600 seconds')               as leased_now,
  (select count(*) from public.cards
    where enriched_at is null
      and enrichment_locked_at <= now() - interval '600 seconds')              as stale_leases,
  (select count(*) from public.cards
    where enriched_at > now() - interval '24 hours')                           as enriched_24h_all_paths,
  r.runs        as backfill_runs_24h,
  r.completed   as backfill_completed_24h,
  r.failed_runs as backfill_failed_runs_24h,
  r.claimed     as backfill_claimed_24h,
  r.enriched    as backfill_enriched_24h,
  r.no_match    as backfill_no_match_24h,
  r.card_failures as backfill_card_failures_24h,
  (select max(started_at) from public.enrichment_runs)                         as last_run_at,
  (select status from public.enrichment_runs order by started_at desc limit 1) as last_run_status,
  (select max(finished_at) from public.enrichment_runs
    where status = 'completed')                                               as last_completed_at,
  round(
    (select count(*) from public.cards where enriched_at is null)::numeric
      / nullif(r.claimed, 0),
    1
  )                                                                            as est_days_remaining
from runs_24h r;

-- Per-vendor outcome mix and match-score spread over the last 7 days — the
-- data for tuning ENRICHMENT_MATCH_THRESHOLD (watch no_match rows scoring
-- just under it, and hits scoring just over it).
create or replace view public.enrichment_vendor_outcomes
with (security_invoker = true) as
select
  coalesce(vendor, '(card)')                                          as vendor,
  outcome,
  count(*)                                                            as attempts,
  round(avg(best_score)::numeric, 2)                                  as avg_score,
  round((percentile_cont(0.1) within group (order by best_score))::numeric, 2) as p10_score,
  round((percentile_cont(0.5) within group (order by best_score))::numeric, 2) as p50_score
from public.card_enrichment_attempts
where created_at > now() - interval '7 days'
group by 1, 2
order by 1, 2;

revoke all on public.enrichment_runs, public.card_enrichment_attempts from anon, authenticated;
revoke all on public.enrichment_backlog, public.enrichment_vendor_outcomes from anon, authenticated;

-- Keep 30 days of ledger (attempts cascade with their run).
select cron.schedule(
  'enrichment-ledger-prune',
  '15 4 * * *',
  $$ delete from public.enrichment_runs where started_at < now() - interval '30 days' $$
);
