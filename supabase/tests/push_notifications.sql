-- pgTAP suite for push notifications (20261106000000).
--
-- Covers the preference gate (enabled / category / quiet hours incl. a window wrapping
-- midnight / urgent bypass), the notifications → push_outbox trigger, token registration
-- (moving a token between accounts), set_push_preferences merging, and the claim/complete
-- cycle (no_tokens close-out, sent, dead-token pruning).

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('27000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-push-1@test.local', '', now(), '{}', '{}', false, false, now(), now()),
  ('27000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzyx-push-2@test.local', '', now(), '{}', '{}', false, false, now(), now());
insert into public.user_profile (user_id, username)
select id, 'zzyx_push_' || right(id::text, 1)
  from auth.users where id in ('27000000-0000-0000-0000-0000000000a1', '27000000-0000-0000-0000-0000000000a2')
on conflict (user_id) do nothing;

-- ── Preference gate ─────────────────────────────────────────────────────────────────────────

select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'high'),
          null, 'defaults allow everything');

-- Act as user 1 for the RPCs.
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select public.set_push_preferences('{"categories": {"price": false}}');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'price', 'normal'),
          'category', 'muted category is suppressed');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'normal'),
          null, 'other categories still allowed');

select public.set_push_preferences(
  '{"quiet_hours": {"enabled": true, "start": "22:00", "end": "08:00", "tz": "UTC"}}');
select is(public.get_push_preferences() #>> '{categories,price}', 'false',
          'setting quiet hours keeps the earlier category toggle (merge, not replace)');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'normal',
                                          '2026-11-04 23:30:00+00'),
          'quiet_hours', 'inside a window that wraps midnight (late)');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'normal',
                                          '2026-11-04 07:59:00+00'),
          'quiet_hours', 'inside a window that wraps midnight (early)');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'normal',
                                          '2026-11-04 12:00:00+00'),
          null, 'outside the window');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'urgent',
                                          '2026-11-04 23:30:00+00'),
          null, 'urgent ignores quiet hours');

select throws_ok($$ select public.set_push_preferences('{"quiet_hours": {"start": "25:00"}}') $$,
                 '22023', null, 'rejects a malformed time');

select public.set_push_preferences('{"enabled": false}');
select is(public._push_suppression_reason('27000000-0000-0000-0000-0000000000a1', 'offer', 'urgent'),
          'disabled', 'master switch off suppresses even urgent');
select public.set_push_preferences('{"enabled": true, "quiet_hours": {"enabled": false}}');

-- ── Tokens ──────────────────────────────────────────────────────────────────────────────────

select public.register_push_token('ExponentPushToken[zzyx-shared]', 'ios', 'iPhone');
select throws_ok($$ select public.register_push_token('not-a-token', 'ios') $$,
                 '22023', null, 'rejects a non-Expo token');

-- User 2 signs in on the same device: the token moves.
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select public.register_push_token('ExponentPushToken[zzyx-shared]', 'ios', 'iPhone');
select is((select user_id from public.user_push_tokens where token = 'ExponentPushToken[zzyx-shared]'),
          '27000000-0000-0000-0000-0000000000a2'::uuid, 'a re-registered token moves to the new account');
select set_config('request.jwt.claims', '{"sub":"27000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.register_push_token('ExponentPushToken[zzyx-u1]', 'android', 'Pixel');

-- ── Outbox ──────────────────────────────────────────────────────────────────────────────────

insert into public.notifications (id, user_id, type, category, title, body)
values
  ('27000000-0000-0000-0000-0000000000b1', '27000000-0000-0000-0000-0000000000a1', 'offer_received', 'offer', 'T1', 'B1'),
  ('27000000-0000-0000-0000-0000000000b2', '27000000-0000-0000-0000-0000000000a1', 'wishlist_hit', 'price', 'T2', 'B2');

select is(
  (select string_agg(status || coalesce(':' || reason, ''), ',' order by notification_id)
     from public.push_outbox
    where notification_id in ('27000000-0000-0000-0000-0000000000b1', '27000000-0000-0000-0000-0000000000b2')),
  'pending,suppressed:category',
  'insert enqueues pending, or suppressed with the reason');

-- Don't let pending rows from other suites/fixtures interfere with the claim.
update public.push_outbox set status = 'failed'
 where status = 'pending' and notification_id <> '27000000-0000-0000-0000-0000000000b1';

-- User 2 has a device but this notification is for user 1 → claimed with user 1's token only.
create temp table t_claim as select * from public.claim_push_outbox(50);
select is((select tokens from t_claim where notification_id = '27000000-0000-0000-0000-0000000000b1'),
          array['ExponentPushToken[zzyx-u1]'], 'claim returns the recipient''s tokens');

select public.complete_push_outbox(
  jsonb_build_array(jsonb_build_object(
    'id', (select outbox_id from t_claim where notification_id = '27000000-0000-0000-0000-0000000000b1'),
    'status', 'sent',
    'tickets', '[{"token":"ExponentPushToken[zzyx-u1]","ticket_id":"t1"}]'::jsonb)),
  array['ExponentPushToken[zzyx-u1]']);
select is((select status from public.push_outbox where notification_id = '27000000-0000-0000-0000-0000000000b1'),
          'sent', 'complete marks the row sent');
select is((select count(*) from public.user_push_tokens where token = 'ExponentPushToken[zzyx-u1]'),
          0::bigint, 'dead tokens are pruned');

-- No devices left for user 1 → the next notification closes out as no_tokens during claim.
insert into public.notifications (id, user_id, type, category, title, body)
values ('27000000-0000-0000-0000-0000000000b3', '27000000-0000-0000-0000-0000000000a1', 'offer_received', 'offer', 'T3', 'B3');
select is((select count(*) from public.claim_push_outbox(50)
            where notification_id = '27000000-0000-0000-0000-0000000000b3'),
          0::bigint, 'a user with no devices is not returned by the claim');
select is((select status from public.push_outbox where notification_id = '27000000-0000-0000-0000-0000000000b3'),
          'no_tokens', '…and is closed out as no_tokens');

select * from finish();
rollback;
