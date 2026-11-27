-- pgTAP: List for Sale, asking prices and linked mirrors (ITS-134).
--
-- Seller S owns 3 copies of card 1 (PSA 10, holo, one photo) in PC. Buyer B wishlists it.
-- S2 already has a collection called "For Sale". Covers moving copies between PC and the
-- "For Sale" storefront, prices on every read path, holds, and the old bug where selling or
-- delisting one copy deleted the matching PC copies.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('13400000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-lfs-s@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('13400000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-lfs-s2@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('13400000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-lfs-b@test.local',  '', now(), '{}', '{}', false, false, now(), now());

select public.ensure_default_collections_for_user(u)
  from unnest(array['13400000-0000-0000-0000-0000000000a1', '13400000-0000-0000-0000-0000000000a2', '13400000-0000-0000-0000-0000000000b1']::uuid[]) as u;

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('13400000-0000-0000-0000-000000000001', 'Zzyx LFS Card 1', 'S', 'Baseball', '{"psa10": 5000}'),
       ('13400000-0000-0000-0000-000000000002', 'Zzyx LFS Card 2', 'S', 'Baseball', '{"ungraded": 800}');

create temp table ids (k text primary key, id uuid);
grant all on ids to authenticated;
insert into ids values
  ('grade', (select gc.id from public.grade_conditions gc join public.grading_companies co on co.id = gc.company_id
              where co.slug = 'psa' and gc.grade_value = 10 limit 1)),
  ('s_vault',   (select id from public.collections where user_id = '13400000-0000-0000-0000-0000000000a1' and is_vault)),
  ('s_selling', (select id from public.collections where user_id = '13400000-0000-0000-0000-0000000000a1' and is_selling)),
  ('b_wish',    (select id from public.collections where user_id = '13400000-0000-0000-0000-0000000000b1' and is_wishlist)),
  ('s2_vault',  (select id from public.collections where user_id = '13400000-0000-0000-0000-0000000000a2' and is_vault));

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company, variants)
values ('13400000-0000-0000-0000-0000000000e1', (select id from ids where k = 's_vault'), '13400000-0000-0000-0000-0000000000a1',
        'card', '13400000-0000-0000-0000-000000000001', 3, (select id from ids where k = 'grade'), 'psa', array['holo']);
insert into public.image_cache (id, storage_path, status)
values ('13400000-0000-0000-0000-0000000000c1', 'user-uploads/13400000-0000-0000-0000-0000000000a1/p.jpg', 'READY');
insert into public.collection_item_images (collection_item_id, user_id, image_cache_id, storage_path, is_primary)
values ('13400000-0000-0000-0000-0000000000e1', '13400000-0000-0000-0000-0000000000a1', '13400000-0000-0000-0000-0000000000c1',
        'user-uploads/13400000-0000-0000-0000-0000000000a1/p.jpg', true);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values ((select id from ids where k = 'b_wish'), '13400000-0000-0000-0000-0000000000b1', 'card', '13400000-0000-0000-0000-000000000001', 1);

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.qty_in(p_collection uuid, p_card uuid) returns integer language sql as $$
  select coalesce(sum(quantity), 0)::int from public.collection_items where collection_id = p_collection and ref_id = p_card
$$;

-- ── list ─────────────────────────────────────────────────────────────────────

select pg_temp.act_as('13400000-0000-0000-0000-0000000000a1');
insert into ids select 'l1', (public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 1, 4500)).id;

reset role;
insert into ids values
  ('for_sale', (select collection_id from public.collection_items where id = (select id from ids where k = 'l1'))),
  ('l1_sell',  (select id from public.collection_items where mirror_of = (select id from ids where k = 'l1'))),
  ('l1_vault', (select id from public.collection_items where mirror_of = (select id from public.collection_items where mirror_of = (select id from ids where k = 'l1'))));

select is((select name || '/' || is_storefront || '/' || is_listing_default from public.collections where id = (select id from ids where k = 'for_sale')),
  'For Sale/true/true', 'list: goes into an automatic "For Sale" storefront collection');
select ok((select is_listed and (select id from ids where k = 'for_sale') = any (collection_ids) from public.storefronts where user_id = '13400000-0000-0000-0000-0000000000a1'),
  'list: the storefront is listed and includes "For Sale"');
select is((select quantity || '/' || asking_price_cents || '/' || ref_id || '/' || (grade_condition_id = (select id from ids where k = 'grade')) || '/' || array_to_string(variants, ',')
             from public.collection_items where id = (select id from ids where k = 'l1')),
  '1/4500/13400000-0000-0000-0000-000000000001/true/holo', 'list: the listing keeps the copy''s card, grade and variants, at the asking price');
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e1'), 2, 'list: the PC row gives up one copy');
select is(pg_temp.qty_in((select id from ids where k = 's_vault'), '13400000-0000-0000-0000-000000000001'), 3, 'list: the Vault total doesn''t change (2 PC + 1 for sale)');
select is((select asking_price_cents from public.collection_items where id = (select id from ids where k = 'l1_sell')), 4500, 'list: the Selling mirror carries the asking price');
select is((select count(*) from public.collection_item_images where collection_item_id = (select id from ids where k = 'l1')), 1::bigint, 'list: the photo goes with the copy');
select is((select asking_price_cents || '/' || quantity from public._marketplace_base_listings() where collection_item_id = (select id from ids where k = 'l1')),
  '4500/1', 'marketplace: the listing shows its asking price');
select is((select current_price_cents from public._wishlist_hits('13400000-0000-0000-0000-0000000000b1') where listing_item_id = (select id from ids where k = 'l1')),
  4500, 'wishlist hits: the buyer sees the asking price');

select pg_temp.act_as('13400000-0000-0000-0000-0000000000a1');
select is((select asking_price_cents || '/' || (mirror_of = (select id from ids where k = 'l1')) from public.collection_item_query((select id from ids where k = 's_selling'), null, null, 20, false, null, null, 0)),
  '4500/true', 'collection_item_query returns the asking price and the mirror link');

-- ── validation ───────────────────────────────────────────────────────────────

select throws_ok($$ select public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 5, 4500) $$, '22023', null, 'list: can''t list more copies than the PC row has');
select throws_ok($$ select public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 1, 0) $$, '22023', null, 'list: needs an asking price above zero');
select throws_ok($$ select public.list_for_sale((select id from ids where k = 'l1_vault'), 1, 100) $$, 'P0002', null, 'list: a mirror isn''t a PC row');
select pg_temp.act_as('13400000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 1, 100) $$, 'P0002', null, 'list: can''t list someone else''s card');
select throws_ok($$ select public.set_asking_price((select id from ids where k = 'l1'), 100) $$, 'P0002', null, 'price: can''t reprice someone else''s listing');

-- ── price edits reach the whole chain ───────────────────────────────────────

select pg_temp.act_as('13400000-0000-0000-0000-0000000000a1');
select public.set_asking_price((select id from ids where k = 'l1_sell'), 5000);
select is((select string_agg(asking_price_cents::text, ',' order by id) from public.collection_items
            where id in ((select id from ids where k = 'l1'), (select id from ids where k = 'l1_sell'), (select id from ids where k = 'l1_vault'))),
  '5000,5000,5000', 'price: set from the Selling row, it reaches the listing and the Vault mirror');

-- ── unlist ───────────────────────────────────────────────────────────────────

insert into ids select 'l2', (public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 1, 3000)).id;
select is((select count(*) from public.collections where user_id = '13400000-0000-0000-0000-0000000000a1' and is_listing_default), 1::bigint,
  'list again: reuses the same "For Sale" collection');
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e1'), 1, 'list again: PC down to 1');
select lives_ok($$ select public.unlist_item((select id from public.collection_items where mirror_of = (select id from public.collection_items where mirror_of = (select id from ids where k = 'l2')))) $$,
  'unlist: works from the Vault mirror');
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e1'), 2, 'unlist: the copy goes back to the PC row');
select is((select count(*) from public.collection_items where id = (select id from ids where k = 'l2') or mirror_of = (select id from ids where k = 'l2')), 0::bigint,
  'unlist: the listing and its mirrors are gone');
select is(pg_temp.qty_in((select id from ids where k = 's_vault'), '13400000-0000-0000-0000-000000000001'), 3, 'unlist: the Vault total is still 3');

-- ── holds ────────────────────────────────────────────────────────────────────

select pg_temp.act_as('13400000-0000-0000-0000-0000000000b1');
insert into ids select 'o1', (public.create_offer('13400000-0000-0000-0000-0000000000a1',
  format('[{"collection_item_id": "%s", "quantity": 1, "offered_price_per_unit": 50}]', (select id from ids where k = 'l1'))::jsonb)).id;
select pg_temp.act_as('13400000-0000-0000-0000-0000000000a1');
select public.accept_offer((select id from ids where k = 'o1'));
select throws_ok($$ select public.unlist_item((select id from ids where k = 'l1')) $$, '23514', null, 'unlist: refused while a sale holds the copy');
select throws_ok($$ delete from public.collection_items where id = (select id from ids where k = 'l1_sell') $$, '23514', null,
  'deleting the Selling mirror of a held listing is refused');
select throws_ok($$ update public.collection_items set quantity = 0 where id = (select id from ids where k = 'l1_vault') $$, '23514', null,
  'shrinking a held listing from its Vault mirror is refused');

-- ── selling the copy leaves PC alone (the old bug) ─────────────────────────

select public.mark_transaction_shipped((select id from ids where k = 'o1'));
select pg_temp.act_as('13400000-0000-0000-0000-0000000000b1');
select public.confirm_transaction_receipt((select id from ids where k = 'o1'));
reset role;
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e1'), 2, 'sale: the seller''s 2 PC copies are untouched');
select is(pg_temp.qty_in((select id from ids where k = 's_vault'), '13400000-0000-0000-0000-000000000001'), 2, 'sale: the seller''s Vault drops from 3 to 2');
select is((select count(*) from public.collection_items where id in ((select id from ids where k = 'l1'), (select id from ids where k = 'l1_sell'), (select id from ids where k = 'l1_vault'))),
  0::bigint, 'sale: the sold listing and its mirrors are gone');

-- ── mirror deletes and storefront toggles ───────────────────────────────────

select pg_temp.act_as('13400000-0000-0000-0000-0000000000a1');
insert into ids select 'l3', (public.list_for_sale('13400000-0000-0000-0000-0000000000e1', 1, 3000)).id;
delete from public.collection_items where id = (select id from public.collection_items where mirror_of = (select id from public.collection_items where mirror_of = (select id from ids where k = 'l3')));
select is((select count(*) from public.collection_items where id = (select id from ids where k = 'l3') or mirror_of = (select id from ids where k = 'l3')), 0::bigint,
  'deleting a Vault mirror removes the listing and its Selling row');
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e1'), 1, '…and leaves the PC row alone');

reset role;
insert into public.collections (id, user_id, name) values ('13400000-0000-0000-0000-0000000000d9', '13400000-0000-0000-0000-0000000000a1', 'Zzyx LFS Binder');
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('13400000-0000-0000-0000-0000000000e9', '13400000-0000-0000-0000-0000000000d9', '13400000-0000-0000-0000-0000000000a1', 'card', '13400000-0000-0000-0000-000000000002', 2);
update public.collections set is_storefront = true where id = '13400000-0000-0000-0000-0000000000d9';
select is(pg_temp.qty_in((select id from ids where k = 's_selling'), '13400000-0000-0000-0000-000000000002'), 2, 'marking a collection as a storefront mirrors its cards into Selling');
update public.collections set is_storefront = false where id = '13400000-0000-0000-0000-0000000000d9';
select is(pg_temp.qty_in((select id from ids where k = 's_selling'), '13400000-0000-0000-0000-000000000002')
          + pg_temp.qty_in((select id from ids where k = 's_vault'), '13400000-0000-0000-0000-000000000002'), 0,
  'unmarking it removes the Selling and Vault mirrors');
select is((select quantity from public.collection_items where id = '13400000-0000-0000-0000-0000000000e9'), 2, '…but keeps the cards in the collection');

-- ── name collision ───────────────────────────────────────────────────────────

insert into public.collections (user_id, name) values ('13400000-0000-0000-0000-0000000000a2', 'For Sale');
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('13400000-0000-0000-0000-0000000000f1', (select id from ids where k = 's2_vault'), '13400000-0000-0000-0000-0000000000a2', 'card', '13400000-0000-0000-0000-000000000002', 1);
select pg_temp.act_as('13400000-0000-0000-0000-0000000000a2');
select public.list_for_sale('13400000-0000-0000-0000-0000000000f1', 1, 900);
reset role;
select is((select name from public.collections where user_id = '13400000-0000-0000-0000-0000000000a2' and is_listing_default), 'For Sale 2',
  'an existing "For Sale" collection is left alone; the default gets the next free name');

select * from finish();
rollback;
