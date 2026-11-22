-- pgTAP suite for the CardHedger budget, ledger, views and ops alerts (20261121000000, ITS-113).
--
-- consume_cardhedger_budget is atomic because the take is a single conditional UPDATE on
-- today's row (row lock + re-check of the WHERE under read committed); these checks pin the
-- boundaries that UPDATE enforces.

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('11130000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-ch-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 3) n;
insert into admin.members (user_id, role) values
  ('11130000-0000-0000-0000-0000000000a1', 'ops'),
  ('11130000-0000-0000-0000-0000000000a2', 'editor');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  if p_user is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  end if;
end $$;
grant execute on function pg_temp.act_as(uuid) to anon, authenticated;

-- Start from a clean slate for today, with a small search budget: 10 a day, half for scheduled.
delete from public.cardhedger_usage;
delete from public.cardhedger_calls;
delete from admin.ops_alerts;
update public.cardhedger_budget set daily_limit = 10, scheduled_share = 0.5 where endpoint_class = 'search';

-- ── Budget ──
select is((select count(*)::int from public.cardhedger_budget), 4, 'four endpoint classes are configured');

select ok(public.consume_cardhedger_budget('search', 1, true), 'a scheduled call is allowed');
select ok(public.consume_cardhedger_budget('search', 4, true), 'scheduled calls up to their share are allowed');
select ok(not public.consume_cardhedger_budget('search', 1, true), 'a scheduled call past its share is denied');
select ok(public.consume_cardhedger_budget('search', 4, false), 'live calls can use the rest');
select ok(not public.consume_cardhedger_budget('search', 2, false), 'a take that would pass the limit is denied whole');
select ok(public.consume_cardhedger_budget('search', 1, false), 'the last unit is still available');
select ok(not public.consume_cardhedger_budget('search', 1, false), 'past the daily limit, live calls are denied too');
select is((select row(used, scheduled_used, denied)::text from public.cardhedger_usage
            where endpoint_class = 'search' and day = (now() at time zone 'utc')::date),
          '(10,5,3)', 'usage counts every allowed unit and every denial');

-- Yesterday being full doesn't affect today.
insert into public.cardhedger_usage (day, endpoint_class, used) values
  ((now() at time zone 'utc')::date - 1, 'match', 1000);
select ok(public.consume_cardhedger_budget('match'), 'the budget resets per UTC day');

select throws_ok($$ select public.consume_cardhedger_budget('nope') $$, '22023', null, 'an unknown class is refused');
select throws_ok($$ select public.consume_cardhedger_budget('search', 0) $$, '22023', null, 'a take of zero is refused');

select pg_temp.act_as('11130000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.consume_cardhedger_budget('search') $$, '42501', null,
  'clients cannot take from the budget');
select throws_ok($$ select count(*) from public.cardhedger_calls $$, '42501', null, 'or read the call ledger');
select throws_ok($$ select count(*) from public.cardhedger_usage_today $$, '42501', null, 'or the usage views');
select pg_temp.act_as(null);
select throws_ok($$ select public.consume_cardhedger_budget('search') $$, '42501', null, 'nor can anon');
reset role;

-- ── Ledger and views ──
insert into public.cardhedger_calls (caller, endpoint, endpoint_class, scheduled, status, duration_ms, retries, rate_limited, budget_denied)
values ('tracked-price-refresh', 'card-search', 'search', true,  200, 100, 0, false, false),
       ('tracked-price-refresh', 'card-search', 'search', true,  200, 300, 2, true,  false),
       ('tracked-price-refresh', 'card-search', 'search', true,  null, null, 0, false, true),
       ('price-charting',        'card-search', 'search', false, 500, 50,  3, false, false);

select is((select row(calls, scheduled_calls, budget_denied, rate_limited, retries)::text
             from public.cardhedger_usage_today where caller = 'tracked-price-refresh'),
          '(2,2,1,1,2)', 'today''s view counts calls, denials, 429s and retries per caller');
select is((select errors from public.cardhedger_usage_today where caller = 'price-charting'), 1,
          'live callers are included, with their errors');
select is((select class_used from public.cardhedger_usage_today where caller = 'price-charting'), 10,
          'each row carries its class''s budget use');
select is((select used from public.cardhedger_usage_daily
            where endpoint_class = 'search' and day = (now() at time zone 'utc')::date), 10,
          'the daily view shows today');

-- ── Run statuses ──
select lives_ok($$ insert into public.price_refresh_runs (req_id, status) values ('zzyx-ch', 'budget_exhausted') $$,
  'price refresh runs can end budget_exhausted');
select lives_ok($$ insert into public.enrichment_runs (req_id, status) values ('zzyx-ch', 'rate_limited'),
                                                                              ('zzyx-ch', 'budget_exhausted') $$,
  'enrichment runs can end rate_limited or budget_exhausted');

-- ── Alerts ──
create temp table raised as select admin.send_ops_alerts() as keys;
select ok((select keys from raised) @> array['run.budget_exhausted:tracked-price-refresh',
                                              'run.budget_exhausted:card-enrichment-backfill',
                                              'budget.80:search'],
          'stopped runs and a budget past 80% raise alerts');
select is((select count(*)::int from public.notifications
            where user_id = '11130000-0000-0000-0000-0000000000a1' and type = 'ops_alert'
              and category = 'system'),
          cardinality((select keys from raised)), 'each alert notifies ops');
select is((select count(*)::int from public.notifications
            where user_id = '11130000-0000-0000-0000-0000000000a2' and type = 'ops_alert'),
          0, 'editors are not notified');
select is(admin.send_ops_alerts(), '{}'::text[], 'an alert is sent at most once a day');

-- ── Console ──
select pg_temp.act_as('11130000-0000-0000-0000-0000000000a2');
select throws_ok($$ select admin.cardhedger_usage_overview() $$, '42501', null, 'an editor cannot read CardHedger usage');
select pg_temp.act_as('11130000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(admin.cardhedger_usage_overview() -> 'budget'), 4, 'ops sees the budget per class');
select is(admin.set_cardhedger_budget('search', 6000) ->> 'daily_limit', '6000', 'ops can change a limit');
select throws_ok($$ select admin.set_cardhedger_budget('search', -1) $$, '22023', null, 'a negative limit is refused');
reset role;

select * from finish();
rollback;
