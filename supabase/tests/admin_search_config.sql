-- pgTAP suite for the search_config console RPCs (20261122000000, ITS-57).

begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('05700000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-sc-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 3) n;
insert into admin.members (user_id, role) values
  ('05700000-0000-0000-0000-0000000000a1', 'ops'),
  ('05700000-0000-0000-0000-0000000000a2', 'editor');

-- Two cards that tie on text for 'zzyx kraken', one of them wishlisted, so popularity decides.
insert into public.cards (id, name, set_name, genre) values
  ('05700000-0000-0000-0000-0000000000c1', 'Zzyx Kraken', 'Zzyx Depths', 'pokemon'),
  ('05700000-0000-0000-0000-0000000000c2', 'Zzyx Kraken', 'Zzyx Shallows', 'pokemon');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

update public.search_config set weight_fts = 0.6, weight_pop = 0.05, snippet_min_words = 5,
       snippet_max_words = 20, suggestion_query_idx = 7 where id = 1;
create temp table before_cfg as select * from public.search_config where id = 1;
grant select on before_cfg to authenticated;

-- ── Access ──
select pg_temp.act_as('05700000-0000-0000-0000-0000000000a2');
select throws_ok($$ select admin.search_config_get() $$, '42501', null, 'an editor cannot read the search config');
select throws_ok($$ select admin.update_search_config('{"weight_pop": 0.1}') $$, '42501', null, 'or change it');
select throws_ok($$ select admin.preview_search_config('x', '{}') $$, '42501', null, 'or preview it');
select pg_temp.act_as('05700000-0000-0000-0000-0000000000a3');
select throws_ok($$ select admin.search_config_get() $$, '42501', null, 'a non-member cannot read it');

-- ── Read ──
select pg_temp.act_as('05700000-0000-0000-0000-0000000000a1');
select is((admin.search_config_get() -> 'config' ->> 'weight_fts')::numeric, 0.6, 'ops reads the current values');
select is(jsonb_array_length(admin.search_config_get() -> 'fields'), 14, 'with the editable fields and their bounds');
select ok(not (admin.search_config_get() -> 'fields') @> '[{"field": "prefetch_enabled"}]',
          'cron-owned fields are not editable');

-- ── Validation ──
select throws_ok($$ select admin.update_search_config('{"prefetch_enabled": true}') $$, '22023',
  'prefetch_enabled can''t be edited here', 'cron-owned fields are refused');
select throws_ok($$ select admin.update_search_config('{"nope": 1}') $$, '22023', null, 'unknown fields are refused');
select throws_ok($$ select admin.update_search_config('{"weight_pop": 1.5}') $$, '22023',
  'weight_pop must be between 0 and 1', 'out-of-range values are refused, naming the field');
select throws_ok($$ select admin.update_search_config('{"weight_pop": "0.1"}') $$, '22023', null, 'strings are not numbers');
select throws_ok($$ select admin.update_search_config('{"snippet_max_words": 10.5}') $$, '22023', null, 'counts must be whole');
select throws_ok($$ select admin.update_search_config('{"snippet_min_words": 30}') $$, '22023',
  'snippet_min_words must be less than snippet_max_words', 'snippet min must stay under max');
select throws_ok($$ select admin.update_search_config('{"suggestion_queries": []}') $$, '22023', null, 'suggestions cannot be empty');
select throws_ok($$ select admin.update_search_config('{"suggestion_queries": ["ok", "  "]}') $$, '22023', null, 'or blank');
select throws_ok($$ select admin.update_search_config('[1]') $$, '22023', null, 'changes must be an object');
select is((select weight_pop from public.search_config where id = 1), 0.05, 'a refused change writes nothing');

-- ── Update ──
select is(admin.update_search_config('{"weight_pop": 0.2, "weight_fts": 0.6, "suggestion_queries": [" a ", "b"]}',
                                     'test popularity') ->> 'weight_pop', '0.2', 'ops can change values');
select is((select row(weight_pop, suggestion_queries, suggestion_query_idx)::text from public.search_config where id = 1),
          '(0.2,"{a,b}",1)', 'suggestions are trimmed and the rotation index stays in range');
reset role;
select is((select row(before, after)::text from admin.audit_log where action = 'search_config.update'
            order by id desc limit 1),
          row('{"weight_pop": 0.05, "suggestion_queries": ["2024 topps chrome baseball rookies", "patrick mahomes", "lebron james prizm rookie", "shohei ohtani topps", "luka doncic prizm rookie", "ken griffey jr upper deck", "tom brady rookie card", "mike trout rookie", "kobe bryant rookie", "aaron judge"]}'::jsonb,
              '{"reason": "test popularity", "weight_pop": 0.2, "suggestion_queries": ["a", "b"]}'::jsonb)::text,
          'the audit row holds only the fields that changed, and the reason');
select pg_temp.act_as('05700000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(admin.search_config_get() -> 'history'), 1, 'the change shows in the history');
select lives_ok($$ select admin.update_search_config('{"weight_pop": 0.2}') $$, 'saving the same value works');
reset role;
select is((select count(*)::int from admin.audit_log where action = 'search_config.update'), 1,
          'but writes no audit row');

-- ── Preview ──
reset role;
insert into public.collections (id, user_id, name, is_wishlist)
values ('05700000-0000-0000-0000-0000000000d1', '05700000-0000-0000-0000-0000000000a3', 'wl', true);
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values ('05700000-0000-0000-0000-0000000000d1', '05700000-0000-0000-0000-0000000000a3', 'card',
        '05700000-0000-0000-0000-0000000000c2', 1);
select pg_temp.act_as('05700000-0000-0000-0000-0000000000a1');
create temp table pv as
  select admin.preview_search_config('zzyx kraken', '{"weight_pop": 0, "min_score": 0}', 5) as r;
select is((select r -> 'current' -> 0 ->> 'id' from pv), '05700000-0000-0000-0000-0000000000c2',
          'with popularity, the wishlisted card ranks first');
select is((select (r -> 'current' -> 0 ->> 'other_rank') from pv), '2',
          'and each row carries its rank under the proposed values');
select is((select (r -> 'proposed' -> 0 -> 'reason' ->> 'w_pop')::numeric from pv), 0::numeric,
          'the proposed list is scored with the proposed values');
select is((select weight_pop from public.search_config where id = 1), 0.2, 'a preview saves nothing');

reset role;
select * from finish();
rollback;
