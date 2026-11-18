-- pgTAP suite for the Home sections editor (20261118000000, ITS-110):
-- admin.list_home_sections, admin.update_home_section, admin.reorder_home_sections.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('11000000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-home-sections-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 3) n;
insert into admin.members (user_id, role) values
  ('11000000-0000-0000-0000-0000000000a1', 'editor'),
  ('11000000-0000-0000-0000-0000000000a2', 'ops');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  if p_user is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  end if;
end $$;
grant execute on function pg_temp.act_as(uuid) to anon, authenticated;

-- ── Access ──
select pg_temp.act_as('11000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select * from admin.list_home_sections() $$, '42501', null, 'a non-member cannot list sections');
select throws_ok($$ select admin.update_home_section('collections', '{"title": "X"}') $$, '42501', null,
  'a non-member cannot edit a section');
select pg_temp.act_as('11000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select admin.update_home_section('collections', '{"title": "X"}') $$, '42501', null,
  'ops cannot edit a section');
select pg_temp.act_as(null);
select throws_ok($$ select * from admin.list_home_sections() $$, '42501', null, 'anon cannot list sections');

-- ── List ──
reset role;
create temp table section_count as select count(*)::int as n from public.home_feed_section_meta;
grant select on section_count to authenticated;
select pg_temp.act_as('11000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from admin.list_home_sections()),
          (select n from section_count), 'an editor lists every section');

-- ── Update ──
select is(admin.update_home_section('collections',
            '{"title": "  My collections ", "icon": "sparkles", "result_limit": 6, "layout": {"expandable": false, "itemWidth": 110}}') ->> 'title',
          'My collections', 'title is trimmed and saved');
reset role;
select is((select icon || '/' || result_limit || '/' || (layout ->> 'itemWidth')
             from public.home_feed_section_meta where key = 'collections'),
          'sparkles/6/110', 'icon, limit and layout are saved');
select is((select action || ':' || target_id || ':' || (before ->> 'title') || '→' || (after ->> 'title')
             from admin.audit_log where action = 'home_section.update' order by id desc limit 1),
          'home_section.update:collections:Collections→My collections', 'the edit is audited with before and after');

select pg_temp.act_as('11000000-0000-0000-0000-0000000000a1');
select is(admin.update_home_section('collections', '{"enabled": false}') ->> 'enabled', 'false', 'a section can be disabled');
reset role;
select ok(not exists (select 1 from public.get_home_feed_sections() where key = 'collections'),
  'a disabled section drops out of the app''s feed');
select pg_temp.act_as('11000000-0000-0000-0000-0000000000a1');
select ok(exists (select 1 from admin.list_home_sections() where key = 'collections' and not enabled),
  'but still shows in the editor');

select throws_ok($$ select admin.update_home_section('collections', '{"icon": "rocket"}') $$, '22023', null,
  'an icon the app cannot render is rejected');
select throws_ok($$ select admin.update_home_section('collections', '{"title": "  "}') $$, '22023', null,
  'a blank title is rejected');
select throws_ok($$ select admin.update_home_section('collections', '{"result_limit": 0}') $$, '22023', null,
  'a result limit below 1 is rejected');
select throws_ok($$ select admin.update_home_section('collections', '{"layout": {"itemWidth": 9000}}') $$, '22023', null,
  'an out-of-range layout size is rejected');
select throws_ok($$ select admin.update_home_section('collections', '{"layout": {"color": "red"}}') $$, '22023', null,
  'an unknown layout key is rejected');
select throws_ok($$ select admin.update_home_section('collections', '{"key": "other"}') $$, '22023', null,
  'fields outside the editable set are rejected');
select throws_ok($$ select admin.update_home_section('nope', '{"title": "X"}') $$, 'P0002', null,
  'an unknown section is reported');
select throws_ok($$ select admin.update_home_section('collections', '{"title": "X", "expected_updated_at": "2020-01-01T00:00:00Z"}') $$,
  '40001', null, 'a stale expected_updated_at refuses the save');

-- ── Reorder ──
select is((select array_agg(x ->> 'key' order by ord)
             from admin.reorder_home_sections(array['suggested_sellers', 'promos', 'collections', 'wishlist_hits'])
                  with ordinality r(x, ord)),
          array['suggested_sellers', 'promos', 'collections', 'wishlist_hits'], 'reorder returns the new order');
select throws_ok($$ select admin.reorder_home_sections(array['promos', 'collections']) $$, '22023', null,
  'a reorder missing sections is rejected');
reset role;
select is((select after -> 'order' from admin.audit_log where action = 'home_section.reorder' order by id desc limit 1),
          '["suggested_sellers", "promos", "collections", "wishlist_hits"]'::jsonb, 'the reorder is audited');

select * from finish();
rollback;
