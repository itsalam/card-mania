-- pgTAP suite for the offer state machine (20261124000000, ITS-140/142/143).
--
-- Fixtures: seller S lists L1 (qty 1) and L2 (qty 3) in a listed storefront. Buyers B1, B2.
-- Each block switches to the `authenticated` role with that user's JWT claims.

begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('14000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-osm-s@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('14000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-osm-b1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('14000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-osm-b2@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('14000000-0000-0000-0000-000000000001', 'Zzyx OSM Card 1', 'S', 'Baseball', '{"ungraded": 1000}'),
       ('14000000-0000-0000-0000-000000000002', 'Zzyx OSM Card 2', 'S', 'Baseball', '{"ungraded": 1000}');

insert into public.collections (id, user_id, name, is_storefront)
values ('14000000-0000-0000-0000-0000000000d1', '14000000-0000-0000-0000-0000000000a1', 'Zzyx OSM SF', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values
  ('14000000-0000-0000-0000-0000000000e1', '14000000-0000-0000-0000-0000000000d1', '14000000-0000-0000-0000-0000000000a1', 'card', '14000000-0000-0000-0000-000000000001', 1),
  ('14000000-0000-0000-0000-0000000000e2', '14000000-0000-0000-0000-0000000000d1', '14000000-0000-0000-0000-0000000000a1', 'card', '14000000-0000-0000-0000-000000000002', 3);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('14000000-0000-0000-0000-0000000000f1', '14000000-0000-0000-0000-0000000000a1', true,
        array['14000000-0000-0000-0000-0000000000d1']::uuid[]);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;

-- ── schema ───────────────────────────────────────────────────────────────────

select has_column('public', 'offers', 'expires_at', 'offers.expires_at exists');
select has_table('public', 'offer_revisions', 'offer_revisions exists');
select is(
  (select count(*)::int from cron.job where jobname = 'expire-offers' and active),
  1, 'expire-offers cron job is scheduled'
);

-- ── create: revision 1 and a 72h window ─────────────────────────────────────

select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
insert into ids select 'o1', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 1000}]',
  'first offer'
)).id;

select is(
  (select count(*)::int from public.offer_revisions where offer_id = (select id from ids where k = 'o1')),
  1, 'create_offer: the original offer is revision 1'
);
select is(
  (select author_role || '/' || total_amount::text || '/' || note from public.offer_revisions where offer_id = (select id from ids where k = 'o1')),
  'buyer/1000.00/first offer', 'create_offer: revision 1 records the buyer''s amount and note'
);
select ok(
  (select expires_at between now() + interval '71 hours 59 minutes' and now() + interval '72 hours 1 minute'
     from public.offers where id = (select id from ids where k = 'o1')),
  'create_offer: expires 72 hours out'
);

-- ── turn rules ──────────────────────────────────────────────────────────────

-- Pending waits on the seller: the buyer can't counter or accept their own offer.
select throws_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 900) $$,
  '42501', 'Only the seller can counter this offer', 'buyer cannot counter a pending offer'
);
select throws_ok(
  $$ select public.accept_offer((select id from ids where k = 'o1')) $$,
  '42501', 'Only the seller can accept this offer', 'buyer cannot accept a pending offer'
);
select throws_ok(
  $$ insert into public.offer_revisions (offer_id, author_id, author_role, total_amount)
     values ((select id from ids where k = 'o1'), '14000000-0000-0000-0000-0000000000b1', 'buyer', 1) $$,
  '42501', null, 'direct insert into offer_revisions is denied'
);

-- ── seller counters ─────────────────────────────────────────────────────────

select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 1000) $$,
  '22023', 'A counteroffer must change the price; accept the offer instead', 'counter must change the price'
);
select throws_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 0) $$,
  '22023', 'A counteroffer needs a price above zero', 'counter must be above zero'
);

-- Age the window so we can see the counter reset it.
reset role;
update public.offers set expires_at = now() + interval '1 hour' where id = (select id from ids where k = 'o1');
select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 1200, 'meet me at 12') $$,
  'seller counters a pending offer'
);
select is(
  (select status || '/' || total_amount::text from public.offers where id = (select id from ids where k = 'o1')),
  'countered/1200.00', 'counter_offer: seller counter moves the offer to countered with the new total'
);
select ok(
  (select expires_at > now() + interval '71 hours' from public.offers where id = (select id from ids where k = 'o1')),
  'counter_offer: resets the response window'
);
select is(
  (select author_role || '/' || total_amount::text || '/' || note
     from public.offer_revisions where offer_id = (select id from ids where k = 'o1')
    order by created_at desc, author_role desc limit 1),
  'seller/1200.00/meet me at 12', 'counter_offer: writes a seller revision'
);
reset role;
select is(
  (select count(*)::int from public.notifications
    where user_id = '14000000-0000-0000-0000-0000000000b1' and type = 'offer_countered'
      and payload->>'offer_id' = (select id::text from ids where k = 'o1')),
  1, 'counter_offer: buyer is notified of the counter'
);
select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');

-- Countered waits on the buyer.
select throws_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 1300) $$,
  '42501', 'Only the buyer can counter this counteroffer', 'seller cannot counter their own counter'
);
select throws_ok(
  $$ select public.accept_offer((select id from ids where k = 'o1')) $$,
  '42501', 'Only the buyer can accept this counteroffer', 'seller cannot accept their own counter'
);

-- ── buyer counters back, seller counters again, buyer accepts ───────────────

select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 1100) $$,
  'buyer counters the counter'
);
select is(
  (select status from public.offers where id = (select id from ids where k = 'o1')),
  'pending', 'counter_offer: buyer counter moves the offer back to pending'
);
reset role;
select is(
  (select count(*)::int from public.notifications
    where user_id = '14000000-0000-0000-0000-0000000000a1' and type = 'offer_countered'
      and payload->>'offer_id' = (select id::text from ids where k = 'o1')),
  1, 'counter_offer: seller is notified of the buyer''s counter'
);
select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');

select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select public.counter_offer((select id from ids where k = 'o1'), 1150) $$,
  'seller counters again (no round limit)'
);
select is(
  (select count(*)::int from public.offer_revisions where offer_id = (select id from ids where k = 'o1')),
  4, 'offer_revisions: every proposal is kept'
);

-- B2 opens a competing offer on the same single-unit listing, and the seller counters it.
select pg_temp.act_as('14000000-0000-0000-0000-0000000000b2');
insert into ids select 'o_comp', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 800}]'
)).id;
select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.counter_offer((select id from ids where k = 'o_comp'), 1000) $$, 'seller counters the competitor too');

-- The history a buyer can see is limited to their own offers.
select pg_temp.act_as('14000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.offer_revisions where offer_id = (select id from ids where k = 'o1')),
  0, 'offer_revisions: other buyers cannot read an offer''s history'
);

select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.accept_offer((select id from ids where k = 'o1')) $$, 'buyer accepts the counter');
select is(
  (select o.status || '/' || o.total_amount::text || '/' || t.status
     from public.offers o join public.transactions t on t.offer_id = o.id
    where o.id = (select id from ids where k = 'o1')),
  'accepted/1150.00/pending', 'accept_offer: buyer accepting a counter is binding (transaction at the countered total)'
);
reset role;
select is(
  (select count(*)::int from public.notifications
    where user_id = '14000000-0000-0000-0000-0000000000a1' and type = 'offer_accepted'
      and payload->>'offer_id' = (select id::text from ids where k = 'o1')),
  1, 'accept_offer: seller is notified the buyer accepted their counter'
);
select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
reset role;
select is(
  (select status from public.offers where id = (select id from ids where k = 'o_comp')),
  'declined', 'accept_offer: a countered competitor the stock can no longer fill is declined'
);
select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.cancel_offer((select id from ids where k = 'o1')) $$,
  '22023', 'Cannot cancel an offer that is accepted', 'buyer cannot back out once accepted'
);

-- ── walking away mid-negotiation ────────────────────────────────────────────

select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
insert into ids select 'o2', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 500}]'
)).id;
insert into ids select 'o3', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 500}]'
)).id;

select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.counter_offer((select id from ids where k = 'o2'), 700) $$, 'seller counters o2');
select lives_ok($$ select public.counter_offer((select id from ids where k = 'o3'), 700) $$, 'seller counters o3');
select lives_ok($$ select public.decline_offer((select id from ids where k = 'o2')) $$, 'seller can withdraw (decline) their own counter');

select pg_temp.act_as('14000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.cancel_offer((select id from ids where k = 'o3')) $$, 'buyer can walk away from a counter');

-- ── expiry ──────────────────────────────────────────────────────────────────

insert into ids select 'o4', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 500}]'
)).id;
insert into ids select 'o5', (public.create_offer(
  '14000000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "14000000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 500}]'
)).id;

reset role;
update public.offers set expires_at = now() - interval '1 minute'
 where id in (select id from ids where k in ('o4', 'o5'));

-- Before the job runs, a lapsed offer can't be accepted or countered.
select pg_temp.act_as('14000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.accept_offer((select id from ids where k = 'o4')) $$,
  '22023', 'This offer has expired', 'accept_offer: rejects a lapsed offer before the expirer runs'
);
select throws_ok(
  $$ select public.counter_offer((select id from ids where k = 'o4'), 900) $$,
  '22023', 'This offer has expired', 'counter_offer: rejects a lapsed offer before the expirer runs'
);

select throws_ok(
  $$ select public.expire_offers() $$,
  '42501', null, 'authenticated users cannot run the expirer'
);

reset role;
select is(public.expire_offers(), 2, 'expire_offers: expires exactly the two lapsed open offers');
select is(
  (select count(*)::int from public.offers where id in (select id from ids where k in ('o4', 'o5')) and status = 'expired'),
  2, 'expire_offers: lapsed offers are expired'
);
select is(
  (select count(*)::int from public.notifications
    where type = 'offer_expired' and payload->>'offer_id' = (select id::text from ids where k = 'o4')),
  2, 'expire_offers: buyer and seller are both notified'
);
select is(public.expire_offers(), 0, 'expire_offers: idempotent');

select * from finish();
rollback;
