-- pgTAP suite for the promo editor read helpers (20261114000001, ITS-193).

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('19300000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-ed-editor@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('19300000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-ed-nobody@test.local', '', now(), '{}', '{}', false, false, now(), now());
insert into admin.members (user_id, role) values ('19300000-0000-0000-0000-0000000000a2', 'editor');

insert into public.cards (id, name, set_name, genre, release_date)
values
  ('19300000-0000-0000-0000-000000000001', 'Zzyxq Alpha Rookie', 'Zzyxq 2027 Topps Chrome', 'Baseball', '2027-03-01'),
  ('19300000-0000-0000-0000-000000000002', 'Zzyxq Beta Rookie',  'Zzyxq 2027 Topps Chrome', 'Baseball', '2027-03-01'),
  ('19300000-0000-0000-0000-000000000003', 'Zzyxq Gamma',        'Zzyxq Old Set',           'Baseball', '2019-03-01');

insert into public.image_cache (id, storage_path, status)
values ('19300000-0000-0000-0000-0000000000c1', 'cards/zzyxq-alpha.png', 'READY');
insert into public.card_images (card_id, kind, is_primary, image_cache_id, source_url)
values ('19300000-0000-0000-0000-000000000001', 'front', true, '19300000-0000-0000-0000-0000000000c1', 'https://example.test/a.png'),
       ('19300000-0000-0000-0000-000000000002', 'front', true, null, 'https://example.test/b.png');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"19300000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select throws_ok($$ select * from admin.search_card_sets('zzyxq') $$, '42501', 'not authorized', 'non-member cannot search sets');
select throws_ok($$ select * from admin.search_cards('zzyxq') $$, '42501', 'not authorized', 'non-member cannot search cards');
select throws_ok($$ select * from admin.lookup_cards('{}') $$, '42501', 'not authorized', 'non-member cannot look up cards');

select set_config('request.jwt.claims', '{"sub":"19300000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select results_eq($$ select set_name, card_count, release_year from admin.search_card_sets('zzyxq') $$,
                  $$ values ('Zzyxq 2027 Topps Chrome'::text, 2, 2027), ('Zzyxq Old Set'::text, 1, 2019) $$,
                  'sets are distinct, counted and newest first');
select is((select set_name from admin.search_card_sets('topps chrome') where set_name like 'Zzyxq%'),
          'Zzyxq 2027 Topps Chrome', 'set search matches anywhere in the name, ignoring case');
select is((select count(*)::int from admin.search_cards('z')), 0, 'card search needs at least 2 characters');
select is((select count(*)::int from admin.search_cards('zzyxq', 'zzyxq old set')), 1, 'card search can be limited to a set');
select is((select image_path from admin.search_cards('zzyxq alpha')), 'cards/zzyxq-alpha.png',
          'a committed image returns its storage path');
select results_eq($$ select name, image_path, image_source_url from admin.lookup_cards(
                       array['19300000-0000-0000-0000-000000000002', '19300000-0000-0000-0000-000000000001']::uuid[]) $$,
                  $$ values ('Zzyxq Beta Rookie'::text, null::text, 'https://example.test/b.png'::text),
                            ('Zzyxq Alpha Rookie'::text, 'cards/zzyxq-alpha.png'::text, 'https://example.test/a.png'::text) $$,
                  'lookup keeps the requested order and falls back to the source URL');
select ok((admin.preview_promo_matches('{"sets": ["Zzyxq 2027 Topps Chrome"]}') -> 'sample') is not null,
          'match preview still works');
select ok(admin.preview_promo_matches('{"sets": ["no such set zzyxq"]}') = '{"count": 0, "count_capped": false, "sample": []}'::jsonb,
          'match preview with no matches is empty');

select * from finish();
rollback;
