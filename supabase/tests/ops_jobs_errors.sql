-- pgTAP suite for the ops dashboards, part 1 (20261118000001, ITS-117):
-- scheduled jobs (with edge-function HTTP tracking and pause/resume) and client errors.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at)
select ('11700000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'zzyx-ops-' || n || '@test.local', '', now(), '{}', '{}',
       false, false, now(), now()
  from generate_series(1, 4) n;
insert into admin.members (user_id, role) values
  ('11700000-0000-0000-0000-0000000000a1', 'ops'),
  ('11700000-0000-0000-0000-0000000000a2', 'editor');

-- An edge-function job whose latest request came back 401 although the cron run "succeeded"
-- (the wrong-edge_token case), and a SQL job whose last run failed.
select cron.schedule('zzyx-http-job', '0 0 1 1 *',
  $$ select net.http_post(url := 'http://zzyx.invalid/functions/v1/zzyx-fn') $$);
select cron.schedule('zzyx-sql-job', '0 0 1 1 *', $$ select 1 $$);

create temp table req as
  select net.http_post(url := 'http://zzyx.invalid/functions/v1/zzyx-fn') as id;
insert into net._http_response (id, status_code, content, timed_out, error_msg)
select id, 401, '{"error":"unauthorized"}', false, null from req;

insert into cron.job_run_details (jobid, runid, status, return_message, start_time, end_time)
select jobid, 990000001, 'succeeded', '1 row', now() - interval '1 minute', now() - interval '59 seconds'
  from cron.job where jobname = 'zzyx-http-job';
insert into cron.job_run_details (jobid, runid, status, return_message, start_time, end_time)
select jobid, 990000002, 'failed', 'ERROR: boom', now() - interval '1 minute', now() - interval '59 seconds'
  from cron.job where jobname = 'zzyx-sql-job';

insert into public.client_errors (user_id, context, message, metadata, created_at) values
  ('11700000-0000-0000-0000-0000000000a3', 'zzyx_checkout', 'Network request failed', '{"step": 2}', now() - interval '1 hour'),
  ('11700000-0000-0000-0000-0000000000a4', 'zzyx_checkout', 'Timeout', null, now() - interval '10 minutes'),
  (null,                                   'zzyx_search',   'Bad response', null, now() - interval '2 hours'),
  ('11700000-0000-0000-0000-0000000000a3', 'zzyx_search',   'Old error', null, now() - interval '3 days');

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

-- ── Tracking ──
select is((select function from admin.cron_http_requests where request_id = (select id from req)), 'zzyx-fn',
  'an edge-function request is tracked by function name');
select is((select count(*)::int from admin.cron_http_requests where request_id > (select id from req)), 0,
  'nothing else was tracked');

-- ── Access ──
select pg_temp.act_as('11700000-0000-0000-0000-0000000000a3');
select throws_ok($$ select * from admin.list_cron_jobs() $$, '42501', null, 'a non-member cannot list jobs');
select throws_ok($$ select * from admin.client_error_groups() $$, '42501', null, 'or client errors');
select pg_temp.act_as('11700000-0000-0000-0000-0000000000a2');
select throws_ok($$ select * from admin.list_cron_jobs() $$, '42501', null, 'an editor cannot list jobs');
select throws_ok($$ select admin.set_cron_job_active('zzyx-sql-job', false) $$, '42501', null, 'or pause one');
select pg_temp.act_as(null);
select throws_ok($$ select * from admin.list_cron_jobs() $$, '42501', null, 'anon is denied');

-- ── Jobs ──
select pg_temp.act_as('11700000-0000-0000-0000-0000000000a1');
create temp table jobs as select * from admin.list_cron_jobs();

select is((select kind || '/' || function from jobs where jobname = 'zzyx-http-job'), 'http/zzyx-fn',
  'a job calling an edge function is matched to it');
select is((select last_run_status from jobs where jobname = 'zzyx-http-job'), 'succeeded',
  'cron reports the run as succeeded');
select is((select last_http_status from jobs where jobname = 'zzyx-http-job'), '401',
  'but the tracked response shows the 401');
select is((select healthy from jobs where jobname = 'zzyx-http-job'), false, 'so the job is flagged unhealthy');
select is((select http_failed_6h || '/' || http_total_6h from jobs where jobname = 'zzyx-http-job'), '1/1',
  'HTTP failures are counted');
select is((select kind from jobs where jobname = 'zzyx-sql-job'), 'sql', 'a plain SQL job is kind sql');
select is((select healthy from jobs where jobname = 'zzyx-sql-job'), false, 'a failed last run is unhealthy');
select is((select failed_runs_24h from jobs where jobname = 'zzyx-sql-job'), 1, 'failed runs are counted');
select ok((select http_tracked from jobs limit 1), 'tracking is reported as installed');

select is((admin.cron_job_history('zzyx-http-job') -> 'requests' -> 0 ->> 'status_code'), '401',
  'history lists the tracked responses');
select throws_ok($$ select admin.cron_job_history('zzyx-nope') $$, 'P0002', null, 'an unknown job is reported');

-- ── Pause / resume ──
select is(admin.set_cron_job_active('zzyx-sql-job', false), false, 'ops pauses a job');
reset role;
select is((select active from cron.job where jobname = 'zzyx-sql-job'), false, 'the job is paused in pg_cron');
select is((select action || ':' || target_id from admin.audit_log where target_type = 'cron_job' order by id desc limit 1),
  'cron_job.pause:zzyx-sql-job', 'the pause is audited');

-- ── Client errors ──
select pg_temp.act_as('11700000-0000-0000-0000-0000000000a1');
select is((select errors || '/' || users from admin.client_error_groups(24) where context = 'zzyx_checkout'), '2/2',
  'errors are grouped by context with distinct users');
select is((select errors from admin.client_error_groups(24) where context = 'zzyx_search'), 1,
  'errors outside the window are left out');
select is((select user_email from admin.list_client_errors('zzyx_checkout', 24) where message = 'Network request failed'),
  'zzyx-ops-3@test.local', 'the drill-down shows the user''s email');

select * from finish();
rollback;
