-- pgTAP suite for promo boxes (20261114000000, ITS-191).
--
-- Fixtures: an owner, an editor, an ops member and a non-member; one listed storefront with five
-- cards in "Zzyx 2027 Topps" plus one other card. Promo sections are filled the same way the
-- marketplace-feed-refresh edge function does it (due_marketplace_feeds → marketplace_feed_listings
-- → write_marketplace_section).

begin;
create extension if not exists pgtap with schema extensions;

select plan(54);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('19100000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-owner@test.local',  '', now(), '{}', '{}', false, false, now(), now()),
  ('19100000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-editor@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('19100000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-ops@test.local',    '', now(), '{}', '{}', false, false, now(), now()),
  ('19100000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-nobody@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('19100000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-promo-seller@test.local', '', now(), '{}', '{}', false, false, now(), now());

insert into admin.members (user_id, role) values
  ('19100000-0000-0000-0000-0000000000a1', 'owner'),
  ('19100000-0000-0000-0000-0000000000a2', 'editor'),
  ('19100000-0000-0000-0000-0000000000a3', 'ops');

insert into public.user_profile (user_id, username)
values ('19100000-0000-0000-0000-0000000000a9', 'zzyx_promo_seller')
on conflict (user_id) do nothing;

-- Cards 1-5: the product's set (card 5 worth the most). Card 6: another set.
insert into public.cards (id, name, set_name, genre, grades_prices, release_date, sealed)
select ('19100000-0000-0000-0000-00000000000' || n)::uuid, 'Zzyx Promo Card ' || n,
       case when n = 6 then 'Zzyx Other Set' else 'Zzyx 2027 Topps' end,
       'Baseball', jsonb_build_object('ungraded', n * 1000), '2027-02-01', false
  from generate_series(1, 6) n;

insert into public.collections (id, user_id, name, is_storefront)
values ('19100000-0000-0000-0000-0000000000c9', '19100000-0000-0000-0000-0000000000a9', 'Zzyx Promo SF', true);
insert into public.storefronts (id, user_id, is_listed, collection_ids)
values ('19100000-0000-0000-0000-0000000000e9', '19100000-0000-0000-0000-0000000000a9', true,
        array['19100000-0000-0000-0000-0000000000c9']::uuid[]);
insert into public.collection_items (id, collection_id, user_id, item_kind, ref_id, quantity)
select ('19100000-0000-0000-0000-0000000000f' || n)::uuid, '19100000-0000-0000-0000-0000000000c9',
       '19100000-0000-0000-0000-0000000000a9', 'card', ('19100000-0000-0000-0000-00000000000' || n)::uuid, 1
  from generate_series(1, 6) n;

-- Act as a user (null = anon).
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

-- What the edge function does for one section.
create function pg_temp.refresh_section(p_key text) returns int language plpgsql as $$
declare d record; n int;
begin
  select * into d from public.due_marketplace_feeds(array[p_key], true);
  select public.write_marketplace_section(p_key, coalesce(jsonb_agg(to_jsonb(f)), '[]'))
    into n
    from public.marketplace_feed_listings(d.filter, d.order_by, d.result_limit) f;
  return n;
end $$;

grant execute on function pg_temp.act_as(uuid) to anon, authenticated;

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- A product release payload scoped to the fixture set.
create function pg_temp.release_payload() returns jsonb language sql as $$
  select jsonb_build_object(
    'template', 'product_release', 'title', '2027 Topps Series 1', 'subtitle', 'Hobby boxes land soon',
    'badge', 'coming_soon', 'accent', 'blue', 'placement', 'home_hero', 'priority', 10,
    'filter', jsonb_build_object('sets', jsonb_build_array('Zzyx 2027 Topps')),
    'order_by', 'value_desc', 'release_date', (now() + interval '3 days')::text, 'min_cards', 4,
    'cta', jsonb_build_object('label', 'See all', 'kind', 'see_all'))
$$;
grant execute on function pg_temp.release_payload() to authenticated;

-- ── Access ──────────────────────────────────────────────────────────────────────────────────

select pg_temp.act_as(null);
select throws_ok($$ select admin.upsert_promo('{}') $$, '42501', null, 'anon cannot call admin RPCs');
select throws_ok($$ select * from admin.promos $$, '42501', null, 'anon cannot read admin.promos');
select lives_ok($$ select * from public.get_active_promos() $$, 'anon can read active promos');

select pg_temp.act_as('19100000-0000-0000-0000-0000000000a4');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload()) $$, '42501', 'not authorized', 'non-member cannot create');
select throws_ok($$ select * from admin.list_promos() $$, '42501', 'not authorized', 'non-member cannot list');
select throws_ok($$ select admin.preview_promo_matches('{}') $$, '42501', 'not authorized', 'non-member cannot preview matches');
select throws_ok($$ select * from admin.promo_revisions $$, '42501', null, 'revisions are not directly readable');
select throws_ok($$ select admin._save_promo(null, '{}', null, null, 'x') $$, '42501', null, 'internal helpers are not executable');

select pg_temp.act_as('19100000-0000-0000-0000-0000000000a3');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload()) $$, '42501', 'not authorized', 'ops cannot create promos');

-- ── Create + validation (editor) ────────────────────────────────────────────────────────────

select pg_temp.act_as('19100000-0000-0000-0000-0000000000a2');

insert into t select 'release', admin.upsert_promo(pg_temp.release_payload()) ->> 'id';
select is((select (admin.get_promo((select v::uuid from t where k = 'release'))) ->> 'slug'), '2027-topps-series-1',
          'slug is derived from the title');
select is((select (admin.get_promo((select v::uuid from t where k = 'release'))) ->> 'phase'), 'draft', 'new promos are drafts');
select is((select (admin.get_promo((select v::uuid from t where k = 'release'))) ->> 'created_by_email'),
          'zzyx-promo-editor@test.local', 'created_by is the editor');

select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() - 'filter') $$,
                 '22023', 'a product release needs at least one set', 'a product release needs a set');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() - 'release_date') $$,
                 '22023', 'a product release needs a release date', 'a product release needs a release date');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"filter": {"sets": ["x"], "nme_query": "y"}}') $$,
                 '22023', null, 'unknown filter keys are rejected');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"filter": {"sets": ["x"], "pin_ref_ids": []}}') $$,
                 '22023', null, 'pins go in pinned_ref_ids, not the filter');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"colour": "red"}') $$,
                 '22023', 'unknown promo field(s): colour', 'unknown fields are rejected');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"accent": "#ff0000"}') $$,
                 '22023', null, 'accent must be a palette key, not hex');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"cta": {"label": "Go", "kind": "url", "target": "http://x.test"}}') $$,
                 '22023', 'a link button needs an https:// URL', 'link buttons must be https');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"starts_at": "2030-01-02", "ends_at": "2030-01-01"}') $$,
                 '22023', null, 'ends_at must be after starts_at');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"pinned_ref_ids": ["nope"]}') $$,
                 '22023', null, 'bad UUIDs are reported as bad input');
select throws_ok($$ select admin.upsert_promo(pg_temp.release_payload() || '{"slug": "2027-topps-series-1"}') $$,
                 '22023', 'slug "2027-topps-series-1" is already used by another promo', 'slugs are unique');

-- Update with optimistic concurrency.
select is((admin.upsert_promo(jsonb_build_object('id', (select v from t where k = 'release'), 'revision', 1,
                                                 'subtitle', 'Hobby boxes land Friday')) ->> 'revision')::int,
          2, 'an update bumps the revision');
select throws_ok($$ select admin.upsert_promo(jsonb_build_object('id', (select v from t where k = 'release'),
                                                                'revision', 1, 'subtitle', 'stale')) $$,
                 '40001', null, 'saving over a newer revision is refused');

-- ── Match preview ───────────────────────────────────────────────────────────────────────────

select is((admin.preview_promo_matches('{"sets": ["Zzyx 2027 Topps"]}') ->> 'count')::int, 5, 'preview counts matching listings');
select is((admin.preview_promo_matches('{"sets": ["Zzyx 2027 Topps"]}', 'value_desc', '{}', '{}', 2)
            -> 'sample' -> 0 ->> 'name'), 'Zzyx Promo Card 5', 'preview sample follows order_by');
select is((admin.preview_promo_matches('{"sets": ["Zzyx 2027 Topps"]}', 'value_desc',
                                       array['19100000-0000-0000-0000-000000000006']::uuid[],
                                       array['19100000-0000-0000-0000-000000000005']::uuid[], 3)
            -> 'sample' -> 0 ->> 'name'), 'Zzyx Promo Card 6', 'a pinned card leads, even outside the filter');
select is((admin.preview_promo_matches('{"sets": ["Zzyx 2027 Topps"]}', 'value_desc',
                                       array['19100000-0000-0000-0000-000000000006']::uuid[],
                                       array['19100000-0000-0000-0000-000000000005']::uuid[], 3) ->> 'count')::int,
          5, 'exclusions drop a card (5 matches - 1 excluded + 1 pinned)');

-- ── Publish, section, schedule ──────────────────────────────────────────────────────────────

select is(admin.set_promo_status((select v::uuid from t where k = 'release'), 'published') ->> 'phase', 'live',
          'publishing makes it live');
insert into t values ('section', 'promo_' || replace((select v from t where k = 'release'), '-', ''));

reset role;
select ok(exists (select 1 from public.due_marketplace_feeds() where key = (select v from t where k = 'section')),
          'the promo section is due for the next feed refresh');
select ok(not exists (select 1 from public.get_marketplace_sections() where section_key = (select v from t where k = 'section')),
          'promo sections stay off the marketplace screen');

select pg_temp.act_as(null);
select is((select mode from public.get_active_promos('home_hero')), 'coming_soon',
          'before the release date it is coming soon');
select is((select jsonb_array_length(items) from public.get_active_promos('home_hero')), 0,
          'coming soon returns no cards');
select is((select count(*)::int from public.get_active_promos('home_rail')), 0, 'placement filters');

-- Release date passes, but the section hasn't been filled yet → still coming soon.
reset role;
update admin.promos set release_date = now() - interval '1 hour' where id = (select v::uuid from t where k = 'release');
select pg_temp.act_as(null);
select is((select mode from public.get_active_promos('home_hero')), 'coming_soon',
          'after release, too few cached cards keeps it coming soon');

reset role;
select is(pg_temp.refresh_section((select v from t where k = 'section')), 5, 'the feed refresh fills the promo section');
select pg_temp.act_as(null);
select is((select mode from public.get_active_promos('home_hero')), 'cards', 'released + enough cards → cards');
select is((select items -> 0 ->> 'name' from public.get_active_promos('home_hero')), 'Zzyx Promo Card 5',
          'cards come from the section in order_by order');

reset role;
update admin.promos set min_cards = 6 where id = (select v::uuid from t where k = 'release');
select pg_temp.act_as(null);
select is((select mode from public.get_active_promos('home_hero')), 'coming_soon', 'min_cards is respected');

reset role;
update admin.promos set min_cards = 4, starts_at = now() + interval '1 day' where id = (select v::uuid from t where k = 'release');
select pg_temp.act_as(null);
select is((select count(*)::int from public.get_active_promos()), 0, 'a promo before its start is not returned');

reset role;
update admin.promos set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day'
 where id = (select v::uuid from t where k = 'release');
select pg_temp.act_as(null);
select is((select count(*)::int from public.get_active_promos()), 0, 'a promo after its end is not returned');

reset role;
update admin.promos set starts_at = null, ends_at = null where id = (select v::uuid from t where k = 'release');

-- Unpublish → gone and the section is disabled.
select pg_temp.act_as('19100000-0000-0000-0000-0000000000a2');
select is(admin.set_promo_status((select v::uuid from t where k = 'release'), 'draft') ->> 'phase', 'draft', 'unpublish');
select pg_temp.act_as(null);
select is((select count(*)::int from public.get_active_promos()), 0, 'drafts are never returned');
reset role;
select is((select enabled from public.marketplace_section_meta where key = (select v from t where k = 'section')), false,
          'unpublishing disables the section');

-- ── Announcement ────────────────────────────────────────────────────────────────────────────

select pg_temp.act_as('19100000-0000-0000-0000-0000000000a2');
insert into t select 'announce', admin.upsert_promo('{"template": "announcement", "title": "Card show this weekend",
  "cta": {"label": "Details", "kind": "url", "target": "https://example.test/show"}}') ->> 'id';
select admin.set_promo_status((select v::uuid from t where k = 'announce'), 'published');
select pg_temp.act_as(null);
select is((select mode from public.get_active_promos('home_rail')), 'announcement',
          'an announcement without card criteria is an announcement');
reset role;
select ok(not exists (select 1 from public.marketplace_section_meta
                       where key = 'promo_' || replace((select v from t where k = 'announce'), '-', '')),
          'an announcement without cards gets no section');

-- ── Revisions, preview tokens, audit ────────────────────────────────────────────────────────

insert into t select 'rev1', r.id::text from admin.promo_revisions r
 where r.promo_id = (select v::uuid from t where k = 'release') and r.revision = 1;
select pg_temp.act_as('19100000-0000-0000-0000-0000000000a2');
select is((admin.restore_promo_revision((select v::bigint from t where k = 'rev1')) ->> 'subtitle'),
          'Hobby boxes land soon', 'restoring revision 1 brings back its content');
select is(jsonb_array_length(admin.get_promo((select v::uuid from t where k = 'release')) -> 'revisions'), 3,
          'the restore is saved as a new revision');

insert into t select 'token', admin.issue_preview_token((select v::uuid from t where k = 'release')) ->> 'token';
select pg_temp.act_as(null);
select is((select status from public.get_promo_preview((select v from t where k = 'token'))), 'draft',
          'a preview token shows a draft');
select is((select item_count from public.get_promo_preview((select v from t where k = 'token'))), 5,
          'preview computes cards live');
select is((select count(*)::int from public.get_promo_preview(repeat('0', 48))), 0, 'an unknown token shows nothing');

reset role;
select results_eq(
  $$ select action from admin.audit_log where target_type = 'promo'
       and target_id = (select v from t where k = 'release') order by id $$,
  $$ values ('promo.create'), ('promo.update'), ('promo.set_status'), ('promo.set_status'),
            ('promo.restore'), ('promo.preview_token') $$,
  'every write to a promo is audited, in order');

-- ── Storage ─────────────────────────────────────────────────────────────────────────────────

select pg_temp.act_as('19100000-0000-0000-0000-0000000000a4');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('promo-assets', 'zzyx/hero.png') $$,
                 '42501', null, 'non-members cannot upload promo images');
select pg_temp.act_as('19100000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('promo-assets', 'zzyx/hero.png') $$,
                'editors can upload promo images');

select * from finish();
rollback;
