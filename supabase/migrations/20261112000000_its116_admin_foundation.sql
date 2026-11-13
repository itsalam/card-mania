-- ITS-116: admin console foundation — `admin` schema, members/roles, audit log.
--
-- Decisions (ITS-114, 12 Nov 2026):
--   * Admin data lives in its own schema, not in user_profile or the client app (ITS-57 decision).
--   * The console is Retool Cloud (Free plan). Every Retool user can edit queries there, so the
--     database cannot trust anything the tool says about who is acting. Instead Retool calls these
--     RPCs through PostgREST with each admin's OWN Supabase session token, and every check below
--     reads auth.uid(). No Postgres credential or service key is stored in Retool.
--
--   Retool ─(Bearer <admin's access token>)─▶ PostgREST /rest/v1/rpc/<fn>  (Content-Profile: admin)
--          ─▶ admin.<fn>()  security definer: admin._require_role(...) → work → admin._audit(...)
--
-- Access model:
--   * anon: no USAGE on the schema at all.
--   * authenticated: USAGE on the schema + EXECUTE on the public-facing RPCs only. Every RPC
--     re-checks membership, so a signed-in non-admin gets 42501 from all of them.
--   * Tables: no grants to anon/authenticated (and RLS on with no policies as a second lock).
--     PostgREST therefore exposes no admin table, only functions.
--   * Helpers prefixed `_` are not executable by clients; security definer RPCs call them as owner.
--
-- Roles: 'owner' can do everything; 'editor' = content (promos, home feed, ITS-191/193/110);
-- 'ops' = dashboards and ops actions (ITS-117, ITS-57). One role per member.
--
-- The schema must also be in PostgREST's exposed schemas: supabase/config.toml [api].schemas
-- locally; on staging it's Dashboard → Project Settings → API → Exposed schemas (db push does
-- not change it). See docs/admin-console.md.

create schema if not exists admin;

revoke all on schema admin from public;
grant usage on schema admin to authenticated, service_role;

-- Functions created in this schema are not executable by PUBLIC unless granted explicitly.
alter default privileges in schema admin revoke execute on functions from public;

-- ── Tables ──────────────────────────────────────────────────────────────────────────────────

create table if not exists admin.members (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  role       text        not null check (role in ('owner', 'editor', 'ops')),
  granted_by uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin.audit_log (
  id          bigint      generated always as identity primary key,
  -- null when the change came from SQL / service role rather than a signed-in admin.
  -- Deliberately NOT a foreign key: an `on delete set null` FK would have to UPDATE this
  -- append-only table (blocked by the trigger below), so deleting any user who ever made an
  -- audited change would fail. The email is captured at write time so rows stay readable
  -- after the account is gone.
  actor       uuid,
  actor_email text,
  action      text        not null,
  target_type text,
  target_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on admin.audit_log (created_at desc);
create index if not exists audit_log_target_idx     on admin.audit_log (target_type, target_id);
create index if not exists audit_log_actor_idx      on admin.audit_log (actor);
create index if not exists members_granted_by_idx   on admin.members (granted_by);

alter table admin.members   enable row level security;
alter table admin.audit_log enable row level security;

revoke all on all tables    in schema admin from public, anon, authenticated;
revoke all on all sequences in schema admin from public, anon, authenticated;
grant all on all tables    in schema admin to service_role;
grant all on all sequences in schema admin to service_role;

-- The audit log is append-only, even for the table owner going through normal DML.
create or replace function admin._audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin.audit_log is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_immutable on admin.audit_log;
create trigger audit_log_immutable
  before update or delete on admin.audit_log
  for each row execute function admin._audit_log_immutable();

create or replace function admin._touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists members_touch_updated_at on admin.members;
create trigger members_touch_updated_at
  before update on admin.members
  for each row execute function admin._touch_updated_at();

-- ── Helpers (internal) ──────────────────────────────────────────────────────────────────────

-- The caller's role, or null if they aren't a member (or aren't signed in).
create or replace function admin._current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from admin.members m where m.user_id = auth.uid();
$$;

-- Raises 42501 unless the caller is a member whose role is in p_roles (owner always passes).
-- An empty list means "any member". Returns the caller's user id for auditing.
create or replace function admin._require_role(variadic p_roles text[] default '{}')
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := admin._current_role();
begin
  if v_role is null
     or not (v_role = 'owner' or cardinality(p_roles) = 0 or v_role = any (p_roles)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function admin._audit(
  p_action      text,
  p_target_type text  default null,
  p_target_id   text  default null,
  p_before      jsonb default null,
  p_after       jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into admin.audit_log (actor, actor_email, action, target_type, target_id, before, after)
  values (auth.uid(), (select u.email from auth.users u where u.id = auth.uid()),
          p_action, p_target_type, p_target_id, p_before, p_after);
$$;

-- ── RPCs ────────────────────────────────────────────────────────────────────────────────────

-- True when the caller holds one of p_roles (owner always does). Never raises, so the console
-- can use it to decide what to show; the RPCs themselves enforce access.
create or replace function admin.has_role(variadic p_roles text[] default '{}')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.role = 'owner' or cardinality(p_roles) = 0 or m.role = any (p_roles)
       from admin.members m
      where m.user_id = auth.uid()),
    false);
$$;

-- Landing-page identity check. Non-members get 42501, which the console shows as
-- "not authorized".
create or replace function admin.whoami()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := admin._require_role();
begin
  return (
    select jsonb_build_object('user_id', u.id, 'email', u.email, 'role', m.role,
                              'member_since', m.created_at)
      from auth.users u
      join admin.members m on m.user_id = u.id
     where u.id = v_uid);
end;
$$;

create or replace function admin.list_members()
returns table (user_id uuid, email text, role text, granted_by_email text,
               created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('owner');
  return query
    select m.user_id, u.email::text, m.role, g.email::text, m.created_at, m.updated_at
      from admin.members m
      join auth.users u on u.id = m.user_id
      left join auth.users g on g.id = m.granted_by
     order by m.created_at;
end;
$$;

-- Adds a member or changes their role. The user must already have a Supabase account.
create or replace function admin.set_member_role(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := admin._require_role('owner');
  v_target uuid;
  v_before jsonb;
  v_after  jsonb;
begin
  if p_role is null or p_role not in ('owner', 'editor', 'ops') then
    raise exception 'role must be owner, editor or ops' using errcode = '22023';
  end if;

  select u.id into v_target from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'no account with email %', p_email using errcode = 'P0002';
  end if;

  select to_jsonb(m) into v_before from admin.members m where m.user_id = v_target;

  if v_before ->> 'role' = 'owner' and p_role <> 'owner'
     and (select count(*) from admin.members where role = 'owner') = 1 then
    raise exception 'cannot demote the last owner' using errcode = '22023';
  end if;

  insert into admin.members (user_id, role, granted_by)
  values (v_target, p_role, v_actor)
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by;

  select to_jsonb(m) into v_after from admin.members m where m.user_id = v_target;
  perform admin._audit('member.set_role', 'member', v_target::text, v_before, v_after);
  return v_after;
end;
$$;

create or replace function admin.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform admin._require_role('owner');

  select to_jsonb(m) into v_before from admin.members m where m.user_id = p_user_id;
  if v_before is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if v_before ->> 'role' = 'owner'
     and (select count(*) from admin.members where role = 'owner') = 1 then
    raise exception 'cannot remove the last owner' using errcode = '22023';
  end if;

  delete from admin.members where user_id = p_user_id;
  perform admin._audit('member.remove', 'member', p_user_id::text, v_before, null);
end;
$$;

-- Newest first; page with p_before_id = the smallest id already shown.
create or replace function admin.list_audit_log(
  p_limit       int    default 100,
  p_before_id   bigint default null,
  p_target_type text   default null
)
returns table (id bigint, actor_email text, action text, target_type text, target_id text,
               before jsonb, after jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin._require_role('ops');
  return query
    select a.id, a.actor_email, a.action, a.target_type, a.target_id, a.before, a.after, a.created_at
      from admin.audit_log a
     where (p_before_id is null or a.id < p_before_id)
       and (p_target_type is null or a.target_type = p_target_type)
     order by a.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- ── Function privileges ─────────────────────────────────────────────────────────────────────

revoke all on all functions in schema admin from public, anon, authenticated;

grant execute on function admin.has_role(text[])                    to authenticated;
grant execute on function admin.whoami()                            to authenticated;
grant execute on function admin.list_members()                      to authenticated;
grant execute on function admin.set_member_role(text, text)         to authenticated;
grant execute on function admin.remove_member(uuid)                 to authenticated;
grant execute on function admin.list_audit_log(int, bigint, text)   to authenticated;

grant execute on all functions in schema admin to service_role;
