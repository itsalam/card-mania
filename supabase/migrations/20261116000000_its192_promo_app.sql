-- ITS-192: promo boxes in the app: Home slot, impression/tap tracking, "Notify me".
--
-- The app reads promos with public.get_active_promos() (ITS-191) and drafts with
-- public.get_promo_preview(token). This migration adds what the app writes back:
--
--   home_feed_section_meta 'promos'  where promos sit in the Home feed (ordering/enabling via the
--                                    existing ITS-107 config, no app release needed to move them)
--   admin.promo_events               one impression / tap per promo per app session (deduplicated
--                                    by a unique key, so retries and re-renders are free)
--   admin.promo_event_daily          daily rollup for the promo results dashboard; raw events are
--                                    kept 90 days
--   admin.promo_interest             "Notify me" on a coming-soon promo, one row per user; the push
--                                    on release is a later ticket (ITS-60/61/62)
--
-- The tables live in the admin schema with no grants: the app only reaches them through the
-- security-definer RPCs below, which check what they write.

-- ── 1. Home feed slot ──────────────────────────────────────────────────────────────────────────
-- Above the other sections. The promos slot has no header: each box is its own card.
insert into public.home_feed_section_meta (key, title, icon, sort_order, result_limit, layout)
values ('promos', 'Promos', 'sparkles', -10, 5, '{}'::jsonb)
on conflict (key) do nothing;

-- ── 2. Events ──────────────────────────────────────────────────────────────────────────────────
create table if not exists admin.promo_events (
  id          bigint generated always as identity primary key,
  promo_id    uuid        not null references admin.promos (id) on delete cascade,
  kind        text        not null check (kind in ('impression', 'tap')),
  -- Random per app launch, made by the client. Not a secret and not tied to auth: it only
  -- deduplicates. Signed-in users are also recorded by user_id.
  session_id  text        not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  user_id     uuid        references auth.users (id) on delete set null,
  placement   text,
  created_at  timestamptz not null default now(),
  unique (promo_id, kind, session_id)
);
create index if not exists promo_events_created_at_idx on admin.promo_events (created_at);

create table if not exists admin.promo_event_daily (
  day       date not null,
  promo_id  uuid not null references admin.promos (id) on delete cascade,
  kind      text not null,
  sessions  int  not null,
  users     int  not null,
  primary key (day, promo_id, kind)
);

-- ── 3. Notify me ───────────────────────────────────────────────────────────────────────────────
create table if not exists admin.promo_interest (
  promo_id    uuid        not null references admin.promos (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- Set once the release notification has gone out (ITS-60/61/62), so it's sent once.
  notified_at timestamptz,
  primary key (promo_id, user_id)
);
create index if not exists promo_interest_user_idx on admin.promo_interest (user_id);

alter table admin.promo_events      enable row level security;
alter table admin.promo_event_daily enable row level security;
alter table admin.promo_interest    enable row level security;
revoke all on admin.promo_events, admin.promo_event_daily, admin.promo_interest
  from public, anon, authenticated;
revoke all on all sequences in schema admin from public, anon, authenticated;

-- A promo the app is allowed to show right now (same window as get_active_promos).
create or replace function admin._promo_is_live(p_promo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from admin.promos p
     where p.id = p_promo_id
       and p.status = 'published'
       and (p.starts_at is null or p.starts_at <= now())
       and (p.ends_at is null or p.ends_at > now())
  );
$$;

-- ── 4. App RPCs ────────────────────────────────────────────────────────────────────────────────

-- Records an impression or tap. Returns true when it was new for this session, false when it
-- was a duplicate or the promo isn't live (drafts in the preview route never count). Never
-- raises for those cases, so a tracking call can't break the Home screen.
create or replace function public.record_promo_event(
  p_promo_id   uuid,
  p_kind       text,
  p_session_id text,
  p_placement  text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('impression', 'tap')
     or p_session_id is null or p_session_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'invalid promo event' using errcode = '22023';
  end if;
  if not admin._promo_is_live(p_promo_id) then
    return false;
  end if;

  insert into admin.promo_events (promo_id, kind, session_id, user_id, placement)
  values (p_promo_id, p_kind, p_session_id, auth.uid(),
          case when p_placement in ('home_hero', 'home_rail') then p_placement end)
  on conflict (promo_id, kind, session_id) do nothing;
  return found;
end;
$$;

-- Turns "Notify me" on or off for the signed-in user. Returns the new state.
create or replace function public.set_promo_interest(p_promo_id uuid, p_on boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign in to get notified' using errcode = '42501';
  end if;
  if p_on then
    if not admin._promo_is_live(p_promo_id) then
      raise exception 'promo is not live' using errcode = 'P0002';
    end if;
    insert into admin.promo_interest (promo_id, user_id)
    values (p_promo_id, v_uid)
    on conflict do nothing;
  else
    delete from admin.promo_interest where promo_id = p_promo_id and user_id = v_uid;
  end if;
  return p_on;
end;
$$;

-- The promos the signed-in user asked to be notified about (empty when signed out).
create or replace function public.get_my_promo_interests()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.promo_id from admin.promo_interest i where i.user_id = auth.uid();
$$;

-- ── 5. Daily rollup ────────────────────────────────────────────────────────────────────────────
-- Idempotent: recomputes the given UTC day. Cron runs it for yesterday (and today, so the
-- dashboard isn't a day behind), then drops raw events older than 90 days.
create or replace function admin.rollup_promo_events(p_day date default (now() at time zone 'utc')::date - 1)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  delete from admin.promo_event_daily where day = p_day;
  insert into admin.promo_event_daily (day, promo_id, kind, sessions, users)
  select p_day, e.promo_id, e.kind, count(*)::int, count(distinct e.user_id)::int
    from admin.promo_events e
   where e.created_at >= p_day::timestamp at time zone 'utc'
     and e.created_at <  (p_day + 1)::timestamp at time zone 'utc'
   group by e.promo_id, e.kind;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'promo-events-rollup') then
    perform cron.unschedule('promo-events-rollup');
  end if;
end;
$$;
select cron.schedule(
  'promo-events-rollup',
  '7 * * * *',
  $$
  select admin.rollup_promo_events((now() at time zone 'utc')::date - 1);
  select admin.rollup_promo_events((now() at time zone 'utc')::date);
  delete from admin.promo_events where created_at < now() - interval '90 days';
  $$
);

-- ── 6. Grants ──────────────────────────────────────────────────────────────────────────────────
revoke all on function admin._promo_is_live(uuid)                         from public, anon, authenticated;
revoke all on function admin.rollup_promo_events(date)                    from public, anon, authenticated;
revoke all on function public.record_promo_event(uuid, text, text, text)  from public;
revoke all on function public.set_promo_interest(uuid, boolean)           from public;
revoke all on function public.get_my_promo_interests()                    from public;

grant execute on function public.record_promo_event(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.set_promo_interest(uuid, boolean)          to authenticated, service_role;
grant execute on function public.get_my_promo_interests()                   to authenticated, service_role;
grant execute on function admin._promo_is_live(uuid)                        to service_role;
grant execute on function admin.rollup_promo_events(date)                   to service_role;
