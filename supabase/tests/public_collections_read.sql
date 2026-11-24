-- pgTAP: public collections are readable by everyone (ITS-124); legacy tables dropped (ITS-126).
--
-- Owner O has a public collection P (one item) and a private collection Q (one item).
-- V is another signed-in user; G is a guest (anonymous sign-in, still `authenticated`).

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('12400000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-pcr-o@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('12400000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-pcr-v@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('12400000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, '{}', '{}', false, true, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('12400000-0000-0000-0000-000000000001', 'Zzyx PCR Card', 'S', 'Baseball', '{"ungraded": 1500}');

insert into public.collections (id, user_id, name, visibility)
values ('12400000-0000-0000-0000-0000000000d1', '12400000-0000-0000-0000-0000000000a1', 'Zzyx PCR Public', 'public'),
       ('12400000-0000-0000-0000-0000000000d2', '12400000-0000-0000-0000-0000000000a1', 'Zzyx PCR Private', 'private');
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('12400000-0000-0000-0000-0000000000e1', '12400000-0000-0000-0000-0000000000d1', '12400000-0000-0000-0000-0000000000a1', 'card', '12400000-0000-0000-0000-000000000001', 1),
       ('12400000-0000-0000-0000-0000000000e2', '12400000-0000-0000-0000-0000000000d2', '12400000-0000-0000-0000-0000000000a1', 'card', '12400000-0000-0000-0000-000000000001', 1);
insert into public.collection_totals (collection_id, total_cents, quantity_total)
values ('12400000-0000-0000-0000-0000000000d1', 1500, 1), ('12400000-0000-0000-0000-0000000000d2', 1500, 1)
on conflict (collection_id) do nothing;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- ── another signed-in user ──────────────────────────────────────────────────
select pg_temp.act_as('12400000-0000-0000-0000-0000000000b1');

select is((select count(*)::int from public.collections where user_id = '12400000-0000-0000-0000-0000000000a1'),
  1, 'other user sees only the public collection');
select is((select name from public.collections where user_id = '12400000-0000-0000-0000-0000000000a1'),
  'Zzyx PCR Public', 'the visible collection is the public one');
select is((select count(*)::int from public.collection_items where user_id = '12400000-0000-0000-0000-0000000000a1'),
  1, 'other user sees only the public collection''s items');
select is((select count(*)::int from public.collection_totals
            where collection_id in ('12400000-0000-0000-0000-0000000000d1', '12400000-0000-0000-0000-0000000000d2')),
  1, 'other user sees only the public collection''s total');
select is((select count(*)::int from public.collection_item_query('12400000-0000-0000-0000-0000000000d1')),
  1, 'collection_item_query returns a public collection''s items');
select is((select count(*)::int from public.collection_item_query('12400000-0000-0000-0000-0000000000d2')),
  0, 'collection_item_query returns nothing for a private collection');
with u as (update public.collections set name = 'x' where id = '12400000-0000-0000-0000-0000000000d1' returning 1)
select is((select count(*)::int from u), 0, 'public read does not allow writes');

-- ── guest (anonymous sign-in) ───────────────────────────────────────────────
select pg_temp.act_as('12400000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.collections where user_id = '12400000-0000-0000-0000-0000000000a1'),
  1, 'guest sees the public collection');
select is((select count(*)::int from public.collection_items where user_id = '12400000-0000-0000-0000-0000000000a1'),
  1, 'guest sees the public collection''s items');

-- ── owner ───────────────────────────────────────────────────────────────────
select pg_temp.act_as('12400000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.collections where id in ('12400000-0000-0000-0000-0000000000d1', '12400000-0000-0000-0000-0000000000d2')),
  2, 'owner still sees both collections');

-- ── ITS-126 ─────────────────────────────────────────────────────────────────
reset role;
select hasnt_table('public', 'listings', 'legacy listings dropped');
select hasnt_table('public', 'orders', 'legacy orders dropped');
select hasnt_table('public', 'reservations', 'legacy reservations dropped');
select hasnt_function('public', 'wishlist_validate_fk', 'dead wishlist_validate_fk dropped');

select * from finish();
rollback;
