-- Server-backed "saved collections" list: replaces the client-only AsyncStorage
-- `preferences.tabs` array. Tracks every collection a user has saved/pinned —
-- their own (including auto-provisioned defaults) plus ones they've viewed that
-- they don't own — with a last_viewed_at column for recency.

create table public.saved_collections (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  collection_id  uuid        not null references public.collections(id) on delete cascade,
  saved_at       timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),

  constraint saved_collections_pk primary key (user_id, collection_id)
);

-- stable insertion-order listing for the "Pinned" tab strip
create index saved_collections_user_saved_idx on public.saved_collections (user_id, saved_at asc);

-- ── touch_saved_collection: upsert + bump last_viewed_at ────────────────────────
-- Unlike touch_recent_view, user_id is derived from auth.uid() (never trusted from
-- the client), and collection visibility is explicitly re-checked in the function
-- body — this function is security definer, so it bypasses RLS entirely and the
-- policies below are not a real backstop for its own logic.

create or replace function public.touch_saved_collection(p_collection_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and (c.user_id = v_user_id or c.is_storefront = true)
  ) then
    raise exception 'collection not visible';
  end if;

  insert into public.saved_collections (user_id, collection_id)
  values (v_user_id, p_collection_id)
  on conflict (user_id, collection_id)
  do update set last_viewed_at = now();
end;
$$;

-- ── Auto-save a collection for its owner as soon as it's created ────────────────
-- Covers both the 3 auto-provisioned defaults (wishlist/vault/selling, created via
-- ensure_default_collections_for_user on signup) and user-created custom
-- collections — the client never has to remember to "save" its own collections.

create or replace function public.trg_collection_auto_save()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.saved_collections (user_id, collection_id, saved_at, last_viewed_at)
  values (new.user_id, new.id, now(), now())
  on conflict (user_id, collection_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_collection_auto_save on public.collections;
create trigger trg_collection_auto_save
  after insert on public.collections
  for each row execute function public.trg_collection_auto_save();

-- ── Backfill existing collections ────────────────────────────────────────────────

insert into public.saved_collections (user_id, collection_id, saved_at, last_viewed_at)
select user_id, id, created_at, created_at
from public.collections
on conflict (user_id, collection_id) do nothing;

-- ── Weekly cleanup, scoped to non-owned rows only ────────────────────────────────
-- Owned collections must never be pruned; cap browsed-but-not-owned saves at 150
-- most-recently-viewed per user, mirroring recent_views' cleanup shape.

select cron.schedule(
  'saved-collections-cleanup',
  '30 0 * * 0', -- every Sunday at 00:30, offset from recently-viewed-cleanup
  $$
    delete from public.saved_collections sc
    using (
      select sc2.user_id, sc2.collection_id,
             row_number() over (partition by sc2.user_id order by sc2.last_viewed_at desc) rn
      from public.saved_collections sc2
      where not exists (
        select 1 from public.collections c
        where c.id = sc2.collection_id and c.user_id = sc2.user_id
      )
    ) r
    where r.user_id = sc.user_id and r.collection_id = sc.collection_id
    and r.rn > 150;
  $$
);

-- ── RLS ───────────────────────────────────────────────────────────────────────────

alter table public.saved_collections enable row level security;

create policy "user can view own saved collections"
on public.saved_collections
for select
to authenticated
using (user_id = auth.uid());

create policy "user can insert own saved collections"
on public.saved_collections
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.collections c
    where c.id = collection_id and (c.user_id = auth.uid() or c.is_storefront = true)
  )
);

create policy "user can update own saved collections"
on public.saved_collections
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user can delete own saved collections"
on public.saved_collections
for delete
to authenticated
using (user_id = auth.uid());

revoke all on public.saved_collections from anon, authenticated;
grant select, insert, update, delete on public.saved_collections to authenticated;
grant execute on function public.touch_saved_collection(uuid) to authenticated;
