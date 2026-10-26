-- pgTAP suite for get_ticker_items (20261025000006_ticker_items_rpc.sql).

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('27000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-tick-1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('27000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-tick-2@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values
  ('27000000-0000-0000-0000-00000000000a', 'Zzyx Tick Owned', 'S', 'Baseball', '{"ungraded": 1100}'),
  ('27000000-0000-0000-0000-00000000000b', 'Zzyx Tick Watched', 'S', 'Baseball', '{"ungraded": 500}'),
  ('27000000-0000-0000-0000-00000000000c', 'Zzyx Tick Both', 'S', 'Baseball', '{"ungraded": 300}'),
  ('27000000-0000-0000-0000-00000000000d', 'Zzyx Tick Unpriced', 'S', 'Baseball', '{}');

insert into public.collections (id, user_id, name, is_wishlist)
values ('27000000-0000-0000-0000-0000000000c1', '27000000-0000-0000-0000-0000000000a1', 'Zzyx Tick Vault', false),
       ('27000000-0000-0000-0000-0000000000c2', '27000000-0000-0000-0000-0000000000a1', 'Zzyx Tick Wishlist', true);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values
  ('27000000-0000-0000-0000-0000000000c1', '27000000-0000-0000-0000-0000000000a1', 'card', '27000000-0000-0000-0000-00000000000a', 1),
  ('27000000-0000-0000-0000-0000000000c1', '27000000-0000-0000-0000-0000000000a1', 'card', '27000000-0000-0000-0000-00000000000c', 1),
  ('27000000-0000-0000-0000-0000000000c1', '27000000-0000-0000-0000-0000000000a1', 'card', '27000000-0000-0000-0000-00000000000d', 1),
  ('27000000-0000-0000-0000-0000000000c2', '27000000-0000-0000-0000-0000000000a1', 'card', '27000000-0000-0000-0000-00000000000b', 1),
  ('27000000-0000-0000-0000-0000000000c2', '27000000-0000-0000-0000-0000000000a1', 'card', '27000000-0000-0000-0000-00000000000c', 1);

-- Owned card: $10.00 eight days ago (and a newer $10.50 inside the window, which must not be
-- used) → now $11.00 = +10%. Watched card has no history old enough.
insert into public.card_price_history (card_id, grade, price_cents, recorded_at)
values
  ('27000000-0000-0000-0000-00000000000a', 'ungraded', 1000, now() - interval '8 days'),
  ('27000000-0000-0000-0000-00000000000a', 'ungraded', 1050, now() - interval '2 days'),
  ('27000000-0000-0000-0000-00000000000b', 'ungraded', 400, now() - interval '1 day');

select set_config('request.jwt.claims', json_build_object('sub', '27000000-0000-0000-0000-0000000000a1')::text, true);
set local role authenticated;
create temp table t_tick as select *, row_number() over () as rnk from public.get_ticker_items(20, 7);
reset role;

select is((select count(*) from t_tick), 3::bigint, 'one row per tracked card + grade; unpriced cards dropped');
select is(
  (select past_cents || '→' || current_cents || ' ' || change_pct from t_tick where ref_id = '27000000-0000-0000-0000-00000000000a'),
  '1000→1100 10.0',
  '7-day change uses the latest price at least 7 days old'
);
select is(
  (select change_pct from t_tick where ref_id = '27000000-0000-0000-0000-00000000000b'),
  null,
  'no history old enough → null change'
);
select is(
  (select source from t_tick where ref_id = '27000000-0000-0000-0000-00000000000c'),
  'owned',
  'a card both owned and wishlisted is reported as owned'
);
select is(
  (select ref_id from t_tick where rnk = 1),
  '27000000-0000-0000-0000-00000000000a'::uuid,
  'owned cards with the biggest move lead'
);
select is(
  (select source from t_tick where rnk = 3),
  'watching',
  'watched cards come after owned ones'
);

select set_config('request.jwt.claims', json_build_object('sub', '27000000-0000-0000-0000-0000000000a2')::text, true);
set local role authenticated;
select is((select count(*) from public.get_ticker_items(20, 7)), 0::bigint, 'ticker is scoped to the caller');
reset role;

select * from finish();
rollback;
