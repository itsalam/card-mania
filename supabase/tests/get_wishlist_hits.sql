-- pgTAP suite for _wishlist_hits / get_wishlist_hits (20261025000004_wishlist_hits_rpc.sql).
--
-- Fixtures: a buyer wishlists card A at any grade and card B at PSA 10. A seller lists A raw,
-- A PSA 10, B PSA 10, B PSA 9, plus a quantity-0 A. A second seller lists another raw A (to
-- collapse). An unlisted storefront and the buyer's own storefront also list A.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into public.cards (id, name, set_name, genre, grades_prices)
values
  ('25000000-0000-0000-0000-00000000000a', 'Zzyx Hit Card A', 'S', 'Baseball', '{"ungraded": 800, "psa10": 9000}'),
  ('25000000-0000-0000-0000-00000000000b', 'Zzyx Hit Card B', 'S', 'Baseball', '{"psa10": 5000, "psa9": 2000}');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('25000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-hits-buyer@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('25000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-hits-seller@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('25000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-hits-seller2@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('25000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-hits-unlisted@test.local', '', now(), '{}', '{}', false, false, now(), now());

create temp table g as
  select (select gcnd.id from public.grade_conditions gcnd join public.grading_companies gc on gc.id = gcnd.company_id
           where gc.slug = 'psa' and gcnd.grade_value = 10 limit 1) as psa10,
         (select gcnd.id from public.grade_conditions gcnd join public.grading_companies gc on gc.id = gcnd.company_id
           where gc.slug = 'psa' and gcnd.grade_value = 9 limit 1) as psa9;

-- Buyer wishlist (snapshot captured by trigger at insert: A raw 800, B psa10 5000).
insert into public.collections (id, user_id, name, is_wishlist)
values ('25000000-0000-0000-0000-0000000000c1', '25000000-0000-0000-0000-0000000000a1', 'Zzyx Hits Wishlist', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id)
values
  ('25000000-0000-0000-0000-0000000000d1', '25000000-0000-0000-0000-0000000000c1', '25000000-0000-0000-0000-0000000000a1', 'card', '25000000-0000-0000-0000-00000000000a', 1, null),
  ('25000000-0000-0000-0000-0000000000d2', '25000000-0000-0000-0000-0000000000c1', '25000000-0000-0000-0000-0000000000a1', 'card', '25000000-0000-0000-0000-00000000000b', 1, (select psa10 from g));

-- Prices drop after wishlisting: A raw 800 → 600 (25% savings).
update public.cards set grades_prices = '{"ungraded": 600, "psa10": 9000}' where id = '25000000-0000-0000-0000-00000000000a';

create or replace function pg_temp.storefront(p_user uuid, p_col uuid, p_sf uuid, p_listed boolean)
returns void language sql as $$
  insert into public.collections (id, user_id, name, is_storefront) values (p_col, p_user, 'Zzyx SF ' || p_col, true);
  insert into public.storefronts (id, user_id, is_listed, collection_ids, listed_at)
  values (p_sf, p_user, p_listed, array[p_col], now() - interval '1 day');
$$;
select pg_temp.storefront('25000000-0000-0000-0000-0000000000a2', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000e2', true);
select pg_temp.storefront('25000000-0000-0000-0000-0000000000a3', '25000000-0000-0000-0000-0000000000c3', '25000000-0000-0000-0000-0000000000e3', true);
select pg_temp.storefront('25000000-0000-0000-0000-0000000000a4', '25000000-0000-0000-0000-0000000000c4', '25000000-0000-0000-0000-0000000000e4', false);
select pg_temp.storefront('25000000-0000-0000-0000-0000000000a1', '25000000-0000-0000-0000-0000000000c5', '25000000-0000-0000-0000-0000000000e5', true);
update public.storefronts set listed_at = now() where id = '25000000-0000-0000-0000-0000000000e3';

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, grade_condition_id, grading_company)
values
  ('25000000-0000-0000-0000-0000000000f1', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000a2', 'card', '25000000-0000-0000-0000-00000000000a', 1, null, null),
  ('25000000-0000-0000-0000-0000000000f2', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000a2', 'card', '25000000-0000-0000-0000-00000000000a', 1, (select psa10 from g), 'psa'),
  ('25000000-0000-0000-0000-0000000000f3', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000a2', 'card', '25000000-0000-0000-0000-00000000000b', 1, (select psa10 from g), 'psa'),
  ('25000000-0000-0000-0000-0000000000f4', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000a2', 'card', '25000000-0000-0000-0000-00000000000b', 1, (select psa9 from g), 'psa'),
  ('25000000-0000-0000-0000-0000000000f5', '25000000-0000-0000-0000-0000000000c2', '25000000-0000-0000-0000-0000000000a2', 'card', '25000000-0000-0000-0000-00000000000a', 0, null, null),
  ('25000000-0000-0000-0000-0000000000f6', '25000000-0000-0000-0000-0000000000c3', '25000000-0000-0000-0000-0000000000a3', 'card', '25000000-0000-0000-0000-00000000000a', 1, null, null),
  ('25000000-0000-0000-0000-0000000000f7', '25000000-0000-0000-0000-0000000000c4', '25000000-0000-0000-0000-0000000000a4', 'card', '25000000-0000-0000-0000-00000000000a', 1, null, null),
  ('25000000-0000-0000-0000-0000000000f8', '25000000-0000-0000-0000-0000000000c5', '25000000-0000-0000-0000-0000000000a1', 'card', '25000000-0000-0000-0000-00000000000a', 1, null, null);

create temp table t_raw as
  select listing_item_id from public._wishlist_hits('25000000-0000-0000-0000-0000000000a1');

select is(
  (select array_agg(listing_item_id order by listing_item_id) from t_raw),
  array['25000000-0000-0000-0000-0000000000f1', '25000000-0000-0000-0000-0000000000f2',
        '25000000-0000-0000-0000-0000000000f3', '25000000-0000-0000-0000-0000000000f6']::uuid[],
  'grade matrix: any-grade matches raw + PSA 10; PSA 10 matches only PSA 10; qty 0, unlisted and own storefront excluded'
);
select is(
  (select count(*) from t_raw r
    where not exists (select 1 from public._marketplace_base_listings() b where b.collection_item_id = r.listing_item_id)),
  0::bigint,
  'every hit listing is also a _marketplace_base_listings listing'
);

-- Client RPC as the buyer.
select set_config('request.jwt.claims', json_build_object('sub', '25000000-0000-0000-0000-0000000000a1')::text, true);
set local role authenticated;
create temp table t_hits as select *, row_number() over () as rnk from public.get_wishlist_hits(100);
reset role;

select is((select count(*) from t_hits), 3::bigint, 'one row per card + grade (raw A collapsed across two sellers)');
select is(
  (select listing_item_id from t_hits where ref_id = '25000000-0000-0000-0000-00000000000a' and price_key = 'ungraded'),
  '25000000-0000-0000-0000-0000000000f6'::uuid,
  'the newest listing represents a collapsed card + grade'
);
select is(
  (select other_listings_count from t_hits where ref_id = '25000000-0000-0000-0000-00000000000a' and price_key = 'ungraded'),
  1,
  'other_listings_count counts the collapsed listings'
);
select is(
  (select current_price_cents || '/' || snapshot_price_cents || '/' || savings_pct
     from t_hits where ref_id = '25000000-0000-0000-0000-00000000000a' and price_key = 'ungraded'),
  '600/800/25.0',
  'current vs snapshot price and savings_pct'
);
select is(
  (select ref_id from t_hits where rnk = 1),
  '25000000-0000-0000-0000-00000000000a'::uuid,
  'biggest savings ranks first'
);
select is(
  (select snapshot_price_cents from t_hits where ref_id = '25000000-0000-0000-0000-00000000000a' and price_key = 'psa10'),
  9000,
  'an any-grade wishlist row compares against the listing''s grade in its snapshot'
);
select is(
  (select savings_pct from t_hits where ref_id = '25000000-0000-0000-0000-00000000000b'),
  0.0,
  'unchanged price → 0% savings'
);

-- Another user sees none of the buyer's hits; anon can't call it.
select set_config('request.jwt.claims', json_build_object('sub', '25000000-0000-0000-0000-0000000000a3')::text, true);
set local role authenticated;
select is((select count(*) from public.get_wishlist_hits(100)), 0::bigint, 'hits are scoped to the caller');
reset role;
set local role anon;
select throws_ok($$ select * from public.get_wishlist_hits(1) $$, '42501', null, 'anon cannot call get_wishlist_hits');
reset role;
set local role authenticated;
select throws_ok($$ select * from public._wishlist_hits(null) $$, '42501', null, 'clients cannot call the internal matcher');
reset role;

select * from finish();
rollback;
