-- Push notifications (ITS-59: ITS-60 / ITS-61 / ITS-62).
--
-- Every in-app notification is a push candidate, so rather than a trigger per source (offers,
-- transactions, wishlist hits, ...) this hangs off public.notifications itself:
--
--   notifications INSERT ─▶ push_outbox row (pending, or suppressed by the user's preferences)
--   push_outbox INSERT (statement) ─▶ net.http_post → push-dispatch (immediate)
--   pg_cron every minute ─▶ push-dispatch (sweeps leftovers, retries, Expo receipts)
--
-- push-dispatch claims pending rows (claim_push_outbox), sends them through the Expo Push API,
-- records the outcome (complete_push_outbox) and prunes tokens Expo reports as
-- DeviceNotRegistered (from tickets immediately, from receipts ~15 minutes later).
--
-- Preferences live in user_profile.preferences -> 'push' (ITS-62):
--   { "enabled": true,
--     "categories": { "offer": true, "transaction": true, "social": true, "price": true, "system": true },
--     "quiet_hours": { "enabled": false, "start": "22:00", "end": "08:00", "tz": "America/Vancouver" } }
-- Missing keys mean "on" (quiet hours: off). Quiet hours mute the push only — the in-app
-- notification is still written — and 'urgent' notifications ignore them.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ── Device tokens ───────────────────────────────────────────────────────────────────────────

create table if not exists public.user_push_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android')),
  device_name  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists user_push_tokens_user_idx on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;
revoke all on public.user_push_tokens from anon, authenticated;
grant select, delete on public.user_push_tokens to authenticated;
create policy "user_push_tokens_select_own" on public.user_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_push_tokens_delete_own" on public.user_push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- A token identifies a device install, not a person: when someone else signs in on the same
-- device the token moves to them, so the previous account stops receiving its pushes.
create or replace function public.register_push_token(
  p_token text, p_platform text, p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid Expo push token' using errcode = '22023';
  end if;

  insert into public.user_push_tokens (token, user_id, platform, device_name)
  values (p_token, auth.uid(), p_platform, p_device_name)
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        device_name  = excluded.device_name,
        last_seen_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ── Preferences ─────────────────────────────────────────────────────────────────────────────

-- Effective preferences with defaults filled in, so the client and the gate read one shape.
create or replace function public._push_preferences(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'enabled', coalesce((p -> 'enabled')::boolean, true),
           'categories', jsonb_build_object(
             'offer',       coalesce((p #> '{categories,offer}')::boolean, true),
             'transaction', coalesce((p #> '{categories,transaction}')::boolean, true),
             'social',      coalesce((p #> '{categories,social}')::boolean, true),
             'price',       coalesce((p #> '{categories,price}')::boolean, true),
             'system',      coalesce((p #> '{categories,system}')::boolean, true)),
           'quiet_hours', jsonb_build_object(
             'enabled', coalesce((p #> '{quiet_hours,enabled}')::boolean, false),
             'start',   coalesce(p #>> '{quiet_hours,start}', '22:00'),
             'end',     coalesce(p #>> '{quiet_hours,end}', '08:00'),
             'tz',      coalesce(p #>> '{quiet_hours,tz}', tz, 'UTC')))
    from (
      select coalesce(up.preferences -> 'push', '{}'::jsonb) as p, up.timezone as tz
        from (select 1) one
        left join public.user_profile up on up.user_id = p_user_id
    ) s;
$$;

create or replace function public.get_push_preferences()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._push_preferences(auth.uid());
$$;

-- Deep-merges p_patch into preferences.push (one level into categories / quiet_hours) so a
-- single toggle doesn't clobber the rest. Returns the new effective preferences.
create or replace function public.set_push_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cur jsonb;
  v_new jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;
  if p_patch #>> '{quiet_hours,start}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or p_patch #>> '{quiet_hours,end}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'quiet hours must be HH:MM' using errcode = '22023';
  end if;
  if p_patch #>> '{quiet_hours,tz}' is not null
     and not exists (select 1 from pg_timezone_names where name = p_patch #>> '{quiet_hours,tz}') then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;

  select coalesce(preferences -> 'push', '{}'::jsonb) into v_cur
    from public.user_profile where user_id = v_uid;
  v_cur := coalesce(v_cur, '{}'::jsonb);

  v_new := v_cur || (p_patch - 'categories' - 'quiet_hours');
  if p_patch ? 'categories' then
    v_new := jsonb_set(v_new, '{categories}',
                       coalesce(v_cur -> 'categories', '{}'::jsonb) || (p_patch -> 'categories'));
  end if;
  if p_patch ? 'quiet_hours' then
    v_new := jsonb_set(v_new, '{quiet_hours}',
                       coalesce(v_cur -> 'quiet_hours', '{}'::jsonb) || (p_patch -> 'quiet_hours'));
  end if;

  update public.user_profile
     set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{push}', v_new)
   where user_id = v_uid;

  return public._push_preferences(v_uid);
end;
$$;

revoke all on function public._push_preferences(uuid) from public, anon, authenticated;
revoke all on function public.get_push_preferences() from public, anon;
revoke all on function public.set_push_preferences(jsonb) from public, anon;
grant execute on function public.get_push_preferences() to authenticated;
grant execute on function public.set_push_preferences(jsonb) to authenticated;

-- Null when a push is allowed, otherwise why it isn't ('disabled' | 'category' | 'quiet_hours').
create or replace function public._push_suppression_reason(
  p_user_id uuid, p_category text, p_priority text, p_at timestamptz default now()
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefs jsonb := public._push_preferences(p_user_id);
  v_qh    jsonb := v_prefs -> 'quiet_hours';
  v_local time;
  v_start time;
  v_end   time;
begin
  if not (v_prefs ->> 'enabled')::boolean then
    return 'disabled';
  end if;
  -- Unknown categories fall through to allowed.
  if (v_prefs -> 'categories' ->> p_category) = 'false' then
    return 'category';
  end if;
  if (v_qh ->> 'enabled')::boolean and p_priority is distinct from 'urgent' then
    v_start := (v_qh ->> 'start')::time;
    v_end   := (v_qh ->> 'end')::time;
    begin
      v_local := (p_at at time zone (v_qh ->> 'tz'))::time;
    exception when others then
      v_local := (p_at at time zone 'UTC')::time;
    end;
    -- A window may wrap midnight (22:00 → 08:00).
    if (v_start <= v_end and v_local >= v_start and v_local < v_end)
       or (v_start > v_end and (v_local >= v_start or v_local < v_end)) then
      return 'quiet_hours';
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public._push_suppression_reason(uuid, text, text, timestamptz)
  from public, anon, authenticated;

-- ── Outbox ──────────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_outbox (
  id                   bigint generated always as identity primary key,
  notification_id      uuid not null references public.notifications (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  status               text not null default 'pending'
                         check (status in ('pending', 'sending', 'sent', 'suppressed', 'no_tokens', 'failed')),
  reason               text,
  attempts             int not null default 0,
  claimed_at           timestamptz,
  sent_at              timestamptz,
  -- [{ "token": "...", "ticket_id": "..." }] for tickets Expo accepted; receipts are checked later.
  tickets              jsonb not null default '[]'::jsonb,
  receipts_checked_at  timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists push_outbox_pending_idx on public.push_outbox (created_at) where status in ('pending', 'sending');
create index if not exists push_outbox_receipts_idx on public.push_outbox (sent_at)
  where status = 'sent' and receipts_checked_at is null;
create index if not exists push_outbox_notification_idx on public.push_outbox (notification_id);

alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

create or replace function public.trg_notifications_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public._push_suppression_reason(new.user_id, new.category, new.priority, new.created_at);
begin
  insert into public.push_outbox (notification_id, user_id, status, reason)
  values (new.id, new.user_id,
          case when v_reason is null then 'pending' else 'suppressed' end,
          v_reason);
  return new;
end;
$$;

drop trigger if exists notifications_enqueue_push on public.notifications;
create trigger notifications_enqueue_push
  after insert on public.notifications
  for each row execute function public.trg_notifications_enqueue_push();

-- Fire push-dispatch right away (once per statement, so a batch of wishlist-hit notifications
-- kicks it once). pg_net sends after commit. Without the Vault secrets (local DB, pgTAP) this
-- is a no-op and the cron sweep is the only path; a failure here must never block the insert.
create or replace function public.trg_push_outbox_kick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url   text;
  v_token text;
begin
  if not exists (select 1 from new_rows where status = 'pending') then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'edge_token';
  if v_url is null or v_token is null then
    return null;
  end if;
  perform net.http_post(
    url     := v_url || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || v_token,
      'apikey',        v_token,
      'x-internal',    '1'));
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists push_outbox_kick on public.push_outbox;
create trigger push_outbox_kick
  after insert on public.push_outbox
  referencing new table as new_rows
  for each statement execute function public.trg_push_outbox_kick();

-- Claims up to p_limit deliverable rows for one push-dispatch run. Rows stuck in 'sending'
-- (a run that died) are reclaimed after 5 minutes; after 3 attempts a row is failed. Rows
-- whose user has no device are closed out as 'no_tokens' here rather than returned.
create or replace function public.claim_push_outbox(p_limit int default 200)
returns table (
  outbox_id       bigint,
  notification_id uuid,
  user_id         uuid,
  title           text,
  body            text,
  category        text,
  priority        text,
  action_url      text,
  tokens          text[],
  badge           int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_outbox o
     set status = 'failed', reason = 'max_attempts'
   where o.status in ('pending', 'sending')
     and o.attempts >= 3
     and (o.status = 'pending' or o.claimed_at < now() - interval '5 minutes');

  return query
  with candidates as (
    select o.id
      from public.push_outbox o
     where o.status = 'pending'
        or (o.status = 'sending' and o.claimed_at < now() - interval '5 minutes')
     order by o.created_at
     limit p_limit
     for update skip locked
  ),
  -- One UPDATE decides sending vs. no_tokens: a second data-modifying CTE touching the same
  -- rows would be silently ignored by Postgres.
  claimed as (
    update public.push_outbox o
       set status     = case when exists (select 1 from public.user_push_tokens t where t.user_id = o.user_id)
                             then 'sending' else 'no_tokens' end,
           sent_at    = case when exists (select 1 from public.user_push_tokens t where t.user_id = o.user_id)
                             then o.sent_at else now() end,
           claimed_at = now(),
           attempts   = o.attempts + 1
      from candidates c
     where o.id = c.id
    returning o.id, o.notification_id, o.user_id, o.status
  )
  select c.id, c.notification_id, c.user_id, n.title, n.body, n.category, n.priority, n.action_url,
         (select array_agg(t.token order by t.last_seen_at desc)
            from public.user_push_tokens t where t.user_id = c.user_id),
         (select count(*)::int from public.notifications u
           where u.user_id = c.user_id and u.read_at is null and u.dismissed_at is null)
    from claimed c
    join public.notifications n on n.id = c.notification_id
   where c.status = 'sending';
end;
$$;

-- p_results: [{ "id": 1, "status": "sent"|"failed"|"pending", "reason": "...", "tickets": [...] }]
-- ('pending' hands a row back for retry, e.g. after an Expo 5xx). p_dead_tokens are removed.
create or replace function public.complete_push_outbox(p_results jsonb, p_dead_tokens text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_outbox o
     set status  = r.status,
         reason  = r.reason,
         tickets = coalesce(r.tickets, '[]'::jsonb),
         sent_at = case when r.status = 'sent' then now() else o.sent_at end
    from jsonb_to_recordset(p_results) as r(id bigint, status text, reason text, tickets jsonb)
   where o.id = r.id
     and o.status = 'sending'
     and r.status in ('sent', 'failed', 'pending');

  if coalesce(array_length(p_dead_tokens, 1), 0) > 0 then
    delete from public.user_push_tokens where token = any (p_dead_tokens);
  end if;
end;
$$;

-- Sent rows whose Expo receipts are due (Expo keeps receipts ~24h; check after ~15 min).
create or replace function public.claim_push_receipts(p_limit int default 300)
returns table (outbox_id bigint, tickets jsonb)
language sql
security definer
set search_path = public
as $$
  update public.push_outbox o
     set receipts_checked_at = now()
   where o.id in (
     select id from public.push_outbox
      where status = 'sent' and receipts_checked_at is null
        and sent_at < now() - interval '15 minutes'
        and sent_at > now() - interval '23 hours'
        and jsonb_array_length(tickets) > 0
      order by sent_at
      limit p_limit
      for update skip locked)
  returning o.id, o.tickets;
$$;

revoke all on function public.claim_push_outbox(int) from public, anon, authenticated;
revoke all on function public.complete_push_outbox(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.claim_push_receipts(int) from public, anon, authenticated;
grant execute on function public.claim_push_outbox(int) to service_role;
grant execute on function public.complete_push_outbox(jsonb, text[]) to service_role;
grant execute on function public.claim_push_receipts(int) to service_role;

-- ── Schedule ────────────────────────────────────────────────────────────────────────────────

-- Safety net for the immediate kick: retries, rows enqueued while the function was down, and
-- receipt checks. Same Vault-secret contract as tracked-price-refresh (edge_token must be a
-- service key — on staging the sb_secret_… key).
select cron.schedule(
  'push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'x-internal',    '1'
    )
  ) as request_id
  where exists (
    select 1 from public.push_outbox
     where status in ('pending', 'sending')
        or (status = 'sent' and receipts_checked_at is null and sent_at < now() - interval '15 minutes')
  );
  $$
);

select cron.schedule(
  'push-outbox-cleanup',
  '17 4 * * *',
  $$ delete from public.push_outbox where created_at < now() - interval '30 days'; $$
);
