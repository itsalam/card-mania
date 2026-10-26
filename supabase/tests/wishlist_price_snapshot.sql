-- pgTAP suite for the wishlist price snapshot + ensure_card_stub hardening
-- (20261025000002_wishlist_price_snapshot.sql).

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into public.cards (id, name, set_name, genre, grades_prices, latest_price)
values ('23000000-0000-0000-0000-00000000000a', 'Zzyx Snapshot Card', 'Set S', 'Baseball',
        '{"psa10": 5000, "ungraded": 400}', 400);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values ('23000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-snap@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.collections (id, user_id, name, is_wishlist)
values
  ('23000000-0000-0000-0000-0000000000c1', '23000000-0000-0000-0000-0000000000a1', 'Zzyx Snap Wishlist', true),
  ('23000000-0000-0000-0000-0000000000c2', '23000000-0000-0000-0000-0000000000a1', 'Zzyx Snap Vault', false);

insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values
  ('23000000-0000-0000-0000-0000000000d1', '23000000-0000-0000-0000-0000000000c1', '23000000-0000-0000-0000-0000000000a1', 'card', '23000000-0000-0000-0000-00000000000a', 1),
  ('23000000-0000-0000-0000-0000000000d2', '23000000-0000-0000-0000-0000000000c2', '23000000-0000-0000-0000-0000000000a1', 'card', '23000000-0000-0000-0000-00000000000a', 1);

select is(
  (select price_snapshot from public.collection_items where id = '23000000-0000-0000-0000-0000000000d1'),
  '{"psa10": 5000, "ungraded": 400}'::jsonb,
  'a wishlist insert snapshots the card''s grades_prices'
);
select ok(
  (select price_snapshot_at is not null from public.collection_items where id = '23000000-0000-0000-0000-0000000000d1'),
  'the snapshot is timestamped'
);
select is(
  (select price_snapshot from public.collection_items where id = '23000000-0000-0000-0000-0000000000d2'),
  null,
  'a non-wishlist insert takes no snapshot'
);

-- Never refreshed by the server: client prices are still accepted (previous behaviour).
select public.ensure_card_stub('23000000-0000-0000-0000-00000000000a', 'Zzyx Snapshot Card', 'Set S',
                               'Baseball', '{"ungraded": 450}'::jsonb, 450);
select is(
  (select grades_prices ->> 'ungraded' from public.cards where id = '23000000-0000-0000-0000-00000000000a'),
  '450',
  'ensure_card_stub updates prices on a never-refreshed card'
);

-- Once the server has refreshed the card, client-supplied prices are ignored.
update public.cards set prices_refreshed_at = now() where id = '23000000-0000-0000-0000-00000000000a';
select public.ensure_card_stub('23000000-0000-0000-0000-00000000000a', 'Zzyx Snapshot Card', 'Set S',
                               'Baseball', '{"ungraded": 1}'::jsonb, 1);
select is(
  (select grades_prices ->> 'ungraded' from public.cards where id = '23000000-0000-0000-0000-00000000000a'),
  '450',
  'ensure_card_stub cannot overwrite server-refreshed prices'
);

select * from finish();
rollback;
