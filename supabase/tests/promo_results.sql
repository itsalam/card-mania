-- pgTAP suite for the promo results dashboard (20261117000000, ITS-194):
-- admin.promo_results and admin.promo_results_daily.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Users: an editor, an ops member, a seller, three app users (no admin role).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('19400000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-promo-results-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 6) n;
insert into public.user_profile (user_id, username)
values ('19400000-0000-0000-0000-0000000000a3', 'zzyx_results_seller')
on conflict (user_id) do nothing;
insert into admin.members (user_id, role) values
  ('19400000-0000-0000-0000-0000000000a1', 'editor'),
  ('19400000-0000-0000-0000-0000000000a2', 'ops');

-- Cards 1-4, each listed once by the seller (listing f1..f4).
insert into public.cards (id, name, set_name, genre, grades_prices, release_date, sealed)
select ('19400000-0000-0000-0000-00000000000' || n)::uuid, 'Zzyx Results Card ' || n, 'Zzyx Results Set',
       'Baseball', '{"ungraded": 1000}', '2026-01-01', false
  from generate_series(1, 4) n;
insert into public.collections (id, user_id, name, is_storefront)
values ('19400000-0000-0000-0000-0000000000c1', '19400000-0000-0000-0000-0000000000a3', 'Zzyx Results SF', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
select ('19400000-0000-0000-0000-0000000000f' || n)::uuid, '19400000-0000-0000-0000-0000000000c1',
       '19400000-0000-0000-0000-0000000000a3', 'card', ('19400000-0000-0000-0000-00000000000' || n)::uuid, 1
  from generate_series(1, 4) n;

-- Promo b1 is live and covers card 1 (pinned) and card 2 (in its section). b2 is a draft with no
-- traffic; b3 is archived but had traffic.
insert into admin.promos (id, slug, template, title, status, published_at, placement, pinned_ref_ids)
values
  ('19400000-0000-0000-0000-0000000000b1', 'zzyx-results-live', 'announcement', 'Zzyx results live',
   'published', now(), 'home_rail', array['19400000-0000-0000-0000-000000000001']::uuid[]),
  ('19400000-0000-0000-0000-0000000000b2', 'zzyx-results-draft', 'announcement', 'Zzyx results draft',
   'draft', null, 'home_rail', '{}'),
  ('19400000-0000-0000-0000-0000000000b3', 'zzyx-results-old', 'announcement', 'Zzyx results old',
   'archived', null, 'home_rail', '{}');
insert into public.marketplace_section_meta (key, title, sort_order, kind, filter)
values (admin._promo_section_key('19400000-0000-0000-0000-0000000000b1'), 'Zzyx results', 99, 'custom', '{}');
insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload)
values (admin._promo_section_key('19400000-0000-0000-0000-0000000000b1'), 1,
        '19400000-0000-0000-0000-0000000000f2',
        jsonb_build_object('ref_id', '19400000-0000-0000-0000-000000000002'));

-- Events, written directly so their times can be set.
--   impressions: users a4, a5, a6 and one anonymous session (4 sessions, 3 viewers)
--   taps:        a4 an hour ago, a5 nine days ago, the anonymous session (3 sessions, 2 tappers)
insert into admin.promo_events (promo_id, kind, session_id, user_id, created_at) values
  ('19400000-0000-0000-0000-0000000000b1', 'impression', 'zzyxSessA4', '19400000-0000-0000-0000-0000000000a4', now() - interval '2 hours'),
  ('19400000-0000-0000-0000-0000000000b1', 'impression', 'zzyxSessA5', '19400000-0000-0000-0000-0000000000a5', now() - interval '9 days'),
  ('19400000-0000-0000-0000-0000000000b1', 'impression', 'zzyxSessA6', '19400000-0000-0000-0000-0000000000a6', now() - interval '2 hours'),
  ('19400000-0000-0000-0000-0000000000b1', 'impression', 'zzyxSessAnon', null,                                 now() - interval '2 hours'),
  ('19400000-0000-0000-0000-0000000000b1', 'tap',        'zzyxSessA4', '19400000-0000-0000-0000-0000000000a4', now() - interval '1 hour'),
  ('19400000-0000-0000-0000-0000000000b1', 'tap',        'zzyxSessA5', '19400000-0000-0000-0000-0000000000a5', now() - interval '9 days'),
  ('19400000-0000-0000-0000-0000000000b1', 'tap',        'zzyxSessAnon', null,                                 now() - interval '2 hours'),
  ('19400000-0000-0000-0000-0000000000b3', 'impression', 'zzyxSessA6', '19400000-0000-0000-0000-0000000000a6', now() - interval '2 hours');
select admin.rollup_promo_events(d)
  from (select distinct (created_at at time zone 'utc')::date d from admin.promo_events
         where session_id like 'zzyxSess%') days;

-- a4 converts after the tap: wishlists card 1 (pinned), views card 2 (section), offers on card 2.
-- These don't count: a4's wishlist of card 4 (not covered), a4's wishlist of card 2 added before
-- the tap, and a5's wishlist of card 1 eight days after their tap.
insert into public.collections (id, user_id, name, is_wishlist) values
  ('19400000-0000-0000-0000-0000000000c4', '19400000-0000-0000-0000-0000000000a4', 'Zzyx WL a4', true),
  ('19400000-0000-0000-0000-0000000000c5', '19400000-0000-0000-0000-0000000000a5', 'Zzyx WL a5', true);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity, created_at) values
  ('19400000-0000-0000-0000-0000000000c4', '19400000-0000-0000-0000-0000000000a4', 'card', '19400000-0000-0000-0000-000000000001', 1, now()),
  ('19400000-0000-0000-0000-0000000000c4', '19400000-0000-0000-0000-0000000000a4', 'card', '19400000-0000-0000-0000-000000000004', 1, now()),
  ('19400000-0000-0000-0000-0000000000c4', '19400000-0000-0000-0000-0000000000a4', 'card', '19400000-0000-0000-0000-000000000002', 1, now() - interval '3 hours'),
  ('19400000-0000-0000-0000-0000000000c5', '19400000-0000-0000-0000-0000000000a5', 'card', '19400000-0000-0000-0000-000000000001', 1, now() - interval '1 day');
insert into public.recent_views (user_id, item_type, item_id, viewed_at)
values ('19400000-0000-0000-0000-0000000000a4', 'card', '19400000-0000-0000-0000-000000000002', now());
insert into public.offers (id, buyer_id, seller_id, total_amount, created_at)
values ('19400000-0000-0000-0000-0000000000d1', '19400000-0000-0000-0000-0000000000a4',
        '19400000-0000-0000-0000-0000000000a3', 10, now());
insert into public.offer_items (offer_id, collection_item_id, offered_price_per_unit)
values ('19400000-0000-0000-0000-0000000000d1', '19400000-0000-0000-0000-0000000000f2', 10);

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

create temp table r as select * from admin.promo_results() where false;
grant all on r to authenticated;

-- ── Access ──
select pg_temp.act_as('19400000-0000-0000-0000-0000000000a6');
select throws_ok($$ select * from admin.promo_results() $$, '42501', null,
  'a user without an admin role is denied');
select throws_ok($$ select * from admin.promo_results_daily('19400000-0000-0000-0000-0000000000b1') $$, '42501', null,
  'and denied the daily series');
select pg_temp.act_as(null);
select throws_ok($$ select * from admin.promo_results() $$, '42501', null, 'anon is denied');
select pg_temp.act_as('19400000-0000-0000-0000-0000000000a2');
select lives_ok($$ select * from admin.promo_results() $$, 'an ops member can read results');

-- ── Results ──
select pg_temp.act_as('19400000-0000-0000-0000-0000000000a1');
insert into r select * from admin.promo_results();

select is((select impressions from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 4,
  'impressions count every session, anonymous ones included');
select is((select taps from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 3, 'taps count sessions');
select is((select tap_rate from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 0.75, 'tap rate = taps / impressions');
select is((select viewers from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 3, 'viewers are signed-in users');
select is((select tappers from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 2, 'tappers are signed-in users');
select is((select wishlist_adds from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 1,
  'only a wishlist add of a covered card within 7 days after the tap counts');
select is((select card_views from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 1,
  'a view of a card in the promo section counts');
select is((select offers from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 1,
  'an offer on a listing of a covered card counts');
select is((select converted_users from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 1,
  'one tapper converted');
select is((select conversion_rate from r where promo_id = '19400000-0000-0000-0000-0000000000b1'), 0.5,
  'conversion rate = converted / tappers');
select ok(not exists (select 1 from r where promo_id = '19400000-0000-0000-0000-0000000000b2'),
  'a draft with no traffic is left out');
select is((select impressions from r where promo_id = '19400000-0000-0000-0000-0000000000b3'), 1,
  'an archived promo with traffic in the range is listed');
select is((select conversion_rate from r where promo_id = '19400000-0000-0000-0000-0000000000b3'), null,
  'no tappers: conversion rate is null, not zero');

-- The hand-written check from the acceptance criteria: the same numbers straight from the events.
reset role;
select is((select impressions || '/' || taps from r where promo_id = '19400000-0000-0000-0000-0000000000b1'),
  (select count(*) filter (where kind = 'impression') || '/' || count(*) filter (where kind = 'tap')
     from admin.promo_events
    where promo_id = '19400000-0000-0000-0000-0000000000b1'
      and created_at >= ((now() at time zone 'utc')::date - 29)::timestamp at time zone 'utc'),
  'impressions/taps match a count of the raw events');

-- ── Range ──
select pg_temp.act_as('19400000-0000-0000-0000-0000000000a1');
select is((select impressions from admin.promo_results(current_date - 3, null)
            where promo_id = '19400000-0000-0000-0000-0000000000b1'), 3,
  'a narrower range drops the impression from nine days ago');
select throws_ok($$ select * from admin.promo_results('2026-02-01', '2026-01-01') $$, '22023', null,
  'from after to is rejected');
select throws_ok($$ select * from admin.promo_results('2024-01-01', '2026-01-01') $$, '22023', null,
  'a range over a year is rejected');

-- ── Daily series ──
select is((select count(*)::int from admin.promo_results_daily('19400000-0000-0000-0000-0000000000b1')), 30,
  'the default series is 30 days, zero-filled');
select is((select sum(taps)::int from admin.promo_results_daily('19400000-0000-0000-0000-0000000000b1')), 3,
  'the series adds up to the total taps');
select is((select impressions from admin.promo_results_daily('19400000-0000-0000-0000-0000000000b1')
            where day = ((now() - interval '9 days') at time zone 'utc')::date), 1,
  'the day nine days ago has its one impression');

select * from finish();
rollback;
