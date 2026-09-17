-- pgTAP suite for public.get_recommended_listings()
--
-- Fixtures: a caller ("Zzyx Buyer") with an owned collection (Baseball card,
-- already owned) and a wishlist collection (Basketball genre signal), plus
-- three other sellers' storefront listings: one Basketball (should rank
-- first — genre affinity), one Hockey (should still appear, just lower
-- priority), and one duplicate of the Baseball card the buyer already owns
-- (should be excluded). Also covers the no-signal fallback with a second
-- caller that has no collection/wishlist rows at all.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- ── Fixtures ──────────────────────────────────────────────────────────────

insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values
  ('21000000-0000-0000-0000-00000000000a', 'Zzyx Owned Baseball Card', 'Set A', 'Baseball', '{"ungraded": 100}', 100),
  ('21000000-0000-0000-0000-00000000000b', 'Zzyx Wishlisted Basketball Card', 'Set B', 'Basketball', '{"ungraded": 200}', 200),
  ('21000000-0000-0000-0000-00000000000c', 'Zzyx Hockey Card', 'Set C', 'Hockey', '{"ungraded": 300}', 300);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('21000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-recs-buyer@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('21000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-recs-seller@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('21000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-recs-nosignal-buyer@test.local', '', now(), '{}', '{}', false, false, now(), now());

-- Buyer's own collection: owns the Baseball card.
insert into public.collections (id, user_id, name, is_wishlist)
values ('21000000-0000-0000-0000-0000000000c1', '21000000-0000-0000-0000-0000000000a1', 'Zzyx Buyer Collection', false);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('21000000-0000-0000-0000-0000000000d1', '21000000-0000-0000-0000-0000000000c1', '21000000-0000-0000-0000-0000000000a1', 'card', '21000000-0000-0000-0000-00000000000a', 1);

-- Buyer's wishlist: Basketball genre signal.
insert into public.collections (id, user_id, name, is_wishlist)
values ('21000000-0000-0000-0000-0000000000c2', '21000000-0000-0000-0000-0000000000a1', 'Zzyx Buyer Wishlist', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('21000000-0000-0000-0000-0000000000d2', '21000000-0000-0000-0000-0000000000c2', '21000000-0000-0000-0000-0000000000a1', 'card', '21000000-0000-0000-0000-00000000000b', 1);

-- Seller's storefront: lists all three cards (Basketball, Hockey, and the
-- Baseball card the buyer already owns).
insert into public.collections (id, user_id, name, is_storefront)
values ('21000000-0000-0000-0000-0000000000c3', '21000000-0000-0000-0000-0000000000a2', 'Zzyx Seller Storefront Collection', true);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values
  ('21000000-0000-0000-0000-0000000000d3', '21000000-0000-0000-0000-0000000000c3', '21000000-0000-0000-0000-0000000000a2', 'card', '21000000-0000-0000-0000-00000000000b', 2),
  ('21000000-0000-0000-0000-0000000000d4', '21000000-0000-0000-0000-0000000000c3', '21000000-0000-0000-0000-0000000000a2', 'card', '21000000-0000-0000-0000-00000000000c', 2),
  ('21000000-0000-0000-0000-0000000000d5', '21000000-0000-0000-0000-0000000000c3', '21000000-0000-0000-0000-0000000000a2', 'card', '21000000-0000-0000-0000-00000000000a', 2);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('21000000-0000-0000-0000-0000000000e1', '21000000-0000-0000-0000-0000000000a2', true, array['21000000-0000-0000-0000-0000000000c3']::uuid[]);

-- ── Assertions: buyer with genre signal ──────────────────────────────────

select set_config('request.jwt.claims', json_build_object('sub', '21000000-0000-0000-0000-0000000000a1')::text, true);

-- Large limit (not 20) so the local dev DB's own pre-existing seed listings can't crowd our
-- fixture rows out of the window — same reason get_marketplace_listings.sql asserts against
-- _marketplace_base_listings() filtered by ref_id rather than a small top-N slice.
-- rnk captured directly off the function's emission order (no intervening
-- ORDER BY/temp-table reshuffle) so it reflects get_recommended_listings' own ranking.
create temp table t_recs as
  select *, row_number() over () as rnk from public.get_recommended_listings(100000);

select is(
  (select count(*) from t_recs where ref_id = '21000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'the already-owned Baseball card listing is excluded'
);

select is(
  (select count(*) from t_recs where ref_id = '21000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'the Basketball listing (matches wishlist genre) is present'
);

select is(
  (select count(*) from t_recs where ref_id = '21000000-0000-0000-0000-00000000000c'),
  1::bigint,
  'the Hockey listing (no genre match) still appears, just lower-priority'
);

select ok(
  (select rnk from t_recs where ref_id = '21000000-0000-0000-0000-00000000000b')
  <
  (select rnk from t_recs where ref_id = '21000000-0000-0000-0000-00000000000c'),
  'the genre-affine Basketball listing ranks ahead of the non-affine Hockey listing'
);

-- ── Assertion: buyer with no collection/wishlist signal falls back to popularity order ──

select set_config('request.jwt.claims', json_build_object('sub', '21000000-0000-0000-0000-0000000000a3')::text, true);

create temp table t_recs_nosignal as
  select * from public.get_recommended_listings(100000);

select is(
  (select count(*) from t_recs_nosignal
    where ref_id in (
      '21000000-0000-0000-0000-00000000000a',
      '21000000-0000-0000-0000-00000000000b',
      '21000000-0000-0000-0000-00000000000c'
    )),
  3::bigint,
  'a caller with no collection/wishlist signal still gets all 3 fixture listings (no genre filtering applied, none owned)'
);

select * from finish();
rollback;
