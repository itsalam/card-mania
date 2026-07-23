-- pgTAP suite for public.search_cards_blended(p_q, p_limit)
-- Verifies: s_pop reflects wishlist + completed-sale activity, the reason jsonb
-- carries all four signal keys, and p_limit bounds the result set.
--
-- All fixtures use a distinctive 'zzyxtestcard' token in card names so this
-- suite is isolated from supabase/seed.sql and any other test's data, and the
-- whole file runs inside BEGIN/ROLLBACK so it leaves no side effects.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- ── Fixtures ──────────────────────────────────────────────────────────────

-- Card A: has wishlist + completed-sale activity → s_pop should be > 0.
insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values (
  '10000000-0000-0000-0000-00000000000a',
  'Zzyxtestcard Alpha',
  'Alpha Set',
  'Trading Card',
  '{"ungraded": 1000}',
  1000
);

-- Card B: matches the same search term but has zero wishlist/sale activity
-- → s_pop should be exactly 0, while still scoring above min_score via fts/trgm.
insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values (
  '10000000-0000-0000-0000-00000000000b',
  'Zzyxtestcard Beta',
  'Beta Set',
  'Trading Card',
  '{"ungraded": 500}',
  500
);

-- Users (auth.users insert auto-provisions public.user_profile via trigger).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-buyer@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());

-- Wishlist collection (buyer) containing card A → wishlist_counts signal.
insert into public.collections (id, user_id, name, is_wishlist)
values ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000a1', 'Zzyx Wishlist', true);

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000a1', 'card', '10000000-0000-0000-0000-00000000000a', 1);

-- Seller's plain collection holding card A, sold via a completed transaction
-- → sale_counts signal.
insert into public.collections (id, user_id, name, is_wishlist)
values ('10000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000a2', 'Zzyx Selling', false);

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000a2', 'card', '10000000-0000-0000-0000-00000000000a', 1);

insert into public.offers (id, buyer_id, seller_id, status, total_amount)
values ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', 'completed', 10.00);

insert into public.offer_items (id, offer_id, collection_item_id, quantity, offered_price_per_unit)
values ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000d2', 1, 10.00);

insert into public.transactions (id, offer_id, status)
values ('10000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-0000000000e1', 'completed');

-- ── Assertions ────────────────────────────────────────────────────────────

create temp table t_results as
  select * from public.search_cards_blended('zzyxtestcard', 20);

select ok(
  (select (reason->>'pop')::numeric from t_results where id = '10000000-0000-0000-0000-00000000000a') > 0,
  'card with wishlist + completed-sale activity has s_pop > 0'
);

select is(
  (select (reason->>'pop')::numeric from t_results where id = '10000000-0000-0000-0000-00000000000b'),
  0::numeric,
  'card with no wishlist/sale activity has s_pop = 0'
);

select ok((select reason from t_results limit 1) ? 'fts', 'reason jsonb contains key fts');
select ok((select reason from t_results limit 1) ? 'trgm', 'reason jsonb contains key trgm');
select ok((select reason from t_results limit 1) ? 'vector', 'reason jsonb contains key vector');
select ok((select reason from t_results limit 1) ? 'pop', 'reason jsonb contains key pop');

select is(
  (select count(*) from public.search_cards_blended('zzyxtestcard', 1)),
  1::bigint,
  'result count is bounded by p_limit'
);

select * from finish();
rollback;
