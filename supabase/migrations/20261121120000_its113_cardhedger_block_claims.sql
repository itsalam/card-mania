-- ITS-113 follow-up: block claims for the CardHedger budget.
--
-- Scheduled jobs (tracked-price-refresh, card-enrichment-backfill) now claim budget units in
-- blocks (claimBlock in _shared/cardhedge.ts) and fetch-card-history reserves one prices unit
-- per grade, so most calls skip the budget round trip. Unspent units go back with
-- public.release_cardhedger_budget, to the UTC day they were claimed on.
--
-- consume_cardhedger_budget changes only in what it counts as denied: a refused block
-- (p_n > 1) falls back to a single unit in the client, so only a refused single unit counts.

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

