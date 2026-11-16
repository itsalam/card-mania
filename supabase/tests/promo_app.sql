-- pgTAP suite for the app side of promo boxes (20261116000000, ITS-192):
-- record_promo_event, set_promo_interest / get_my_promo_interests, the daily rollup, the Home slot.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('19200000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-app-1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('19200000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-app-2@test.local', '', now(), '{}', '{}', false, false, now(), now());

-- One live promo, one draft, one that ended.
insert into admin.promos (id, slug, template, title, status, published_at, starts_at, ends_at, placement)
values
  ('19200000-0000-0000-0000-0000000000b1', 'zzyx-live',  'announcement', 'Zzyx live',  'published', now(), null, null, 'home_rail'),
  ('19200000-0000-0000-0000-0000000000b2', 'zzyx-draft', 'announcement', 'Zzyx draft', 'draft',     null,  null, null, 'home_rail'),
  ('19200000-0000-0000-0000-0000000000b3', 'zzyx-ended', 'announcement', 'Zzyx ended', 'published', now() - interval '2 days',
   now() - interval '2 days', now() - interval '1 day', 'home_rail');

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

-- ── Home slot ──
select is((select sort_order from public.home_feed_section_meta where key = 'promos'), -10,
  'promos slot sits above the other Home sections');
select ok(exists (select 1 from public.get_home_feed_sections() where key = 'promos'),
  'get_home_feed_sections returns the promos slot');

-- ── Events ──
select pg_temp.act_as(null);
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'impression', 'sessAAAA1111', 'home_rail'), true,
  'anon records an impression on a live promo');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'impression', 'sessAAAA1111', 'home_rail'), false,
  'the same impression in the same session is deduplicated');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'tap', 'sessAAAA1111'), true,
  'a tap is recorded separately from the impression');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'tap', 'sessAAAA1111'), false,
  'taps are deduplicated per session too');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b2', 'impression', 'sessAAAA1111'), false,
  'a draft is never counted');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b3', 'impression', 'sessAAAA1111'), false,
  'an ended promo is never counted');
select throws_ok($$ select public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'click', 'sessAAAA1111') $$,
  '22023', null, 'an unknown event kind is rejected');
select throws_ok($$ select public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'tap', 'x y') $$,
  '22023', null, 'a malformed session id is rejected');
select throws_ok($$ select count(*) from admin.promo_events $$, '42501', null,
  'anon cannot read the events table');

select pg_temp.act_as('19200000-0000-0000-0000-0000000000a1');
select is(public.record_promo_event('19200000-0000-0000-0000-0000000000b1', 'impression', 'sessBBBB2222', 'home_hero'), true,
  'a signed-in user records an impression in another session');
reset role;
select is((select user_id from admin.promo_events where session_id = 'sessBBBB2222'),
  '19200000-0000-0000-0000-0000000000a1'::uuid, 'the event records the signed-in user');
select is((select count(*)::int from admin.promo_events where promo_id = '19200000-0000-0000-0000-0000000000b1'), 3,
  'three events landed: two impressions, one tap');

-- ── Rollup ──
select is(admin.rollup_promo_events((now() at time zone 'utc')::date), 2, 'rollup writes one row per promo and kind');
select is((select sessions || '/' || users from admin.promo_event_daily
            where promo_id = '19200000-0000-0000-0000-0000000000b1' and kind = 'impression'),
  '2/1', 'impressions: 2 sessions, 1 signed-in user');
select is(admin.rollup_promo_events((now() at time zone 'utc')::date), 2, 'rerunning the rollup is idempotent');

-- ── Notify me ──
select pg_temp.act_as(null);
select throws_ok($$ select public.set_promo_interest('19200000-0000-0000-0000-0000000000b1', true) $$,
  '42501', null, 'anon cannot ask to be notified');

select pg_temp.act_as('19200000-0000-0000-0000-0000000000a1');
select is(public.set_promo_interest('19200000-0000-0000-0000-0000000000b1', true), true, 'a user turns Notify me on');
select is(array(select public.get_my_promo_interests()), array['19200000-0000-0000-0000-0000000000b1'::uuid],
  'and sees it in their interests');
select throws_ok($$ select public.set_promo_interest('19200000-0000-0000-0000-0000000000b2', true) $$,
  'P0002', null, 'a draft cannot be followed');

select pg_temp.act_as('19200000-0000-0000-0000-0000000000a2');
select is(array(select public.get_my_promo_interests()), '{}'::uuid[], 'another user sees none of it');

select * from finish();
rollback;
