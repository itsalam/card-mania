-- Scheduled CardHedger price refresh for tracked cards (wishlisted or held in a collection).
-- Mirrors the ITS-40 enrichment backfill: a lease-based claim RPC, a service-role-only apply
-- RPC, and a ledger the tracked-price-refresh edge function writes (pg_net's 5s timeout means
-- cron.job_run_details / net._http_response can't tell how a run went).
--
-- Before this, a card's price only changed when someone opened its detail page (fetch-card),
-- despite the wishlist collection promising "prices are updated daily".
--
-- Useful queries:
--   select * from price_refresh_backlog;
--   select * from price_refresh_outcomes;
--   -- lowest-confidence card-match resolutions, for a wrong-match spot check
--   select a.match_confidence, c.name, c.set_name, a.matched_description, a.cardhedge_id
--   from card_price_refresh_attempts a join cards c on c.id = a.card_id
--   where a.outcome = 'resolved_match' order by a.match_confidence asc limit 25;

-- ── Per-card refresh state ──────────────────────────────────────────────────────────────────
-- prices_refreshed_at: last successful server refresh (also what stops ensure_card_stub from
--   overwriting server prices with client-supplied ones — see the snapshot migration).
-- price_refresh_attempted_at + price_refresh_status drive retry backoff for misses.
-- price_refresh_locked_at: short lease so overlapping runs never claim the same card.
alter table public.cards
  add column if not exists prices_refreshed_at timestamptz null,
  add column if not exists price_refresh_attempted_at timestamptz null,
  add column if not exists price_refresh_locked_at timestamptz null,
  add column if not exists price_refresh_status text null
    check (price_refresh_status in ('ok', 'unresolved', 'no_prices', 'error'));

create index if not exists idx_cards_prices_refreshed_at
  on public.cards (prices_refreshed_at asc nulls first);

-- Refresh bookkeeping must not bump last_updated (the claim/release cycle would otherwise
-- reorder everything sorted by it). Real price changes still do, via grades_prices.
create or replace function public.set_cards_last_updated()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'last_updated' - 'enriched_at' - 'enrichment_locked_at' - 'search_vector'
       - 'prices_refreshed_at' - 'price_refresh_attempted_at' - 'price_refresh_locked_at'
       - 'price_refresh_status')
     is distinct from
     (to_jsonb(old) - 'last_updated' - 'enriched_at' - 'enrichment_locked_at' - 'search_vector'
       - 'prices_refreshed_at' - 'price_refresh_attempted_at' - 'price_refresh_locked_at'
       - 'price_refresh_status')
  then
    new.last_updated := now();
  end if;
  return new;
end;
$$;

-- ── Claim ───────────────────────────────────────────────────────────────────────────────────
-- Leases a batch of tracked, stale cards (FOR UPDATE SKIP LOCKED; an expired lease is
-- reclaimable). Tracked = any card collection_items row with quantity > 0 (wishlist rows are
-- quantity 1). Wishlisted cards go first — they back Wishlist Hits and notifications.
-- Retry windows by last status: unresolved (no CardHedger id) waits p_unresolved_retry_hours,
-- error waits 1h, ok/no_prices wait p_stale_hours.
create or replace function public.claim_cards_for_price_refresh(
  p_limit int,
  p_lease_seconds int default 600,
  p_stale_hours int default 24,
  p_unresolved_retry_hours int default 168
) returns table (id uuid, name text, set_name text, genre text, cardhedge_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.cards c
    set price_refresh_locked_at = now()
    from (
      select cc.id
      from public.cards cc
      where exists (
              select 1 from public.collection_items ci
               where ci.item_kind = 'card'::public.item_kind
                 and ci.ref_id = cc.id
                 and (ci.quantity is null or ci.quantity > 0))
        and (cc.price_refresh_locked_at is null
             or cc.price_refresh_locked_at < now() - make_interval(secs => p_lease_seconds))
        and coalesce(cc.price_refresh_attempted_at, cc.prices_refreshed_at, '-infinity'::timestamptz)
            < now() - make_interval(hours => case cc.price_refresh_status
                                               when 'unresolved' then p_unresolved_retry_hours
                                               when 'error' then 1
                                               else p_stale_hours end)
      order by
        exists (select 1 from public.collection_items ci
                  join public.collections col on col.id = ci.collection_id and col.is_wishlist
                 where ci.item_kind = 'card'::public.item_kind and ci.ref_id = cc.id) desc,
        cc.prices_refreshed_at asc nulls first,
        cc.id
      limit p_limit
      for update of cc skip locked
    ) picked
    where c.id = picked.id
    returning c.id, c.name, c.set_name, c.genre
  )
  select cl.id, cl.name, cl.set_name, cl.genre,
         (select er.external_id from public.external_refs er
           where er.card_id = cl.id and er.provider = 'cardhedge'
           order by er.external_id limit 1)
  from claimed cl;
end;
$$;

revoke execute on function public.claim_cards_for_price_refresh(int, int, int, int) from public, anon, authenticated;
grant execute on function public.claim_cards_for_price_refresh(int, int, int, int) to service_role;

-- ── Apply ───────────────────────────────────────────────────────────────────────────────────
-- Merges (never replaces) fresh prices so grades only another vendor knows survive, writes one
-- card_price_history row per grade per day, and releases the lease. Keys/values are normalized
-- by the cards / card_price_history triggers. The grades_prices totals triggers then update
-- wishlist + collection totals.
create or replace function public.apply_card_price_refresh(
  p_card_id uuid,
  p_prices jsonb,
  p_latest_price_cents int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_grades int;
begin
  select grades_prices into v_before from public.cards where id = p_card_id;

  update public.cards
     set grades_prices = coalesce(grades_prices, '{}'::jsonb) || public.normalize_grades_prices(p_prices),
         latest_price = coalesce(p_latest_price_cents, latest_price),
         prices_refreshed_at = now(),
         price_refresh_attempted_at = now(),
         price_refresh_status = 'ok',
         price_refresh_locked_at = null
   where id = p_card_id
  returning grades_prices into v_after;

  insert into public.card_price_history (card_id, grade, price_cents, recorded_at)
  select p_card_id, e.key, round(e.value::numeric)::int, now()
    from jsonb_each_text(public.normalize_grades_prices(p_prices)) e
   where e.value ~ '^[0-9]+(\.[0-9]+)?$' and e.value::numeric > 0
  on conflict (card_id, grade, recorded_date) do nothing;

  select count(*) into v_grades from jsonb_object_keys(coalesce(p_prices, '{}'::jsonb));
  return jsonb_build_object('changed', v_before is distinct from v_after, 'grades', v_grades);
end;
$$;

revoke execute on function public.apply_card_price_refresh(uuid, jsonb, int) from public, anon, authenticated;
grant execute on function public.apply_card_price_refresh(uuid, jsonb, int) to service_role;

-- Records a terminal miss/failure for a claimed card and releases its lease.
create or replace function public.mark_card_price_refresh(p_card_id uuid, p_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cards
     set price_refresh_status = p_status,
         price_refresh_attempted_at = now(),
         price_refresh_locked_at = null
   where id = p_card_id;
$$;

revoke execute on function public.mark_card_price_refresh(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_card_price_refresh(uuid, text) to service_role;

-- Releases leases without counting an attempt (rate limited / out of budget — retry next run).
create or replace function public.release_card_price_refresh(p_card_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.cards set price_refresh_locked_at = null where id = any(p_card_ids);
$$;

revoke execute on function public.release_card_price_refresh(uuid[]) from public, anon, authenticated;
grant execute on function public.release_card_price_refresh(uuid[]) to service_role;

-- ── Ledger ──────────────────────────────────────────────────────────────────────────────────

create table if not exists public.price_refresh_runs (
  id            uuid primary key default gen_random_uuid(),
  req_id        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                check (status in ('running', 'completed', 'failed', 'skipped', 'rate_limited')),
  claimed       int not null default 0,
  refreshed     int not null default 0,
  unchanged     int not null default 0,
  unresolved    int not null default 0,
  failed        int not null default 0,
  resolves_used int not null default 0,
  error         text
);

create index if not exists idx_price_refresh_runs_started_at
  on public.price_refresh_runs (started_at desc);

create table if not exists public.card_price_refresh_attempts (
  id                  bigint generated always as identity primary key,
  run_id              uuid not null references public.price_refresh_runs (id) on delete cascade,
  card_id             uuid not null references public.cards (id) on delete cascade,
  outcome             text not null check (outcome in (
                        'refreshed', 'unchanged', 'resolved_exact', 'resolved_match',
                        'low_confidence', 'no_results', 'ref_conflict', 'no_prices',
                        'rate_limited', 'error')),
  cardhedge_id        text,
  match_confidence    real,
  matched_description text,
  grades              int,
  error               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_card_price_refresh_attempts_run_id
  on public.card_price_refresh_attempts (run_id);
create index if not exists idx_card_price_refresh_attempts_card_id
  on public.card_price_refresh_attempts (card_id);
create index if not exists idx_card_price_refresh_attempts_created_at
  on public.card_price_refresh_attempts (created_at desc);

alter table public.price_refresh_runs enable row level security;
alter table public.card_price_refresh_attempts enable row level security;

-- Backlog / liveness. Stale window matches PRICE_REFRESH_STALE_HOURS' default (24).
create or replace view public.price_refresh_backlog
with (security_invoker = true) as
with tracked as (
  select c.* from public.cards c
   where exists (select 1 from public.collection_items ci
                  where ci.item_kind = 'card'::public.item_kind and ci.ref_id = c.id
                    and (ci.quantity is null or ci.quantity > 0))
),
runs_24h as (
  select count(*)                                     as runs,
         count(*) filter (where status = 'completed') as completed,
         count(*) filter (where status = 'rate_limited') as rate_limited,
         coalesce(sum(claimed), 0)                    as claimed,
         coalesce(sum(refreshed + unchanged), 0)      as refreshed
    from public.price_refresh_runs
   where started_at > now() - interval '24 hours'
)
select
  (select count(*) from tracked)                                                    as tracked_cards,
  (select count(*) from tracked
    where prices_refreshed_at is null or prices_refreshed_at < now() - interval '24 hours') as stale,
  (select count(*) from tracked where price_refresh_status = 'unresolved')           as unresolved,
  (select count(*) from tracked where price_refresh_locked_at > now() - interval '600 seconds') as leased_now,
  r.runs, r.completed, r.rate_limited, r.claimed as claimed_24h, r.refreshed as refreshed_24h,
  (select max(started_at) from public.price_refresh_runs)                            as last_run_at,
  (select status from public.price_refresh_runs order by started_at desc limit 1)    as last_run_status
from runs_24h r;

create or replace view public.price_refresh_outcomes
with (security_invoker = true) as
select outcome,
       count(*)                                                                  as attempts,
       round(avg(match_confidence)::numeric, 2)                                  as avg_confidence,
       round((percentile_cont(0.1) within group (order by match_confidence))::numeric, 2) as p10_confidence
  from public.card_price_refresh_attempts
 where created_at > now() - interval '7 days'
 group by outcome
 order by outcome;

revoke all on public.price_refresh_runs, public.card_price_refresh_attempts from anon, authenticated;
revoke all on public.price_refresh_backlog, public.price_refresh_outcomes from anon, authenticated;

-- Keep 30 days of ledger (attempts cascade with their run).
select cron.schedule(
  'price-refresh-ledger-prune',
  '25 4 * * *',
  $$ delete from public.price_refresh_runs where started_at < now() - interval '30 days' $$
);
