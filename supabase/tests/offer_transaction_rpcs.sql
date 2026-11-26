-- pgTAP suite for the offer/transaction RPCs (20261123000000, ITS-121 + ITS-122).
--
-- Fixtures: seller S lists item L1 (qty 2) and L2 (qty 1) in a listed storefront, and holds
-- L3 in a non-storefront collection (unlisted). Buyers B1, B2 make offers; X is an unrelated
-- user. Each block switches to the `authenticated` role with that
-- user's JWT claims, as PostgREST would.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('12100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-otx-s@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('12100000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-otx-b1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('12100000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-otx-b2@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('12100000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-otx-x@test.local',  '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('12100000-0000-0000-0000-000000000001', 'Zzyx OTX Card 1', 'S', 'Baseball', '{"ungraded": 1000}'),
       ('12100000-0000-0000-0000-000000000002', 'Zzyx OTX Card 2', 'S', 'Baseball', '{"ungraded": 1000}');

insert into public.collections (id, user_id, name, is_storefront)
values ('12100000-0000-0000-0000-0000000000d1', '12100000-0000-0000-0000-0000000000a1', 'Zzyx OTX SF', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values
  ('12100000-0000-0000-0000-0000000000e1', '12100000-0000-0000-0000-0000000000d1', '12100000-0000-0000-0000-0000000000a1', 'card', '12100000-0000-0000-0000-000000000001', 2),
  ('12100000-0000-0000-0000-0000000000e2', '12100000-0000-0000-0000-0000000000d1', '12100000-0000-0000-0000-0000000000a1', 'card', '12100000-0000-0000-0000-000000000002', 1);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- Offers created by the tests, shared across role switches.
create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;

-- ── create_offer ─────────────────────────────────────────────────────────────

-- Before the seller has a listed storefront, nothing of theirs is offerable.
select pg_temp.act_as('12100000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000a1',
       '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 5}]') $$,
  '22023', 'An item in this offer is not listed for sale', 'create_offer: rejects an item with no listed storefront'
);

reset role;
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('12100000-0000-0000-0000-0000000000f1', '12100000-0000-0000-0000-0000000000a1', true,
        array['12100000-0000-0000-0000-0000000000d1']::uuid[]);
insert into public.collections (id, user_id, name)
values ('12100000-0000-0000-0000-0000000000d2', '12100000-0000-0000-0000-0000000000a1', 'Zzyx OTX Private');
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('12100000-0000-0000-0000-0000000000e3', '12100000-0000-0000-0000-0000000000d2', '12100000-0000-0000-0000-0000000000a1', 'card', '12100000-0000-0000-0000-000000000002', 1);

select pg_temp.act_as('12100000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000a1',
       '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e3", "quantity": 1, "offered_price_per_unit": 5}]') $$,
  '22023', 'An item in this offer is not listed for sale', 'create_offer: rejects an unlisted item (not in a storefront collection)'
);

insert into ids select 'o1', (public.create_offer(
  '12100000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e1", "quantity": 2, "offered_price_per_unit": 5}]'
)).id;

select is((select status from public.offers where id = (select id from ids where k = 'o1')), 'pending', 'create_offer: offer starts pending');
select is((select total_amount from public.offers where id = (select id from ids where k = 'o1')), 10.00::numeric, 'create_offer: total defaults to the item sum');
select is((select count(*) from public.offer_items where offer_id = (select id from ids where k = 'o1')), 1::bigint, 'create_offer: items are written with the offer');

select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000a1',
       '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e2", "quantity": 2, "offered_price_per_unit": 5}]') $$,
  '22023', null, 'create_offer: rejects a quantity above stock'
);
select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000c1',
       '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 5}]') $$,
  'P0002', null, 'create_offer: rejects an item the named seller does not own'
);
select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000a1', '[]') $$,
  '22023', null, 'create_offer: rejects an empty offer'
);
select throws_ok(
  $$ select public.create_offer('12100000-0000-0000-0000-0000000000a1',
       '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e1", "quantity": 0, "offered_price_per_unit": 5}]') $$,
  '22023', null, 'create_offer: rejects a zero quantity'
);

-- Direct writes are gone.
select throws_ok(
  $$ insert into public.offers (buyer_id, seller_id, total_amount, status)
     values ('12100000-0000-0000-0000-0000000000b1', '12100000-0000-0000-0000-0000000000a1', 1, 'accepted') $$,
  '42501', null, 'direct insert into offers is denied'
);
select throws_ok(
  $$ update public.offers set status = 'accepted' where id = (select id from ids where k = 'o1') $$,
  '42501', null, 'buyer cannot update an offer status directly'
);
select throws_ok(
  $$ select public.accept_offer((select id from ids where k = 'o1')) $$,
  '42501', null, 'buyer cannot accept their own offer'
);
select throws_ok(
  $$ select public.decline_offer((select id from ids where k = 'o1')) $$,
  '42501', null, 'buyer cannot decline (that is the seller''s move)'
);

-- B1 also bids on L2 (qty 1) in a second offer.
insert into ids select 'o_l2_b1', (public.create_offer(
  '12100000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 3}]',
  'please', 2.5
)).id;
select is((select total_amount from public.offers where id = (select id from ids where k = 'o_l2_b1')), 2.50::numeric, 'create_offer: honours a total override');

-- B2: one offer competing for L1 (1 unit), one for L2.
select pg_temp.act_as('12100000-0000-0000-0000-0000000000b2');
insert into ids select 'o_l1_b2', (public.create_offer(
  '12100000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 6}]'
)).id;
insert into ids select 'o_l2_b2', (public.create_offer(
  '12100000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "12100000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 4}]'
)).id;

-- An outsider can't see or touch any of it.
select pg_temp.act_as('12100000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select public.cancel_offer((select id from ids where k = 'o1')) $$,
  'P0002', null, 'non-participant gets "not found"'
);

-- ── accept / decline / cancel ───────────────────────────────────────────────

select pg_temp.act_as('12100000-0000-0000-0000-0000000000a1');

-- Seller accepts B2's single unit of L1 first: one copy is held (ITS-135), leaving 1
-- available, so B1's offer for 2 can no longer be filled and is auto-declined.
select lives_ok($$ select public.accept_offer((select id from ids where k = 'o_l1_b2')) $$, 'seller accepts a pending offer');
select is((select status from public.offers where id = (select id from ids where k = 'o_l1_b2')), 'accepted', 'accept_offer: offer is accepted');
select is((select count(*) from public.transactions where offer_id = (select id from ids where k = 'o_l1_b2')), 1::bigint, 'accept_offer: transaction created in the same call');
select is((select quantity - held_quantity from public.collection_items where id = '12100000-0000-0000-0000-0000000000e1'), 1, 'accept_offer: accepted copies are held, not available');
select is((select status from public.offers where id = (select id from ids where k = 'o1')), 'declined', 'accept_offer: competitor the stock can no longer fill is declined');

select throws_ok(
  $$ select public.accept_offer((select id from ids where k = 'o_l1_b2')) $$,
  '22023', null, 'cannot accept an already-accepted offer'
);

-- L2: accept B1, which holds the last unit and declines B2's L2 offer.
select lives_ok($$ select public.accept_offer((select id from ids where k = 'o_l2_b1')) $$, 'seller accepts the last unit');
select is((select status from public.offers where id = (select id from ids where k = 'o_l2_b2')), 'declined', 'accept_offer: competitor on a sold-out listing is declined');

-- ── transactions ────────────────────────────────────────────────────────────

-- Buyer cannot ship, and cannot jump straight to completed.
select pg_temp.act_as('12100000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ select public.mark_transaction_shipped((select id from ids where k = 'o_l1_b2')) $$,
  '42501', null, 'buyer cannot mark shipped'
);
select throws_ok(
  $$ select public.confirm_transaction_receipt((select id from ids where k = 'o_l1_b2')) $$,
  '22023', null, 'buyer cannot complete a transaction that has not shipped'
);
select throws_ok(
  $$ update public.transactions set status = 'completed' where offer_id = (select id from ids where k = 'o_l1_b2') $$,
  '42501', null, 'buyer cannot update a transaction status directly'
);
select lives_ok(
  $$ select public.set_transaction_shipping_address((select id from ids where k = 'o_l1_b2'),
       '{"street": "1 Main", "city": "X", "state": "Y", "postal_code": "0", "country": "US"}') $$,
  'buyer sets the shipping address while pending'
);

select pg_temp.act_as('12100000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.set_transaction_shipping_address((select id from ids where k = 'o_l1_b2'), '{"street": "x"}') $$,
  '42501', null, 'seller cannot set the buyer''s shipping address'
);
select lives_ok($$ select public.mark_transaction_shipped((select id from ids where k = 'o_l1_b2')) $$, 'seller marks shipped');
select throws_ok(
  $$ select public.confirm_transaction_receipt((select id from ids where k = 'o_l1_b2')) $$,
  '42501', null, 'seller cannot confirm receipt'
);

select pg_temp.act_as('12100000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.confirm_transaction_receipt((select id from ids where k = 'o_l1_b2')) $$, 'buyer confirms receipt');
select is(
  (select t.status || '/' || o.status from public.transactions t join public.offers o on o.id = t.offer_id
    where t.offer_id = (select id from ids where k = 'o_l1_b2')),
  'completed/completed',
  'confirm_transaction_receipt: transaction and offer both completed'
);
select throws_ok(
  $$ select public.dispute_transaction((select id from ids where k = 'o_l1_b2')) $$,
  '22023', null, 'cannot dispute a completed transaction'
);

-- Either party can dispute an open transaction.
select pg_temp.act_as('12100000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.dispute_transaction((select id from ids where k = 'o_l2_b1')) $$, 'buyer disputes an open transaction');

select * from finish();
rollback;
