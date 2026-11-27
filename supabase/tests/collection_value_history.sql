-- pgTAP: one value snapshot per collection per transaction (ITS-133).
-- Several item changes in one transaction share now(); the history must keep one row per
-- collection for that moment, holding the settled total, not an in-between one.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values ('31000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-cvh-o@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values
  ('31000000-0000-0000-0000-00000000000a', 'Zzyx CVH A', 'S', 'Baseball', '{"ungraded": 1000}'),
  ('31000000-0000-0000-0000-00000000000b', 'Zzyx CVH B', 'S', 'Baseball', '{"ungraded": 250}');

insert into public.collections (id, user_id, name)
values ('31000000-0000-0000-0000-0000000000d1', '31000000-0000-0000-0000-0000000000a1', 'Zzyx CVH V');

-- Three steps in this one transaction: add 2 x A, add B, then take one A away. In between,
-- the total passes through 2000 and 2250 before settling on 1250.
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
values ('31000000-0000-0000-0000-0000000000e1', '31000000-0000-0000-0000-0000000000d1', '31000000-0000-0000-0000-0000000000a1', 'card', '31000000-0000-0000-0000-00000000000a', 2);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values ('31000000-0000-0000-0000-0000000000d1', '31000000-0000-0000-0000-0000000000a1', 'card', '31000000-0000-0000-0000-00000000000b', 1);
update public.collection_items set quantity = 1 where id = '31000000-0000-0000-0000-0000000000e1';

select is(
  (select count(*) from public.collection_value_history where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  1::bigint,
  'one snapshot for the collection, however many statements ran in the transaction');

select is(
  (select total_cents from public.collection_value_history where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  1250,
  'the snapshot holds the settled total (1000 + 250), not an in-between one');

select is(
  (select quantity_total from public.collection_value_history where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  2,
  'and the settled quantity');

select is(
  (select total_cents from public.collection_value_history where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  (select total_cents from public.collection_totals where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  'history matches collection_totals');

select is(
  (select total_cents from public.get_portfolio_history('31000000-0000-0000-0000-0000000000d1') order by snapshotted_at desc limit 1),
  1250,
  'get_portfolio_history''s latest point is the settled total');

-- The nightly job's insert (an upsert now) at the same moment doesn't add a row.
insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
select collection_id, total_cents, coalesce(quantity_total, 0), now()
from public.collection_totals
where collection_id = '31000000-0000-0000-0000-0000000000d1'
on conflict (collection_id, snapshotted_at) do update
  set total_cents = excluded.total_cents, quantity_total = excluded.quantity_total;

select is(
  (select count(*) from public.collection_value_history where collection_id = '31000000-0000-0000-0000-0000000000d1'),
  1::bigint,
  'the nightly snapshot at the same moment updates the row instead of adding one');

select throws_ok(
  $$insert into public.collection_value_history (collection_id, total_cents, quantity_total, snapshotted_at)
    values ('31000000-0000-0000-0000-0000000000d1', 1, 1, now())$$,
  '23505', null,
  'a second plain insert for the same collection and moment is refused');

select * from finish();
rollback;
