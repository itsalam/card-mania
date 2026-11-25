-- pgTAP: collection order (ITS-200). Owner O's collection K holds cards A, B (two copies), C,
-- added in that order. X is another user.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-cio-o@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-cio-x@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into public.cards (id, name, set_name, genre, grades_prices)
values ('20000000-0000-0000-0000-00000000000a', 'Zzyx CIO A', 'S', 'Baseball', '{"ungraded": 100}'),
       ('20000000-0000-0000-0000-00000000000b', 'Zzyx CIO B', 'S', 'Baseball', '{"ungraded": 100}'),
       ('20000000-0000-0000-0000-00000000000c', 'Zzyx CIO C', 'S', 'Baseball', '{"ungraded": 100}'),
       ('20000000-0000-0000-0000-00000000000d', 'Zzyx CIO D', 'S', 'Baseball', '{"ungraded": 100}');

insert into public.collections (id, user_id, name)
values ('20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'Zzyx CIO K');
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity, variants, created_at)
values
  ('20000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000a', 1, '{}',      now() - interval '4 hours'),
  ('20000000-0000-0000-0000-0000000000e2', '20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000b', 1, '{}',      now() - interval '3 hours'),
  ('20000000-0000-0000-0000-0000000000e3', '20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000b', 1, '{holo}',  now() - interval '2 hours'),
  ('20000000-0000-0000-0000-0000000000e4', '20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000c', 1, '{}',      now() - interval '1 hour');

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;

-- Card names in list order, grouped or not.
create function pg_temp.names(p_group boolean, p_size int default 20, p_pos int default null, p_after timestamptz default null)
returns text language sql as $$
  select string_agg(right(name, 1), '' order by ord)
    from (select name, row_number() over () as ord
            from public.collection_item_query('20000000-0000-0000-0000-0000000000d1', p_after, null, p_size, p_group, p_pos)) q
$$;

select pg_temp.act_as('20000000-0000-0000-0000-0000000000a1');

-- ── default order: newest first ─────────────────────────────────────────────
select is(pg_temp.names(true), 'CBA', 'never reordered: grouped list is newest first');
select is(pg_temp.names(false), 'CBBA', 'never reordered: ungrouped list is newest first');

-- ── grouped paging (page 2 used to come back empty) ─────────────────────────
select is(pg_temp.names(true, 2), 'CB', 'grouped page 1');
select is(
  (select pg_temp.names(true, 2, sort_position, sort_created_at)
     from public.collection_item_query('20000000-0000-0000-0000-0000000000d1', null, null, 2, true) offset 1 limit 1),
  'A', 'grouped page 2 continues from the cursor'
);
-- An installed build sends only the created_at cursor: exact while never reordered.
select is(
  (select pg_temp.names(true, 2, null, sort_created_at)
     from public.collection_item_query('20000000-0000-0000-0000-0000000000d1', null, null, 2, true) offset 1 limit 1),
  'A', 'legacy created_at-only cursor still pages a never-reordered collection'
);

-- ── reorder ─────────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  'owner saves an order'
);
select is(pg_temp.names(true), 'ACB', 'grouped list follows the saved order');
select is(pg_temp.names(false), 'ACBB', 'copies of a card move together');
select is(
  (select pg_temp.names(true, 1, sort_position, sort_created_at)
     from public.collection_item_query('20000000-0000-0000-0000-0000000000d1', null, null, 1, true) limit 1),
  'C', 'paging works on the saved order'
);

-- A new card lands on top.
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values ('20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000a1', 'card', '20000000-0000-0000-0000-00000000000d', 1);
select is(pg_temp.names(true), 'DACB', 'a newly added card shows above the custom order');

-- ── guards ──────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  '40001', 'This collection changed; reload and try again', 'a stale order (missing the new card) is rejected'
);
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  '22023', 'Each card must appear once', 'duplicates are rejected'
);
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000099']::uuid[]) $$,
  '40001', null, 'a card that isn''t in the collection is rejected'
);

reset role;
update public.collections set is_selling = true where id = '20000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as('20000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  '22023', 'The Selling collection can''t be reordered', 'Selling can''t be reordered'
);
reset role;
update public.collections set is_selling = false where id = '20000000-0000-0000-0000-0000000000d1';

select pg_temp.act_as('20000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1',
       array['20000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  'P0002', 'Collection not found', 'another user can''t reorder it'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.reorder_collection_items('20000000-0000-0000-0000-0000000000d1', array[]::uuid[]) $$,
  '42501', null, 'anon can''t call reorder'
);
reset role;

-- Reordering doesn't touch values or history.
select is(
  (select count(*)::int from public.collection_item_events ev
    where ev.collection_id = '20000000-0000-0000-0000-0000000000d1'),
  5, 'reorder writes no collection_item_events (only the 5 inserts)'
);

select * from finish();
rollback;
