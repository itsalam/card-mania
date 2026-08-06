-- Generalizes the "Pinned" tab strip from a flat saved_collections list into a
-- named group of collections (collection_group + collection_group_items), so
-- the same mechanism could support more named groups later. Only the one
-- auto-created system "Pinned" group is wired up to the client for now.
--
-- saved_collections keeps its role unchanged — the general "Add to" / "Shared
-- with me" bucket — but going forward it should only ever hold collections a
-- user doesn't own (bookmarked via CollectionInfo's "Add to" pill); the
-- auto-add-on-create trigger that used to populate it for *owned* collections
-- is retired here in favor of the new Pinned-group trigger below.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.collection_group (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  is_system  boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- case-insensitive per-user name uniqueness, mirroring collections' own convention
create unique index collection_group_user_name_idx on public.collection_group (user_id, lower(name));
-- at most one system group ("Pinned") per user
create unique index collection_group_one_system_per_user on public.collection_group (user_id) where is_system;

create table public.collection_group_items (
  group_id       uuid        not null references public.collection_group(id) on delete cascade,
  collection_id  uuid        not null references public.collections(id) on delete cascade,
  added_at       timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),

  constraint collection_group_items_pk primary key (group_id, collection_id)
);

create index collection_group_items_group_added_idx on public.collection_group_items (group_id, added_at asc);

-- ── ensure_pinned_group_for_user: idempotent get-or-create ──────────────────────

create or replace function public.ensure_pinned_group_for_user(p_user_id uuid)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_group_id uuid;
begin
  insert into public.collection_group (user_id, name, is_system)
  values (p_user_id, 'Pinned', true)
  on conflict (user_id) where is_system
  do nothing
  returning id into v_group_id;

  if v_group_id is null then
    select id into v_group_id
    from public.collection_group
    where user_id = p_user_id and is_system = true;
  end if;

  return v_group_id;
end;
$$;

-- ── touch_collection_group_item / touch_pinned_collection / remove_pinned_collection ──

create or replace function public.touch_collection_group_item(p_group_id uuid, p_collection_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.collection_group g
    where g.id = p_group_id and g.user_id = v_user_id
  ) then
    raise exception 'group not found';
  end if;

  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and (c.user_id = v_user_id or c.is_storefront = true)
  ) then
    raise exception 'collection not visible';
  end if;

  insert into public.collection_group_items (group_id, collection_id)
  values (p_group_id, p_collection_id)
  on conflict (group_id, collection_id)
  do update set last_viewed_at = now();
end;
$$;

create or replace function public.touch_pinned_collection(p_collection_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  v_group_id := public.ensure_pinned_group_for_user(v_user_id);
  perform public.touch_collection_group_item(v_group_id, p_collection_id);
end;
$$;

create or replace function public.remove_pinned_collection(p_collection_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from public.collection_group_items i
  using public.collection_group g
  where g.id = i.group_id
    and g.user_id = v_user_id
    and g.is_system = true
    and i.collection_id = p_collection_id;
end;
$$;

-- ── my_pinned_collection_items: caller's Pinned group items, group-id-free ──────

create view public.my_pinned_collection_items as
select i.group_id, i.collection_id, i.added_at, i.last_viewed_at
from public.collection_group_items i
join public.collection_group g on g.id = i.group_id
where g.user_id = auth.uid() and g.is_system = true;

-- ── Auto-pin a collection for its owner as soon as it's created ─────────────────
-- Replaces the old trg_collection_auto_save (which auto-added owned collections
-- into saved_collections) — that table's role is now scoped to non-owned saves.

drop trigger if exists trg_collection_auto_save on public.collections;
drop function if exists public.trg_collection_auto_save();

create or replace function public.trg_collection_auto_pin()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_group_id uuid;
begin
  v_group_id := public.ensure_pinned_group_for_user(new.user_id);
  insert into public.collection_group_items (group_id, collection_id, added_at, last_viewed_at)
  values (v_group_id, new.id, now(), now())
  on conflict (group_id, collection_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_collection_auto_pin on public.collections;
create trigger trg_collection_auto_pin
  after insert on public.collections
  for each row execute function public.trg_collection_auto_pin();

-- ── Backfill ──────────────────────────────────────────────────────────────────

-- Pinned group for every existing collection owner
insert into public.collection_group (user_id, name, is_system)
select distinct user_id, 'Pinned', true
from public.collections
on conflict (user_id) where is_system do nothing;

-- Seed each Pinned group with every collection its owner already has
insert into public.collection_group_items (group_id, collection_id, added_at, last_viewed_at)
select g.id, c.id, c.created_at, c.created_at
from public.collections c
join public.collection_group g on g.user_id = c.user_id and g.is_system = true
on conflict (group_id, collection_id) do nothing;

-- Preserve today's tab-strip contents: any collection already saved (owned or
-- not) also becomes a Pinned member, using its existing saved/viewed timestamps
insert into public.collection_group_items (group_id, collection_id, added_at, last_viewed_at)
select g.id, sc.collection_id, sc.saved_at, sc.last_viewed_at
from public.saved_collections sc
join public.collection_group g on g.user_id = sc.user_id and g.is_system = true
on conflict (group_id, collection_id) do nothing;

-- saved_collections is now scoped to non-owned saves only — prune owned rows
delete from public.saved_collections sc
using public.collections c
where c.id = sc.collection_id and c.user_id = sc.user_id;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.collection_group enable row level security;

create policy "user can view own collection groups"
on public.collection_group for select to authenticated
using (user_id = auth.uid());

create policy "user can insert own collection groups"
on public.collection_group for insert to authenticated
with check (user_id = auth.uid());

create policy "user can update own collection groups"
on public.collection_group for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user can delete own non-system collection groups"
on public.collection_group for delete to authenticated
using (user_id = auth.uid() and not is_system);

alter table public.collection_group_items enable row level security;

create policy "user can view own group items"
on public.collection_group_items for select to authenticated
using (exists (
  select 1 from public.collection_group g
  where g.id = group_id and g.user_id = auth.uid()
));

create policy "user can insert own group items"
on public.collection_group_items for insert to authenticated
with check (
  exists (select 1 from public.collection_group g where g.id = group_id and g.user_id = auth.uid())
  and exists (
    select 1 from public.collections c
    where c.id = collection_id and (c.user_id = auth.uid() or c.is_storefront = true)
  )
);

create policy "user can update own group items"
on public.collection_group_items for update to authenticated
using (exists (
  select 1 from public.collection_group g
  where g.id = group_id and g.user_id = auth.uid()
))
with check (exists (
  select 1 from public.collection_group g
  where g.id = group_id and g.user_id = auth.uid()
));

create policy "user can delete own group items"
on public.collection_group_items for delete to authenticated
using (exists (
  select 1 from public.collection_group g
  where g.id = group_id and g.user_id = auth.uid()
));

-- ── Grants ────────────────────────────────────────────────────────────────────

revoke all on public.collection_group from anon, authenticated;
revoke all on public.collection_group_items from anon, authenticated;
revoke all on public.my_pinned_collection_items from anon, authenticated;

grant select, insert, update, delete on public.collection_group to authenticated;
grant select, insert, update, delete on public.collection_group_items to authenticated;
grant select on public.my_pinned_collection_items to authenticated;

grant execute on function public.ensure_pinned_group_for_user(uuid) to authenticated;
grant execute on function public.touch_collection_group_item(uuid, uuid) to authenticated;
grant execute on function public.touch_pinned_collection(uuid) to authenticated;
grant execute on function public.remove_pinned_collection(uuid) to authenticated;
