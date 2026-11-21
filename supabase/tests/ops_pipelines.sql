-- pgTAP suite for the ops dashboards, part 2 (20261120000000, ITS-117):
-- price refresh and enrichment overviews, queueing a card's price refresh, notifications.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('11720000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-ops2-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 3) n;
insert into admin.members (user_id, role) values
  ('11720000-0000-0000-0000-0000000000a1', 'ops'),
  ('11720000-0000-0000-0000-0000000000a2', 'editor');

-- Card 1 is in a collection (tracked); card 2 isn't.
insert into public.cards (id, name, set_name, genre, grades_prices)
values ('11720000-0000-0000-0000-000000000001', 'Zzyx Ops Card', 'Zzyx Ops Set', 'Baseball', '{}'),
       ('11720000-0000-0000-0000-000000000002', 'Zzyx Untracked', 'Zzyx Ops Set', 'Baseball', '{}');
insert into public.collections (id, user_id, name)
values ('11720000-0000-0000-0000-0000000000c1', '11720000-0000-0000-0000-0000000000a3', 'Zzyx ops col');
insert into public.collection_items (collection_id, user_id, item_kind, ref_id, quantity)
values ('11720000-0000-0000-0000-0000000000c1', '11720000-0000-0000-0000-0000000000a3', 'card',
        '11720000-0000-0000-0000-000000000001', 1);

insert into public.price_refresh_runs (id, req_id, started_at, finished_at, status, claimed, refreshed, unchanged, unresolved, failed, resolves_used)
values ('11720000-0000-0000-0000-0000000000e1', 'zzyx-req', now(), now(), 'completed', 1, 1, 0, 0, 0, 1);
insert into public.card_price_refresh_attempts (run_id, card_id, outcome, match_confidence, matched_description)
values ('11720000-0000-0000-0000-0000000000e1', '11720000-0000-0000-0000-000000000001', 'resolved_match', 0.01, 'Zzyx weak match');

insert into public.enrichment_runs (id, req_id, started_at, finished_at, status, vendors, claimed, enriched, no_match, failed)
values ('11720000-0000-0000-0000-0000000000e2', 'zzyx-req', now(), now(), 'completed', array['zzyxvendor'], 1, 1, 0, 0);
insert into public.card_enrichment_attempts (run_id, card_id, vendor, outcome, best_score, matched_title, image_url)
values ('11720000-0000-0000-0000-0000000000e2', '11720000-0000-0000-0000-000000000001', 'zzyxvendor', 'hit', 0.001,
        'Zzyx blurry', 'https://zzyx.invalid/a.jpg');

insert into public.notifications (user_id, type, category, title, body, payload, read_at)
values
  ('11720000-0000-0000-0000-0000000000a3', 'wishlist_hit', 'price', 'Hit', 'b', '{}', now()),
  ('11720000-0000-0000-0000-0000000000a3', 'wishlist_hit', 'price', 'Hit', 'b', '{}', null),
  ('11720000-0000-0000-0000-0000000000a3', 'wishlist_hit', 'price', 'Hits', 'b', '{"summary": true, "count": 9}', null);

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

-- Baseline counts for the notification check, taken before switching roles.
create temp table base as
  select count(*) filter (where coalesce((payload ->> 'summary')::boolean, false) = false)::int as individual,
         count(*) filter (where coalesce((payload ->> 'summary')::boolean, false))::int as summary
    from public.notifications where type = 'wishlist_hit' and created_at > now() - interval '7 days';
grant select on base to authenticated;

-- ── Access ──
select pg_temp.act_as('11720000-0000-0000-0000-0000000000a2');
select throws_ok($$ select admin.price_refresh_overview() $$, '42501', null, 'an editor cannot read the price refresh overview');
select throws_ok($$ select admin.enrichment_overview() $$, '42501', null, 'or the enrichment overview');
select throws_ok($$ select admin.notification_overview() $$, '42501', null, 'or the notification overview');
select throws_ok($$ select admin.queue_card_price_refresh('11720000-0000-0000-0000-000000000001') $$, '42501', null,
  'or queue a refresh');
select pg_temp.act_as('11720000-0000-0000-0000-0000000000a3');
select throws_ok($$ select admin.price_refresh_overview() $$, '42501', null, 'a non-member is denied');

-- ── Price refresh ──
select pg_temp.act_as('11720000-0000-0000-0000-0000000000a1');
select ok(admin.price_refresh_overview() -> 'backlog' ? 'tracked_cards', 'the overview includes the backlog view');
select is(admin.price_refresh_overview() -> 'low_confidence' -> 0 ->> 'matched_description', 'Zzyx weak match',
  'the weakest match is listed first');
select is(admin.price_refresh_overview() -> 'runs' -> 0 ->> 'id', '11720000-0000-0000-0000-0000000000e1',
  'recent runs are listed, newest first');

select is(admin.queue_card_price_refresh('11720000-0000-0000-0000-000000000001') ->> 'queued', 'true',
  'ops queues a tracked card');
reset role;
select is((select price_refresh_attempted_at from public.cards where id = '11720000-0000-0000-0000-000000000001'),
  '-infinity'::timestamptz, 'the card is due on the next run');
select is((select action || ':' || target_id from admin.audit_log where target_type = 'card' order by id desc limit 1),
  'card.queue_price_refresh:11720000-0000-0000-0000-000000000001', 'queueing is audited');
select pg_temp.act_as('11720000-0000-0000-0000-0000000000a1');
select throws_ok($$ select admin.queue_card_price_refresh('11720000-0000-0000-0000-000000000002') $$, '22023', null,
  'a card in no collection is refused');
select throws_ok($$ select admin.queue_card_price_refresh('11720000-0000-0000-0000-0000000000ff') $$, 'P0002', null,
  'an unknown card is reported');

-- ── Enrichment ──
select ok(admin.enrichment_overview() -> 'backlog' ? 'unenriched', 'the overview includes the backlog view');
select is(admin.enrichment_overview() -> 'low_score_hits' -> 0 ->> 'matched_title', 'Zzyx blurry',
  'the lowest-scoring image hit is listed first');

-- ── Notifications ──
select is((admin.notification_overview(24 * 7) -> 'wishlist_hits' ->> 'individual')::int,
          (select individual from base), 'individual wishlist-hit notifications are counted');
select is((admin.notification_overview(24 * 7) -> 'wishlist_hits' ->> 'summary')::int,
          (select summary from base), 'summary notifications are counted separately');
select ok(exists (select 1 from jsonb_array_elements(admin.notification_overview(24 * 7) -> 'by_type') e
                   where e ->> 'type' = 'wishlist_hit' and (e ->> 'read')::int >= 1),
  'volume by type includes read counts');

select * from finish();
rollback;
