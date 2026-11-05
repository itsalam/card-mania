-- ITS-98: per-collection appearance — icon, accent color, background image.
--
-- Plain columns on public.collections rather than a side table: they're 1:1 with the row,
-- read everywhere a collection is (select('*'), the membership RPCs, collections_with_tags),
-- and covered by the existing collections RLS for free.
--
--   icon_key            a key from the client's curated icon set (components/collections/appearance.ts);
--                       unknown keys fall back to the default icon client-side, so the set can grow
--                       without a migration.
--   accent_color        a palette key, not a hex value — the client maps it to a theme palette
--                       color, so it stays consistent with light/dark mode.
--   background_image_id image_cache row for a user-uploaded background (same upload path as
--                       collection item photos: images bucket, user-uploads/{uid}/...).

alter table public.collections
  add column if not exists icon_key text,
  add column if not exists accent_color text,
  add column if not exists background_image_id uuid references public.image_cache (id) on delete set null;

alter table public.collections
  drop constraint if exists collections_icon_key_check,
  add constraint collections_icon_key_check
    check (icon_key is null or icon_key ~ '^[a-z0-9-]{1,40}$'),
  drop constraint if exists collections_accent_color_check,
  add constraint collections_accent_color_check
    check (accent_color is null
           or accent_color in ('violet', 'purple', 'blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'grey'));

-- Default background: the collection's most valuable card (per-card market value at the item's
-- grade, quantity ignored). It's kept as its own column, maintained even while an uploaded
-- background_image_id is set, so the client can fall back to it the moment the upload is
-- removed. The client renders it through the image proxy's card_id + 'front' lookup.
--
-- Maintenance is asynchronous: item changes (and card price changes) only enqueue the
-- collection; a pg_cron job recomputes queued collections every minute. That keeps the work out
-- of add/remove/price-refresh writes, which can touch many items at once.
alter table public.collections
  add column if not exists default_background_card_id uuid references public.cards (id) on delete set null;

create table if not exists public.collection_background_queue (
  collection_id uuid primary key references public.collections (id) on delete cascade,
  queued_at timestamptz not null default now()
);

alter table public.collection_background_queue enable row level security;
revoke all on public.collection_background_queue from anon, authenticated;

create or replace function public._collection_top_card_id(p_collection_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select ci.ref_id
    from public.collection_items ci
   where ci.collection_id = p_collection_id
     and ci.item_kind = 'card'::public.item_kind
   order by public._collection_item_value_cents(ci.item_kind, ci.ref_id, ci.grade_condition_id, 1) desc,
            ci.created_at desc
   limit 1;
$$;

create or replace function public._enqueue_collection_background()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.collection_background_queue (collection_id)
    values (new.collection_id)
    on conflict (collection_id) do nothing;
  end if;
  -- DELETE, or an UPDATE that moved the item to another collection.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.collection_id is distinct from new.collection_id) then
    insert into public.collection_background_queue (collection_id)
    select old.collection_id
     where exists (select 1 from public.collections where id = old.collection_id)
    on conflict (collection_id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_collection_background_enqueue_ins_del on public.collection_items;
create trigger trg_collection_background_enqueue_ins_del
  after insert or delete on public.collection_items
  for each row execute function public._enqueue_collection_background();

drop trigger if exists trg_collection_background_enqueue_upd on public.collection_items;
create trigger trg_collection_background_enqueue_upd
  after update of ref_id, grade_condition_id, collection_id, item_kind on public.collection_items
  for each row execute function public._enqueue_collection_background();

-- A price change can reorder any collection holding the card.
create or replace function public._enqueue_collection_background_for_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.collection_background_queue (collection_id)
  select distinct ci.collection_id
    from public.collection_items ci
   where ci.ref_id = new.id
     and ci.item_kind = 'card'::public.item_kind
  on conflict (collection_id) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_collection_background_enqueue_prices on public.cards;
create trigger trg_collection_background_enqueue_prices
  after update of grades_prices on public.cards
  for each row
  when (old.grades_prices is distinct from new.grades_prices)
  execute function public._enqueue_collection_background_for_card();

-- Drains the queue. Returns how many collections were recomputed.
create or replace function public.refresh_collection_backgrounds(p_limit int default 500)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with batch as (
    delete from public.collection_background_queue q
     where q.collection_id in (
       select collection_id
         from public.collection_background_queue
        order by queued_at
        limit p_limit
          for update skip locked
     )
    returning q.collection_id
  ), computed as (
    select b.collection_id, public._collection_top_card_id(b.collection_id) as card_id
      from batch b
  ), updated as (
    update public.collections c
       set default_background_card_id = computed.card_id
      from computed
     where c.id = computed.collection_id
       and c.default_background_card_id is distinct from computed.card_id
    returning 1
  )
  select count(*) into v_count from computed;
  return v_count;
end;
$$;

revoke execute on function public.refresh_collection_backgrounds(int) from public, anon, authenticated;
revoke execute on function public._enqueue_collection_background() from public, anon, authenticated;
revoke execute on function public._enqueue_collection_background_for_card() from public, anon, authenticated;

-- Backfill existing collections.
update public.collections c
   set default_background_card_id = public._collection_top_card_id(c.id)
 where exists (select 1 from public.collection_items ci where ci.collection_id = c.id);

-- Runs entirely in the database (no edge function), like wishlist-hit-notifications.
select cron.unschedule('collection-backgrounds-refresh')
 where exists (select 1 from cron.job where jobname = 'collection-backgrounds-refresh');
select cron.schedule(
  'collection-backgrounds-refresh',
  '* * * * *',
  $$ select public.refresh_collection_backgrounds() $$
);

-- collections_with_tags is `select c.*`, which Postgres expands when the view is created, so it
-- has to be recreated to pick up the new columns. Same definition as 20251014184302, plus
-- security_invoker from 20260910000002.
drop view if exists public.collections_with_tags;
create view public.collections_with_tags with (security_invoker = true) as
select
  c.*,
  coalesce(array_agg(distinct t.name) filter (where t.id is not null), '{}')::text[] as tags_cache
from public.collections c
left join public.collection_tags ct on ct.collection_id = c.id
left join public.tags t on t.id = ct.tag_id
group by c.id;

grant select on public.collections_with_tags to authenticated, anon, service_role;

-- The membership RPCs return an explicit column list (from 20251030191059); add the
-- appearance columns. Return type changes, so drop + recreate.
drop function if exists public.collections_with_membership(uuid, uuid);
drop function if exists public.collections_with_membership_query(uuid, uuid, text);

create function public.collections_with_membership(
  p_user uuid,
  p_card uuid
) returns table (
  id uuid,
  user_id uuid,
  name text,
  description text,
  visibility text,
  cover_image_url text,
  icon_key text,
  accent_color text,
  background_image_id uuid,
  default_background_card_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  tags_cache text[],
  has_item boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, c.name, c.description, c.visibility,
    c.cover_image_url, c.icon_key, c.accent_color, c.background_image_id,
    c.default_background_card_id,
    c.created_at, c.updated_at, c.tags_cache,
    exists (
      select 1
      from collection_items ci
      where ci.collection_id = c.id
        and ci.user_id = p_user
        and ci.ref_id = p_card
    ) as has_item
  from collections_with_tags c
  where c.user_id = p_user
  order by c.created_at desc;
$$;

create function public.collections_with_membership_query(
  p_user uuid,
  p_card uuid,
  p_query text default null
) returns table (
  id uuid,
  user_id uuid,
  name text,
  description text,
  visibility text,
  cover_image_url text,
  icon_key text,
  accent_color text,
  background_image_id uuid,
  default_background_card_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  tags_cache text[],
  has_item boolean
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.user_id, c.name, c.description, c.visibility,
    c.cover_image_url, c.icon_key, c.accent_color, c.background_image_id,
    c.default_background_card_id,
    c.created_at, c.updated_at, c.tags_cache,
    exists (
      select 1
      from collection_items ci
      where ci.collection_id = c.id
        and ci.user_id = p_user
        and ci.ref_id = p_card
    ) as has_item
  from collections_with_tags c
  where c.user_id = p_user
    and (
      p_query is null or
      c.name ilike '%' || p_query || '%' or
      c.description ilike '%' || p_query || '%'
    )
  order by c.created_at desc;
$$;
