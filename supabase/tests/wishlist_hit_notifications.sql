-- pgTAP suite for generate_wishlist_hit_notifications (20261025000005).
--
-- Fixtures: buyer 1 wishlists one card that a seller lists (one hit → one notification);
-- buyer 2 wishlists four listed cards (over the cap of 3 → one summary). A seeded hit for
-- buyer 1 must never be announced. Assertions read only these users' rows.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('26000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-whn-b1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('26000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-whn-b2@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('26000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-whn-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());
update public.user_profile set username = 'zzyx_seller' where user_id = '26000000-0000-0000-0000-0000000000a9';
insert into public.user_profile (user_id, username)
select '26000000-0000-0000-0000-0000000000a9', 'zzyx_seller'
 where not exists (select 1 from public.user_profile where user_id = '26000000-0000-0000-0000-0000000000a9');

insert into public.cards (id, name, set_name, genre, grades_prices)
select ('26000000-0000-0000-0000-00000000000' || n)::uuid, 'Zzyx WHN Card ' || n, 'S', 'Baseball', '{"ungraded": 1000}'
  from generate_series(1, 6) n;

insert into public.collections (id, user_id, name, is_wishlist)
values ('26000000-0000-0000-0000-0000000000c1', '26000000-0000-0000-0000-0000000000a1', 'Zzyx WHN W1', true),
       ('26000000-0000-0000-0000-0000000000c2', '26000000-0000-0000-0000-0000000000a2', 'Zzyx WHN W2', true);
-- buyer 1: cards 1 (seeded) and 2 (new); buyer 2: cards 3..6
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values
  ('26000000-0000-0000-0000-0000000000c1', '26000000-0000-0000-0000-0000000000a1', 'card', '26000000-0000-0000-0000-000000000001', 1),
  ('26000000-0000-0000-0000-0000000000c1', '26000000-0000-0000-0000-0000000000a1', 'card', '26000000-0000-0000-0000-000000000002', 1),
  ('26000000-0000-0000-0000-0000000000c2', '26000000-0000-0000-0000-0000000000a2', 'card', '26000000-0000-0000-0000-000000000003', 1),
  ('26000000-0000-0000-0000-0000000000c2', '26000000-0000-0000-0000-0000000000a2', 'card', '26000000-0000-0000-0000-000000000004', 1),
  ('26000000-0000-0000-0000-0000000000c2', '26000000-0000-0000-0000-0000000000a2', 'card', '26000000-0000-0000-0000-000000000005', 1),
  ('26000000-0000-0000-0000-0000000000c2', '26000000-0000-0000-0000-0000000000a2', 'card', '26000000-0000-0000-0000-000000000006', 1);

insert into public.collections (id, user_id, name, is_storefront)
values ('26000000-0000-0000-0000-0000000000c9', '26000000-0000-0000-0000-0000000000a9', 'Zzyx WHN SF', true);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('26000000-0000-0000-0000-0000000000e9', '26000000-0000-0000-0000-0000000000a9', true,
        array['26000000-0000-0000-0000-0000000000c9']::uuid[]);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
select ('26000000-0000-0000-0000-0000000000f' || n)::uuid, '26000000-0000-0000-0000-0000000000c9',
       '26000000-0000-0000-0000-0000000000a9', 'card', ('26000000-0000-0000-0000-00000000000' || n)::uuid, 1
  from generate_series(1, 6) n;

-- Mark buyer 1's card-1 hit as already known (as the migration's seed does).
insert into public.wishlist_hit_notifications (user_id, listing_item_id, wishlist_item_id, ref_id, seeded)
select user_id, listing_item_id, wishlist_item_id, ref_id, true
  from public._wishlist_hits('26000000-0000-0000-0000-0000000000a1')
 where ref_id = '26000000-0000-0000-0000-000000000001';

select public.generate_wishlist_hit_notifications(3);

create temp table t_n as
  select * from public.notifications
   where user_id in ('26000000-0000-0000-0000-0000000000a1', '26000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*) from t_n where user_id = '26000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'buyer 1 gets one notification (the seeded hit is not announced)'
);
select is(
  (select payload ->> 'card_id' from t_n where user_id = '26000000-0000-0000-0000-0000000000a1'),
  '26000000-0000-0000-0000-000000000002',
  'the notification is for the new hit'
);
select is(
  (select type || '/' || category from t_n where user_id = '26000000-0000-0000-0000-0000000000a1'),
  'wishlist_hit/price',
  'type wishlist_hit, category price'
);
select is(
  (select action_url from t_n where user_id = '26000000-0000-0000-0000-0000000000a1'),
  '/profile/26000000-0000-0000-0000-0000000000f2?cardId=26000000-0000-0000-0000-000000000002&collectionId=26000000-0000-0000-0000-0000000000c9',
  'action_url deep-links to the listing'
);
select ok(
  (select body like '@zzyx_seller listed it%' from t_n where user_id = '26000000-0000-0000-0000-0000000000a1'),
  'body names the seller'
);
select is(
  (select count(*) || ':' || bool_and((payload ->> 'summary')::boolean)
     from t_n where user_id = '26000000-0000-0000-0000-0000000000a2'),
  '1:true',
  'over the cap → a single summary notification'
);
select is(
  (select count(*) from public.wishlist_hit_notifications
    where user_id = '26000000-0000-0000-0000-0000000000a2' and notification_id is not null),
  4::bigint,
  'every summarized hit is linked to the summary'
);

select is(public.generate_wishlist_hit_notifications(3), 0, 'a second run announces nothing');

select * from finish();
rollback;
