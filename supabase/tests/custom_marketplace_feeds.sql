-- pgTAP suite for ITS-97 custom marketplace feeds (20261104000001).
--
-- Fixtures: one listed storefront with four cards (two Ohtani, one 2026 sealed, one PSA-graded
-- cheap card). Feeds are evaluated with marketplace_feed_listings and written through
-- write_marketplace_section, then read back via get_marketplace_sections().

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values ('29000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-feed-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());
insert into public.user_profile (user_id, username)
values ('29000000-0000-0000-0000-0000000000a9', 'zzyx_feed_seller')
on conflict (user_id) do nothing;

insert into public.cards (id, name, set_name, genre, grades_prices, release_date, sealed)
values
  ('29000000-0000-0000-0000-000000000001', 'Zzyx Shohei Ohtani Rookie', 'Zzyx Topps', 'Baseball', '{"ungraded": 90000}', '2018-04-01', false),
  ('29000000-0000-0000-0000-000000000002', 'Zzyx Ohtani Shohei Chrome', 'Zzyx Chrome', 'Baseball', '{"ungraded": 30000}', '2021-04-01', false),
  ('29000000-0000-0000-0000-000000000003', 'Zzyx 2026 Hobby Box', 'Zzyx Series 1', 'Baseball', '{"ungraded": 20000}', '2026-02-01', true),
  ('29000000-0000-0000-0000-000000000004', 'Zzyx Common', 'Zzyx Topps', 'Pokemon', '{"ungraded": 1200}', '2026-06-01', false);

insert into public.collections (id, user_id, name, is_storefront)
values ('29000000-0000-0000-0000-0000000000c9', '29000000-0000-0000-0000-0000000000a9', 'Zzyx Feed SF', true);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('29000000-0000-0000-0000-0000000000e9', '29000000-0000-0000-0000-0000000000a9', true,
        array['29000000-0000-0000-0000-0000000000c9']::uuid[]);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
select ('29000000-0000-0000-0000-0000000000f' || n)::uuid, '29000000-0000-0000-0000-0000000000c9',
       '29000000-0000-0000-0000-0000000000a9', 'card', ('29000000-0000-0000-0000-00000000000' || n)::uuid, 1
  from generate_series(1, 4) n;

-- Scope every feed to this seller so other fixtures/seed data can't leak in.
create temp table t_scope as select '["29000000-0000-0000-0000-0000000000a9"]'::jsonb as sellers;
create function pg_temp.feed(f jsonb, o text default 'popularity')
returns text language sql as $$
  select string_agg(right(payload ->> 'ref_id', 1), ',' order by rank)
    from public.marketplace_feed_listings(f || jsonb_build_object('seller_ids', (select sellers from t_scope)), o, 20)
$$;

select is(pg_temp.feed('{"name_query": "shohei ohtani"}', 'value_desc'), '1,2',
          'name_query matches every term in any order, value_desc ordering');
select is(pg_temp.feed('{"release_year_min": 2026, "release_year_max": 2026}', 'value_asc'), '4,3',
          'release-year window, value_asc ordering');
select is(pg_temp.feed('{"sealed": true}'), '3', 'sealed filter');
select is(pg_temp.feed('{"max_value_cents": 5000, "min_value_cents": 1}'), '4', 'value range');
select is(pg_temp.feed('{"genres": ["pokemon"]}'), '4', 'genres are case-insensitive');
select is(pg_temp.feed('{"sets": ["ZZYX TOPPS"]}', 'value_desc'), '1,4', 'sets are case-insensitive');
select is(pg_temp.feed('{"graded": true}'), null, 'graded=true excludes raw listings');

select throws_ok($$ select * from public.marketplace_feed_listings('{"nme_query": "x"}', 'popularity', 5) $$,
                 '22023', null, 'unknown filter keys are rejected');
select throws_ok($$ select * from public.marketplace_feed_listings('{"sealed": "yes"}', 'popularity', 5) $$,
                 '22023', null, 'wrongly typed values are rejected');
select throws_ok($$ insert into public.marketplace_section_meta (key, title, kind, filter)
                    values ('zzyx_bad', 'Bad', 'custom', '{"ref_ids": ["not-a-uuid"]}') $$,
                 '23514', null, 'the table check blocks an invalid filter at write time');

-- A new feed is pure data: insert the row, the function path fills it, the read RPC serves it.
insert into public.marketplace_section_meta (key, title, sort_order, kind, filter, order_by)
values ('zzyx_ohtani', 'Zzyx Ohtani', 99, 'custom',
        '{"name_query": "ohtani", "seller_ids": ["29000000-0000-0000-0000-0000000000a9"]}', 'value_desc');

select ok(exists (select 1 from public.due_marketplace_feeds() where key = 'zzyx_ohtani'),
          'a never-refreshed custom feed is due');

select is(
  public.write_marketplace_section('zzyx_ohtani',
    (select jsonb_agg(to_jsonb(l)) from public.marketplace_feed_listings(
       (select filter from public.marketplace_section_meta where key = 'zzyx_ohtani'), 'value_desc', 20) l)),
  2, 'write_marketplace_section stores the ranked rows');

select ok(not exists (select 1 from public.due_marketplace_feeds() where key = 'zzyx_ohtani'),
          'after a write the feed is not due until its refresh_interval elapses');

select is(
  (select jsonb_array_length(items) || ':' || (items -> 0 ->> 'name')
     from public.get_marketplace_sections() where section_key = 'zzyx_ohtani'),
  '2:Zzyx Shohei Ohtani Rookie',
  'get_marketplace_sections serves the custom feed in rank order');

select * from finish();
rollback;
