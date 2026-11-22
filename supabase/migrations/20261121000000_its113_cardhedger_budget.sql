-- ITS-113: a global daily CardHedger budget, a per-call ledger, usage views and ops alerts.
--
-- Every CardHedger request goes through one chokepoint (supabase/functions/_shared/cardhedge.ts),
-- which:
--   1. asks public.consume_cardhedger_budget(class, n, scheduled) before calling. Denied:
--      scheduled jobs end their run as 'budget_exhausted'; live paths serve cached/DB data.
--      Scheduled jobs claim blocks of units and hand unspent ones back with
--      public.release_cardhedger_budget, so most of their calls skip the round trip.
--   2. writes one public.cardhedger_calls row per request (best-effort).
--
-- Budget: one row per endpoint class in public.cardhedger_budget, editable without a deploy
-- (SQL, or admin.set_cardhedger_budget from the console). Scheduled jobs may only use
-- scheduled_share of a class's daily limit, so live traffic is never starved. Days are UTC.
--
--   public.cardhedger_usage_today   calls by caller × endpoint today vs. the class budget
--   public.cardhedger_usage_daily   30-day trend per class, for quota conversations
--   admin.send_ops_alerts()         hourly: rate-limited / budget-exhausted runs, ≥ 80 % of a
--                                   budget, cron→function 401s → a 'system' notification to
--                                   every owner and ops member, once per alert per UTC day
--   admin.cardhedger_usage_overview / admin.set_cardhedger_budget   the console's view (role ops)

-- ── Budget ─────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.cardhedger_budget (
  endpoint_class  text primary key check (endpoint_class in ('search', 'match', 'prices', 'other')),
  daily_limit     int not null check (daily_limit >= 0),
  scheduled_share numeric(3, 2) not null default 0.80 check (scheduled_share between 0 and 1),
  updated_at      timestamptz not null default now()
);

-- Starting limits: the self-imposed budget in docs/api-docs/card-hedge/RATE_LIMITS.md
-- (≤ 4,000 scheduled calls/day, ≤ 300 AI matches/day) with room for live traffic on top.
insert into public.cardhedger_budget (endpoint_class, daily_limit, scheduled_share) values
  ('search', 5000, 0.80),
  ('match',   375, 0.80),
  ('prices', 2500, 0.80),
  ('other',   500, 0.80)
on conflict (endpoint_class) do nothing;

create table if not exists public.cardhedger_usage (
  day            date not null,
  endpoint_class text not null references public.cardhedger_budget (endpoint_class),
  used           int not null default 0,
  scheduled_used int not null default 0,
  denied         int not null default 0,
  primary key (day, endpoint_class)
);

alter table public.cardhedger_budget enable row level security;
alter table public.cardhedger_usage enable row level security;
revoke all on public.cardhedger_budget, public.cardhedger_usage from anon, authenticated;

-- Atomically takes p_n calls from today's (UTC) budget for p_class. Returns false, and counts a
-- denial, when that would pass the daily limit — or, for scheduled callers, their share of it.
-- The conditional UPDATE row-locks today's row, so concurrent callers can't overshoot.
create or replace function public.consume_cardhedger_budget(
  p_class text,
  p_n int default 1,
  p_scheduled boolean default false
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day   date := (now() at time zone 'utc')::date;
  v_limit int;
  v_share numeric;
  v_ok    boolean;
begin
  if p_n is null or p_n < 1 then
    raise exception 'p_n must be at least 1' using errcode = '22023';
  end if;
  select b.daily_limit, b.scheduled_share into v_limit, v_share
    from public.cardhedger_budget b where b.endpoint_class = p_class;
  if not found then
    raise exception 'unknown CardHedger endpoint class %', p_class using errcode = '22023';
  end if;

  insert into public.cardhedger_usage (day, endpoint_class) values (v_day, p_class)
  on conflict (day, endpoint_class) do nothing;

  update public.cardhedger_usage u
     set used = u.used + p_n,
         scheduled_used = u.scheduled_used + case when p_scheduled then p_n else 0 end
   where u.day = v_day and u.endpoint_class = p_class
     and u.used + p_n <= v_limit
     and (not coalesce(p_scheduled, false) or u.scheduled_used + p_n <= floor(v_limit * v_share))
  returning true into v_ok;

  if v_ok then
    return true;
  end if;
  -- A refused block claim (p_n > 1) falls back to single units in the client, so only a
  -- refused single unit is a refused call.
  if p_n = 1 then
    update public.cardhedger_usage u set denied = u.denied + 1
     where u.day = v_day and u.endpoint_class = p_class;
  end if;
  return false;
end;
$$;

revoke all on function public.consume_cardhedger_budget(text, int, boolean) from public, anon, authenticated;
grant execute on function public.consume_cardhedger_budget(text, int, boolean) to service_role;

-- Hands back units a client claimed in a block but didn't spend, to the UTC day they were
-- claimed on (a block claimed just before midnight goes back to yesterday's row).
create or replace function public.release_cardhedger_budget(
  p_class text,
  p_n int,
  p_scheduled boolean default false,
  p_day date default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_n is null or p_n < 1 then
    raise exception 'p_n must be at least 1' using errcode = '22023';
  end if;
  update public.cardhedger_usage u
     set used = greatest(u.used - p_n, 0),
         scheduled_used = case when p_scheduled then greatest(u.scheduled_used - p_n, 0)
                               else u.scheduled_used end
   where u.day = coalesce(p_day, (now() at time zone 'utc')::date)
     and u.endpoint_class = p_class;
end;
$$;

revoke all on function public.release_cardhedger_budget(text, int, boolean, date) from public, anon, authenticated;
grant execute on function public.release_cardhedger_budget(text, int, boolean, date) to service_role;

-- ── Per-call ledger ────────────────────────────────────────────────────────────────────────────
create table if not exists public.cardhedger_calls (
  id             bigint generated always as identity primary key,
  called_at      timestamptz not null default now(),
  caller         text not null,
  endpoint       text not null,
  endpoint_class text not null,
  scheduled      boolean not null default false,
  status         int,
  duration_ms    int,
  retries        int not null default 0,
  rate_limited   boolean not null default false,
  budget_denied  boolean not null default false,
  error          text
);

create index if not exists idx_cardhedger_calls_called_at on public.cardhedger_calls (called_at desc);

alter table public.cardhedger_calls enable row level security;
revoke all on public.cardhedger_calls from anon, authenticated;

-- ── Run statuses ───────────────────────────────────────────────────────────────────────────────
alter table public.price_refresh_runs drop constraint if exists price_refresh_runs_status_check;
alter table public.price_refresh_runs add constraint price_refresh_runs_status_check
  check (status in ('running', 'completed', 'failed', 'skipped', 'rate_limited', 'budget_exhausted'));

alter table public.enrichment_runs drop constraint if exists enrichment_runs_status_check;
alter table public.enrichment_runs add constraint enrichment_runs_status_check
  check (status in ('running', 'completed', 'failed', 'skipped', 'rate_limited', 'budget_exhausted'));

-- ── Views ──────────────────────────────────────────────────────────────────────────────────────
create or replace view public.cardhedger_usage_today
with (security_invoker = true) as
with today as (
  select (now() at time zone 'utc')::date as day
),
calls as (
  select c.caller, c.endpoint, c.endpoint_class,
         count(*) filter (where not c.budget_denied)::int                         as calls,
         count(*) filter (where c.scheduled and not c.budget_denied)::int          as scheduled_calls,
         count(*) filter (where c.budget_denied)::int                              as budget_denied,
         count(*) filter (where c.rate_limited)::int                               as rate_limited,
         count(*) filter (where not c.budget_denied
                            and (c.error is not null or c.status >= 400))::int     as errors,
         coalesce(sum(c.retries), 0)::int                                          as retries,
         (percentile_cont(0.95) within group (order by c.duration_ms)
            filter (where not c.budget_denied))::int                               as p95_ms
    from public.cardhedger_calls c, today t
   where c.called_at >= (t.day::timestamp at time zone 'utc')
   group by c.caller, c.endpoint, c.endpoint_class
)
select k.caller, k.endpoint, k.endpoint_class, k.calls, k.scheduled_calls, k.budget_denied,
       k.rate_limited, k.errors, k.retries, k.p95_ms,
       b.daily_limit                                                   as class_limit,
       coalesce(u.used, 0)                                             as class_used,
       round(100.0 * coalesce(u.used, 0) / nullif(b.daily_limit, 0), 1) as class_pct_used
  from calls k
  join public.cardhedger_budget b on b.endpoint_class = k.endpoint_class
  left join public.cardhedger_usage u
         on u.endpoint_class = k.endpoint_class and u.day = (select day from today);

create or replace view public.cardhedger_usage_daily
with (security_invoker = true) as
with calls as (
  select (c.called_at at time zone 'utc')::date as day, c.endpoint_class,
         count(*) filter (where c.rate_limited)::int as rate_limited,
         count(*) filter (where not c.budget_denied
                            and (c.error is not null or c.status >= 400))::int as errors,
         (percentile_cont(0.95) within group (order by c.duration_ms)
            filter (where not c.budget_denied))::int as p95_ms
    from public.cardhedger_calls c
   where c.called_at > now() - interval '30 days'
   group by 1, 2
)
select u.day, u.endpoint_class, u.used, u.scheduled_used, u.denied,
       b.daily_limit as current_limit,
       round(100.0 * u.used / nullif(b.daily_limit, 0), 1) as pct_of_current_limit,
       coalesce(k.rate_limited, 0) as rate_limited,
       coalesce(k.errors, 0) as errors,
       k.p95_ms
  from public.cardhedger_usage u
  join public.cardhedger_budget b on b.endpoint_class = u.endpoint_class
  left join calls k on k.day = u.day and k.endpoint_class = u.endpoint_class
 where u.day > (now() at time zone 'utc')::date - 30;

revoke all on public.cardhedger_usage_today, public.cardhedger_usage_daily from anon, authenticated;

-- ── Prune ──────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule('cardhedger-ledger-prune')
    where exists (select 1 from cron.job where jobname = 'cardhedger-ledger-prune');
  perform cron.schedule('cardhedger-ledger-prune', '35 4 * * *', $job$
    delete from public.cardhedger_calls where called_at < now() - interval '30 days';
    delete from public.cardhedger_usage where day < (now() at time zone 'utc')::date - 90;
  $job$);
end $$;

-- ── Ops alerts ─────────────────────────────────────────────────────────────────────────────────
create table if not exists admin.ops_alerts (
  alert_key text primary key,             -- '<kind>:<subject>:<utc day>', so once per day
  sent_at   timestamptz not null default now(),
  detail    jsonb not null default '{}'::jsonb
);
alter table admin.ops_alerts enable row level security;
revoke all on admin.ops_alerts from public, anon, authenticated;

-- Raises one alert: records it (skipping if already sent today) and notifies owner + ops.
create or replace function admin._raise_ops_alert(p_kind text, p_subject text, p_title text,
                                                  p_body text, p_detail jsonb)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text := p_kind || ':' || coalesce(p_subject, '') || ':' || (now() at time zone 'utc')::date;
begin
  insert into admin.ops_alerts (alert_key, detail) values (v_key, coalesce(p_detail, '{}'))
  on conflict (alert_key) do nothing;
  if not found then
    return false;
  end if;
  insert into public.notifications (user_id, type, category, priority, title, body, payload)
  select m.user_id, 'ops_alert', 'system', 'high', p_title, p_body,
         jsonb_build_object('alert', p_kind, 'subject', p_subject) || coalesce(p_detail, '{}')
    from admin.members m
   where m.role in ('owner', 'ops');
  return true;
end;
$$;

-- Hourly. Looks back 2 hours so a run that finishes right at the boundary isn't missed; the
-- per-day key keeps that from double-alerting. Returns the keys it raised.
create or replace function admin.send_ops_alerts()
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_raised text[] := '{}';
  r record;
begin
  -- Scheduled runs that stopped on CardHedger rate limiting or the budget.
  for r in
    select 'tracked-price-refresh' as job, status, count(*)::int as runs, max(started_at) as last_at
      from public.price_refresh_runs
     where status in ('rate_limited', 'budget_exhausted') and started_at > now() - interval '2 hours'
     group by status
    union all
    select 'card-enrichment-backfill', status, count(*)::int, max(started_at)
      from public.enrichment_runs
     where status in ('rate_limited', 'budget_exhausted') and started_at > now() - interval '2 hours'
     group by status
  loop
    if admin._raise_ops_alert('run.' || r.status, r.job,
         format('%s stopped: %s', r.job, replace(r.status, '_', ' ')),
         case r.status
           when 'rate_limited' then 'CardHedger kept rate limiting the run. Remaining cards were released for the next run.'
           else 'The daily CardHedger budget for scheduled jobs is used up. Runs resume tomorrow (UTC) or when the budget is raised.'
         end,
         jsonb_build_object('runs', r.runs, 'last_at', r.last_at)) then
      v_raised := v_raised || ('run.' || r.status || ':' || r.job);
    end if;
  end loop;

  -- A class past 80 % of today's budget.
  for r in
    select u.endpoint_class, u.used, b.daily_limit
      from public.cardhedger_usage u
      join public.cardhedger_budget b on b.endpoint_class = u.endpoint_class
     where u.day = (now() at time zone 'utc')::date
       and b.daily_limit > 0 and u.used >= 0.8 * b.daily_limit
  loop
    if admin._raise_ops_alert('budget.80', r.endpoint_class,
         format('CardHedger %s budget at %s%%', r.endpoint_class, round(100.0 * r.used / r.daily_limit)),
         format('%s of %s %s calls used today (UTC).', r.used, r.daily_limit, r.endpoint_class),
         jsonb_build_object('used', r.used, 'daily_limit', r.daily_limit)) then
      v_raised := v_raised || ('budget.80:' || r.endpoint_class);
    end if;
  end loop;

  -- Cron → function calls answered 401: usually a wrong Vault edge_token.
  for r in
    select t.function, count(*)::int as calls
      from admin.cron_http_requests t
      join net._http_response h on h.id = t.request_id
     where h.status_code = 401 and t.created_at > now() - interval '2 hours'
     group by t.function
  loop
    if admin._raise_ops_alert('cron.401', r.function,
         format('Scheduled calls to %s are failing (401)', r.function),
         'The function rejected the cron''s token. Check the Vault edge_token is the project''s current secret key.',
         jsonb_build_object('calls', r.calls)) then
      v_raised := v_raised || ('cron.401:' || r.function);
    end if;
  end loop;

  delete from admin.ops_alerts where sent_at < now() - interval '30 days';
  return v_raised;
end;
$$;

revoke all on function admin._raise_ops_alert(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function admin.send_ops_alerts() from public, anon, authenticated;
grant execute on function admin._raise_ops_alert(text, text, text, text, jsonb) to service_role;
grant execute on function admin.send_ops_alerts() to service_role;

do $$
begin
  perform cron.unschedule('ops-alerts')
    where exists (select 1 from cron.job where jobname = 'ops-alerts');
  perform cron.schedule('ops-alerts', '53 * * * *', 'select admin.send_ops_alerts()');
end $$;

-- ── Console ────────────────────────────────────────────────────────────────────────────────────
create or replace function admin.cardhedger_usage_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return jsonb_build_object(
    'budget', coalesce((
      select jsonb_agg(jsonb_build_object(
               'endpoint_class', b.endpoint_class, 'daily_limit', b.daily_limit,
               'scheduled_share', b.scheduled_share, 'updated_at', b.updated_at,
               'used', coalesce(u.used, 0), 'scheduled_used', coalesce(u.scheduled_used, 0),
               'denied', coalesce(u.denied, 0)) order by b.endpoint_class)
        from public.cardhedger_budget b
        left join public.cardhedger_usage u
               on u.endpoint_class = b.endpoint_class
              and u.day = (now() at time zone 'utc')::date), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(to_jsonb(t) order by t.calls desc)
                         from public.cardhedger_usage_today t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(d) order by d.day desc, d.endpoint_class)
                         from public.cardhedger_usage_daily d), '[]'::jsonb),
    'recent_failures', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.called_at desc)
        from (select c.called_at, c.caller, c.endpoint, c.status, c.retries, c.rate_limited,
                     c.budget_denied, left(c.error, 300) as error
                from public.cardhedger_calls c
               where c.called_at > now() - interval '24 hours'
                 and (c.rate_limited or c.budget_denied or c.error is not null or c.status >= 400)
               order by c.called_at desc
               limit 25) x), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object('alert_key', a.alert_key, 'sent_at', a.sent_at,
                                          'detail', a.detail) order by a.sent_at desc)
        from (select * from admin.ops_alerts order by sent_at desc limit 20) a), '[]'::jsonb)
  );
end;
$$;

create or replace function admin.set_cardhedger_budget(p_class text, p_daily_limit int,
                                                       p_scheduled_share numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  perform admin._require_role('ops');
  if p_daily_limit is null or p_daily_limit < 0 then
    raise exception 'daily limit must be 0 or more' using errcode = '22023';
  end if;
  if p_scheduled_share is not null and (p_scheduled_share < 0 or p_scheduled_share > 1) then
    raise exception 'scheduled share must be between 0 and 1' using errcode = '22023';
  end if;

  select to_jsonb(b) into v_before from public.cardhedger_budget b
   where b.endpoint_class = p_class for update;
  if not found then
    raise exception 'unknown CardHedger endpoint class %', p_class using errcode = '22023';
  end if;

  update public.cardhedger_budget b
     set daily_limit = p_daily_limit,
         scheduled_share = coalesce(p_scheduled_share, b.scheduled_share),
         updated_at = now()
   where b.endpoint_class = p_class
  returning to_jsonb(b) into v_after;

  perform admin._audit('cardhedger_budget.update', 'cardhedger_budget', p_class, v_before, v_after);
  return v_after;
end;
$$;

revoke all on function admin.cardhedger_usage_overview() from public, anon;
revoke all on function admin.set_cardhedger_budget(text, int, numeric) from public, anon;
grant execute on function admin.cardhedger_usage_overview() to authenticated, service_role;
grant execute on function admin.set_cardhedger_budget(text, int, numeric) to authenticated, service_role;
