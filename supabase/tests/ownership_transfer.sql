-- pgTAP: holds at acceptance and the server-side transfer on completion (ITS-135).
--
-- Seller S lists L1 (card 1, PSA 10, variant holo, qty 2, one photo) and L2 (card 2, qty 1)
-- in a listed storefront; both are mirrored into S's Selling and Vault. Buyer B buys L1 one
-- copy at a time; buyer B2 buys L2 and disputes. A last block replays an older transaction
-- whose stock was already removed at acceptance.

begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('13500000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-own-s@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('13500000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-own-b@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('13500000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-own-b2@test.local', '', now(), '{}', '{}', false, false, now(), now());

select public.ensure_default_collections_for_user(u)
  from unnest(array['13500000-0000-0000-0000-0000000000a1', '13500000-0000-0000-0000-0000000000b1', '13500000-0000-0000-0000-0000000000b2']::uuid[]) as u;

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('13500000-0000-0000-0000-000000000001', 'Zzyx OWN Card 1', 'S', 'Baseball', '{"psa10": 5000}'),
       ('13500000-0000-0000-0000-000000000002', 'Zzyx OWN Card 2', 'S', 'Baseball', '{"ungraded": 1000}');

create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;
insert into ids values
  ('grade', (select gc.id from public.grade_conditions gc join public.grading_companies co on co.id = gc.company_id
              where co.slug = 'psa' and gc.grade_value = 10 limit 1)),
  ('s_selling', (select id from public.collections where user_id = '13500000-0000-0000-0000-0000000000a1' and is_selling)),
  ('s_vault',   (select id from public.collections where user_id = '13500000-0000-0000-0000-0000000000a1' and is_vault)),
  ('b_vault',   (select id from public.collections where user_id = '13500000-0000-0000-0000-0000000000b1' and is_vault)),
  ('b2_vault',  (select id from public.collections where user_id = '13500000-0000-0000-0000-0000000000b2' and is_vault));

insert into public.collections (id, user_id, name, is_storefront)
values ('13500000-0000-0000-0000-0000000000d1', '13500000-0000-0000-0000-0000000000a1', 'Zzyx OWN SF', true);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('13500000-0000-0000-0000-0000000000f1', '13500000-0000-0000-0000-0000000000a1', true,
        array['13500000-0000-0000-0000-0000000000d1']::uuid[]);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company, variants)
values
  ('13500000-0000-0000-0000-0000000000e1', '13500000-0000-0000-0000-0000000000d1', '13500000-0000-0000-0000-0000000000a1',
   'card', '13500000-0000-0000-0000-000000000001', 2, (select id from ids where k = 'grade'), 'psa', array['holo']),
  ('13500000-0000-0000-0000-0000000000e2', '13500000-0000-0000-0000-0000000000d1', '13500000-0000-0000-0000-0000000000a1',
   'card', '13500000-0000-0000-0000-000000000002', 1, null, null, '{}');

insert into public.image_cache (id, storage_path, status)
values ('13500000-0000-0000-0000-0000000000c1', 'user-uploads/13500000-0000-0000-0000-0000000000a1/l1.jpg', 'READY');
insert into public.collection_item_images (collection_item_id, user_id, image_cache_id, storage_path, width, height, position, is_primary)
values ('13500000-0000-0000-0000-0000000000e1', '13500000-0000-0000-0000-0000000000a1', '13500000-0000-0000-0000-0000000000c1',
        'user-uploads/13500000-0000-0000-0000-0000000000a1/l1.jpg', 600, 840, 0, true);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- Quantity of S's mirror of card 1 in a default collection.
create function pg_temp.seller_qty(p_collection uuid, p_card uuid) returns integer language sql as $$
  select coalesce(sum(quantity), 0)::int from public.collection_items
   where collection_id = p_collection and ref_id = p_card
$$;

-- ── acceptance holds, doesn't remove ─────────────────────────────────────────

select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
insert into ids select 'o1', (public.create_offer('13500000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "13500000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 40}]')).id;

select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o1'));

reset role;
select is((select quantity || '/' || held_quantity from public.collection_items where id = '13500000-0000-0000-0000-0000000000e1'),
  '2/1', 'accept: the listing keeps both copies, one held');
select is(pg_temp.seller_qty((select id from ids where k = 's_vault'), '13500000-0000-0000-0000-000000000001'),
  2, 'accept: the seller''s Vault still has both copies');
select is((select quantity from public._marketplace_base_listings() where collection_item_id = '13500000-0000-0000-0000-0000000000e1'),
  1, 'marketplace: only the unheld copy is for sale');
select is((select transferred_at from public.transactions where offer_id = (select id from ids where k = 'o1')),
  null, 'accept: nothing transferred yet');

select pg_temp.act_as('13500000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ select public.create_offer('13500000-0000-0000-0000-0000000000a1',
       '[{"collection_item_id": "13500000-0000-0000-0000-0000000000e1", "quantity": 2, "offered_price_per_unit": 40}]') $$,
  '22023', 'Only 1 of an item in this offer are available', 'create_offer: held copies can''t be offered on'
);

select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ delete from public.collection_items where id = '13500000-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'seller can''t delete a held listing'
);
select throws_ok(
  $$ update public.collection_items set quantity = 0 where id = '13500000-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'seller can''t drop a listing below its hold'
);
select throws_ok(
  $$ update public.collection_items set grade_condition_id = null where id = '13500000-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'seller can''t change what a held listing is'
);

-- ── completion transfers ─────────────────────────────────────────────────────

select public.mark_transaction_shipped((select id from ids where k = 'o1'));
select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.confirm_transaction_receipt((select id from ids where k = 'o1')) $$, 'buyer confirms receipt');

select is(
  (select ci.quantity || '/' || (ci.grade_condition_id = (select id from ids where k = 'grade')) || '/' || ci.grading_company || '/' || array_to_string(ci.variants, ',')
     from public.collection_items ci
    where ci.collection_id = (select id from ids where k = 'b_vault') and ci.ref_id = '13500000-0000-0000-0000-000000000001'),
  '1/true/psa/holo', 'buyer''s Vault gets the copy with its grade, grading company and variants');
select is(
  (select ci.source_offer_item_id from public.collection_items ci
    where ci.collection_id = (select id from ids where k = 'b_vault') and ci.ref_id = '13500000-0000-0000-0000-000000000001'),
  (select oi.id from public.offer_items oi where oi.offer_id = (select id from ids where k = 'o1')),
  'the buyer''s row links back to the sale');
select is(
  (select img.storage_path || '/' || img.is_primary from public.collection_item_images img
     join public.collection_items ci on ci.id = img.collection_item_id
    where ci.collection_id = (select id from ids where k = 'b_vault')),
  'user-uploads/13500000-0000-0000-0000-0000000000a1/l1.jpg/true', 'the seller''s photo comes with it (same file)');
select isnt((select transferred_at from public.transactions where offer_id = (select id from ids where k = 'o1')),
  null, 'transferred_at is set');

reset role;
select is((select quantity || '/' || held_quantity from public.collection_items where id = '13500000-0000-0000-0000-0000000000e1'),
  '1/0', 'seller: the listing drops to 1 and the hold is released');
select is(pg_temp.seller_qty((select id from ids where k = 's_selling'), '13500000-0000-0000-0000-000000000001'),
  1, 'seller: Selling drops to 1');
select is(pg_temp.seller_qty((select id from ids where k = 's_vault'), '13500000-0000-0000-0000-000000000001'),
  1, 'seller: Vault drops to 1');

select public._transfer_transaction_items((select id from public.transactions where offer_id = (select id from ids where k = 'o1')));
select is((select count(*) from public.collection_items where collection_id = (select id from ids where k = 'b_vault')),
  1::bigint, 'running the transfer again adds nothing');

-- ── disputes keep the hold ───────────────────────────────────────────────────

select pg_temp.act_as('13500000-0000-0000-0000-0000000000b2');
insert into ids select 'o2', (public.create_offer('13500000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "13500000-0000-0000-0000-0000000000e2", "quantity": 1, "offered_price_per_unit": 10}]')).id;
select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o2'));
select pg_temp.act_as('13500000-0000-0000-0000-0000000000b2');
select public.dispute_transaction((select id from ids where k = 'o2'));

reset role;
select is((select held_quantity from public.collection_items where id = '13500000-0000-0000-0000-0000000000e2'),
  1, 'dispute: the copy stays on hold with the seller');
select is((select count(*) from public.collection_items where collection_id = (select id from ids where k = 'b2_vault')),
  0::bigint, 'dispute: nothing moves to the buyer');
select throws_ok(
  $$ select public._transfer_transaction_items((select id from public.transactions where offer_id = (select id from ids where k = 'o2'))) $$,
  '22023', null, 'the transfer refuses a transaction that isn''t completed'
);

-- ── selling the last copy ────────────────────────────────────────────────────

select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
insert into ids select 'o3', (public.create_offer('13500000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "13500000-0000-0000-0000-0000000000e1", "quantity": 1, "offered_price_per_unit": 40}]')).id;
select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o3'));
select public.mark_transaction_shipped((select id from ids where k = 'o3'));
select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
select public.confirm_transaction_receipt((select id from ids where k = 'o3'));

reset role;
select is(
  (select count(*) from public.collection_items
    where user_id = '13500000-0000-0000-0000-0000000000a1' and ref_id = '13500000-0000-0000-0000-000000000001'),
  0::bigint, 'last copy sold: the listing and its Selling and Vault mirrors are gone');
select is((select count(*) from public.collection_items where collection_id = (select id from ids where k = 'b_vault')),
  2::bigint, 'each purchase is its own row in the buyer''s Vault');

-- ── shared photo files ───────────────────────────────────────────────────────

select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
select is(
  public.delete_collection_item_photo((select min(img.id::text)::uuid from public.collection_item_images img where img.user_id = '13500000-0000-0000-0000-0000000000b1')),
  null, 'deleting a photo whose file another row still uses keeps the file');
select is(
  public.delete_collection_item_photo((select img.id from public.collection_item_images img where img.user_id = '13500000-0000-0000-0000-0000000000b1')),
  'user-uploads/13500000-0000-0000-0000-0000000000a1/l1.jpg', 'deleting the last photo using a file returns it for removal');
select throws_ok(
  $$ select public.delete_collection_item_photo('13500000-0000-0000-0000-0000000000c1') $$,
  'P0002', null, 'can''t delete a photo that isn''t yours'
);

-- ── older transactions (stock removed at acceptance) ─────────────────────────

reset role;
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('13500000-0000-0000-0000-0000000000e3', '13500000-0000-0000-0000-0000000000d1', '13500000-0000-0000-0000-0000000000a1',
        'card', '13500000-0000-0000-0000-000000000002', 1);
select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
insert into ids select 'o4', (public.create_offer('13500000-0000-0000-0000-0000000000a1',
  '[{"collection_item_id": "13500000-0000-0000-0000-0000000000e3", "quantity": 1, "offered_price_per_unit": 10,
     "card_snapshot": {"card_id": "13500000-0000-0000-0000-000000000002"}}]')).id;
select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o4'));
-- Make it look like a pre-ITS-135 sale: no hold, listing already gone.
reset role;
update public.transactions set holds_stock = false where offer_id = (select id from ids where k = 'o4');
update public.collection_items set held_quantity = 0 where id = '13500000-0000-0000-0000-0000000000e3';
delete from public.collection_items where id = '13500000-0000-0000-0000-0000000000e3';
select pg_temp.act_as('13500000-0000-0000-0000-0000000000a1');
select public.mark_transaction_shipped((select id from ids where k = 'o4'));
select pg_temp.act_as('13500000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.confirm_transaction_receipt((select id from ids where k = 'o4')) $$, 'older sale: buyer confirms receipt');
select is(
  (select count(*) from public.collection_items
    where collection_id = (select id from ids where k = 'b_vault') and ref_id = '13500000-0000-0000-0000-000000000002'),
  1::bigint, 'older sale: the buyer gets the card from the offer snapshot');

reset role;
select is((select held_quantity from public.collection_items where id = '13500000-0000-0000-0000-0000000000e2'),
  1, 'older sale: other listings are untouched');

select * from finish();
rollback;
