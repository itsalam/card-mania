-- pgTAP suite for public._marketplace_base_listings()
--
-- There is no get_marketplace_listings/listings.is_active in this schema.
-- The marketplace listings surface is:
--   - public._marketplace_base_listings() — the shared base query (this file's
--     target: deterministic, no cache dependency).
--   - public.get_marketplace_sections() / refresh_marketplace_sections() —
--     a materialized cache built on top of the base query; excluded here
--     since it depends on a cache-refresh step rather than the seeded rows.
-- "is_active" maps to storefronts.is_listed, gated through the chain
-- storefronts.is_listed → collections.is_storefront → collection_items.quantity > 0.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- ── Fixtures ──────────────────────────────────────────────────────────────

insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values ('20000000-0000-0000-0000-00000000000a', 'Zzyx Listing Card', 'Listing Set', 'Trading Card', '{"ungraded": 250}', 250);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-active-seller@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-inactive-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());

-- Active seller: storefront is_listed = true, storefront collection has the card, quantity > 0.
insert into public.collections (id, user_id, name, is_storefront)
values ('20000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000a1', 'Zzyx Active Storefront Collection', true);

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000a', 3);

insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('20000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000a1', true, array['20000000-0000-0000-0000-0000000000c1']::uuid[]);

-- Inactive seller: identical setup, but storefront is_listed = false.
insert into public.collections (id, user_id, name, is_storefront)
values ('20000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000a2', 'Zzyx Inactive Storefront Collection', true);

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('20000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000a2', 'card', '20000000-0000-0000-0000-00000000000a', 3);

insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('20000000-0000-0000-0000-0000000000e2', '20000000-0000-0000-0000-0000000000a2', false, array['20000000-0000-0000-0000-0000000000c2']::uuid[]);

-- ── Assertions ────────────────────────────────────────────────────────────

create temp table t_listings as
  select * from public._marketplace_base_listings()
  where ref_id = '20000000-0000-0000-0000-00000000000a';

select is((select count(*) from t_listings), 1::bigint, 'only the is_listed = true storefront listing appears');

select is(
  (select seller_id from t_listings),
  '20000000-0000-0000-0000-0000000000a1'::uuid,
  'the surfaced listing belongs to the active seller'
);

select is(
  (select collection_item_id from t_listings),
  '20000000-0000-0000-0000-0000000000d1'::uuid,
  'the surfaced listing is the active seller''s collection item'
);

select ok(
  (select name from t_listings) = 'Zzyx Listing Card'
    and (select market_value from t_listings) is not null,
  'expected card columns (name, market_value) are populated on the listing row'
);

select * from finish();
rollback;
