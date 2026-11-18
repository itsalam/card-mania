-- ITS-117 (part 1): ops dashboards for scheduled jobs and client errors.
--
--   admin.list_cron_jobs()                    every pg_cron job: schedule, on/off, last run, runs and
--                                             failures in 24 h, and for jobs that call an edge function,
--                                             the HTTP status of its latest request
--   admin.cron_job_history(jobname, limit)    recent runs and tracked HTTP responses for one job
--   admin.set_cron_job_active(jobname, on)    pause or resume a job (audited)
--   admin.client_error_groups(hours)          client_errors grouped by context
--   admin.list_client_errors(context, hours, limit)   the rows behind one group, with the user's email
--
-- Reads need the ops role, pausing needs ops too; owner always passes.
--
-- Why HTTP tracking: cron.job_run_details says 'succeeded' as soon as net.http_post() has
-- queued the request, even when the edge function then answers 401 (e.g. a wrong Vault
-- edge_token). The response lands in net._http_response (kept ~6 h by pg_net), but nothing links
-- it back to the job: the queued request, which held the URL, is deleted once sent. A trigger on
-- net.http_request_queue keeps (request id, edge function name) in admin.cron_http_requests, and
-- each job is matched to its function by the '/functions/v1/<name>' in its command.

-- ── 1. HTTP request tracking ───────────────────────────────────────────────────────────────────
create table if not exists admin.cron_http_requests (
  request_id  bigint      primary key,
  function    text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists cron_http_requests_function_idx
  on admin.cron_http_requests (function, request_id desc);
alter table admin.cron_http_requests enable row level security;
revoke all on admin.cron_http_requests from public, anon, authenticated;

-- Records edge-function calls only, by name (never the project URL or headers).
create or replace function admin._track_http_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fn text := substring(new.url from '/functions/v1/([A-Za-z0-9_-]+)');
begin
  if v_fn is not null then
    insert into admin.cron_http_requests (request_id, function)
    values (new.id, v_fn)
    on conflict (request_id) do nothing;
  end if;
  return new;
exception when others then
  -- Tracking must never break the request itself.
  return new;
end;
$$;

-- The trigger needs TRIGGER on an extension-owned table. If the project doesn't allow it, skip
-- tracking: the jobs page then shows HTTP status as "not tracked" instead of failing the deploy.
do $$
begin
  drop trigger if exists admin_track_http_request on net.http_request_queue;
  create trigger admin_track_http_request
    after insert on net.http_request_queue
    for each row execute function admin._track_http_request();
exception when insufficient_privilege or undefined_table then
  raise notice 'HTTP request tracking not installed: %', sqlerrm;
end;
$$;

-- pg_net drops responses after ~6 h; keep the tracking rows a day, then prune.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-http-requests-prune') then
    perform cron.unschedule('cron-http-requests-prune');
  end if;
end;
$$;
select cron.schedule(
  'cron-http-requests-prune',
  '41 * * * *',
  $$ delete from admin.cron_http_requests where created_at < now() - interval '1 day' $$
);

-- The edge function a job calls, if it calls one.
create or replace function admin._cron_job_function(p_command text)
returns text
language sql
immutable
set search_path = ''
as $$ select substring(p_command from '/functions/v1/([A-Za-z0-9_-]+)') $$;

-- ── 2. Scheduled jobs ──────────────────────────────────────────────────────────────────────────
-- http_ok: null when the job calls no edge function or nothing tracked has come back yet.
-- A request that hasn't been answered yet (no response row) is reported as 'pending'.
create or replace function admin.list_cron_jobs()
returns table (
  jobid             bigint,
  jobname           text,
  schedule          text,
  active            boolean,
  kind              text,         -- 'http' (calls an edge function) or 'sql'
  function          text,
  last_run_at       timestamptz,
  last_run_status   text,
  last_run_message  text,
  last_run_ms       int,
  runs_24h          int,
  failed_runs_24h   int,
  http_tracked      boolean,      -- request tracking is installed
  last_http_at      timestamptz,
  last_http_status  text,         -- '200', '401', 'timeout', 'error', 'pending'
  last_http_error   text,
  http_failed_6h    int,          -- non-2xx, timed out or errored, in pg_net's retention window
  http_total_6h     int,
  healthy           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tracked boolean := exists (
    select 1 from pg_trigger t
     where t.tgname = 'admin_track_http_request' and not t.tgisinternal);
begin
  perform admin._require_role('ops');
  return query
  with jobs as (
    select j.jobid, j.jobname::text as jobname, j.schedule::text as schedule, j.active,
           admin._cron_job_function(j.command) as fn
      from cron.job j
  ),
  last_run as (
    select distinct on (d.jobid) d.jobid, d.start_time, d.end_time, d.status, d.return_message
      from cron.job_run_details d
     where d.jobid in (select jobs.jobid from jobs)
     order by d.jobid, d.runid desc
  ),
  runs as (
    select d.jobid,
           count(*)::int as total,
           count(*) filter (where d.status = 'failed')::int as failed
      from cron.job_run_details d
     where d.start_time > now() - interval '24 hours'
     group by d.jobid
  ),
  http as (
    select r.function,
           count(*) filter (where resp.id is not null)::int as total,
           count(*) filter (where resp.timed_out or resp.error_msg is not null
                               or resp.status_code < 200 or resp.status_code >= 300)::int as failed
      from admin.cron_http_requests r
      left join net._http_response resp on resp.id = r.request_id
     where r.created_at > now() - interval '6 hours'
     group by r.function
  ),
  last_http as (
    select distinct on (r.function) r.function, r.created_at,
           case
             when resp.id is null then 'pending'
             when resp.timed_out then 'timeout'
             when resp.error_msg is not null then 'error'
             else resp.status_code::text
           end as status,
           coalesce(resp.error_msg,
                    case when resp.status_code >= 300 then left(resp.content, 300) end) as err
      from admin.cron_http_requests r
      left join net._http_response resp on resp.id = r.request_id
     order by r.function, r.request_id desc
  )
  select j.jobid, j.jobname, j.schedule, j.active,
         case when j.fn is null then 'sql' else 'http' end,
         j.fn,
         lr.start_time, lr.status, left(lr.return_message, 300),
         (extract(epoch from (lr.end_time - lr.start_time)) * 1000)::int,
         coalesce(ru.total, 0), coalesce(ru.failed, 0),
         v_tracked,
         lh.created_at, lh.status, lh.err,
         coalesce(h.failed, 0), coalesce(h.total, 0),
         -- Healthy: the last run didn't fail and, for an edge-function job, its last answered
         -- request was a 2xx. A paused job isn't judged.
         case
           when not j.active then null
           when lr.status = 'failed' then false
           when j.fn is not null and lh.status is not null and lh.status <> 'pending'
                and not (lh.status ~ '^2\d\d$') then false
           else true
         end
    from jobs j
    left join last_run lr on lr.jobid = j.jobid
    left join runs ru     on ru.jobid = j.jobid
    left join http h      on h.function = j.fn
    left join last_http lh on lh.function = j.fn
   order by (case
               when not j.active then 2
               when lr.status = 'failed'
                    or (j.fn is not null and lh.status is not null and lh.status <> 'pending'
                        and not (lh.status ~ '^2\d\d$')) then 0
               else 1
             end), j.jobname;
end;
$$;

create or replace function admin.cron_job_history(p_jobname text, p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_job   record;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform admin._require_role('ops');
  select j.jobid, j.jobname, admin._cron_job_function(j.command) as fn
    into v_job
    from cron.job j where j.jobname = p_jobname;
  if not found then
    raise exception 'no scheduled job %', p_jobname using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'jobname', v_job.jobname,
    'function', v_job.fn,
    'runs', coalesce((
      select jsonb_agg(x order by x.runid desc)
        from (select d.runid, d.start_time, d.end_time, d.status, left(d.return_message, 300) as return_message
                from cron.job_run_details d
               where d.jobid = v_job.jobid
               order by d.runid desc
               limit v_limit) x), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(x order by x.request_id desc)
        from (select r.request_id, r.created_at,
                     resp.status_code, resp.timed_out, resp.error_msg,
                     left(resp.content, 300) as content, resp.created as responded_at
                from admin.cron_http_requests r
                left join net._http_response resp on resp.id = r.request_id
               where v_job.fn is not null and r.function = v_job.fn
               order by r.request_id desc
               limit v_limit) x), '[]'::jsonb)
  );
end;
$$;

create or replace function admin.set_cron_job_active(p_jobname text, p_active boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_jobid  bigint;
  v_before boolean;
begin
  perform admin._require_role('ops');
  if p_active is null then
    raise exception 'active must be true or false' using errcode = '22023';
  end if;
  select j.jobid, j.active into v_jobid, v_before from cron.job j where j.jobname = p_jobname;
  if not found then
    raise exception 'no scheduled job %', p_jobname using errcode = 'P0002';
  end if;
  if v_before is distinct from p_active then
    perform cron.alter_job(job_id := v_jobid, active := p_active);
    perform admin._audit(case when p_active then 'cron_job.resume' else 'cron_job.pause' end,
                         'cron_job', p_jobname,
                         jsonb_build_object('active', v_before), jsonb_build_object('active', p_active));
  end if;
  return p_active;
end;
$$;

-- ── 3. Client errors ───────────────────────────────────────────────────────────────────────────
create or replace function admin._client_error_hours(p_hours int)
returns int
language sql
immutable
set search_path = ''
as $$ select least(greatest(coalesce(p_hours, 24), 1), 24 * 30) $$;

create or replace function admin.client_error_groups(p_hours int default 24)
returns table (
  context        text,
  errors         int,
  users          int,
  first_seen     timestamptz,
  last_seen      timestamptz,
  latest_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return query
    select e.context,
           count(*)::int,
           count(distinct e.user_id)::int,
           min(e.created_at),
           max(e.created_at),
           left((array_agg(e.message order by e.created_at desc))[1], 300)
      from public.client_errors e
     where e.created_at > now() - make_interval(hours => admin._client_error_hours(p_hours))
     group by e.context
     order by count(*) desc, max(e.created_at) desc;
end;
$$;

create or replace function admin.list_client_errors(
  p_context text,
  p_hours   int default 24,
  p_limit   int default 100
)
returns table (
  id          bigint,
  created_at  timestamptz,
  context     text,
  message     text,
  metadata    jsonb,
  user_id     uuid,
  user_email  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return query
    select e.id, e.created_at, e.context, e.message, e.metadata, e.user_id, u.email::text
      from public.client_errors e
      left join auth.users u on u.id = e.user_id
     where (p_context is null or e.context = p_context)
       and e.created_at > now() - make_interval(hours => admin._client_error_hours(p_hours))
     order by e.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- ── 4. Grants ──────────────────────────────────────────────────────────────────────────────────
revoke all on function admin._track_http_request()                   from public, anon, authenticated;
revoke all on function admin._cron_job_function(text)                from public, anon, authenticated;
revoke all on function admin._client_error_hours(int)               from public, anon, authenticated;
revoke all on function admin.list_cron_jobs()                         from public, anon;
revoke all on function admin.cron_job_history(text, int)              from public, anon;
revoke all on function admin.set_cron_job_active(text, boolean)       from public, anon;
revoke all on function admin.client_error_groups(int)                 from public, anon;
revoke all on function admin.list_client_errors(text, int, int)       from public, anon;

grant execute on function admin._cron_job_function(text)              to service_role;
grant execute on function admin._client_error_hours(int)              to service_role;
grant execute on function admin.list_cron_jobs()                      to authenticated, service_role;
grant execute on function admin.cron_job_history(text, int)           to authenticated, service_role;
grant execute on function admin.set_cron_job_active(text, boolean)    to authenticated, service_role;
grant execute on function admin.client_error_groups(int)              to authenticated, service_role;
grant execute on function admin.list_client_errors(text, int, int)    to authenticated, service_role;
