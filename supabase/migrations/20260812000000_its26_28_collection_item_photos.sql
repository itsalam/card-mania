-- ITS-26 / ITS-28: user-uploaded photos on collection_items.
--
-- Users can attach up to 6 of their own photos to a collection_items row,
-- uploaded directly from the client to Storage (no edge function in this
-- flow — unlike the vendor image_cache pipeline, which is service-role
-- only). Photos ride the existing image_cache table + useImageProxy({
-- imageId }) resize/variant pipeline, via a new collection_item_images
-- link table (mirrors card_images, but scoped to a user's collection item
-- instead of the shared catalog card).

-- ── image_cache: allow nullable, client-inserted "user upload" rows ──────

-- Vendor-fetched rows always have a source_url and a TTL (expires_at);
-- user uploads have neither (no cleanup job reads/depends on expires_at
-- anywhere in this codebase today, so this is a safe relaxation).
alter table public.image_cache alter column source_url drop not null;
alter table public.image_cache alter column expires_at drop not null;

-- RLS is already enabled on image_cache with a permissive SELECT policy
-- and a blanket table grant for `authenticated` (see baseline migration),
-- but no INSERT policy exists, so writes are default-denied today. Add an
-- insert policy narrow enough that a client can only ever create rows that
-- are unambiguously "user uploads" — never a vendor cache entry.
create policy "image_cache_user_upload_insert"
  on public.image_cache for insert to authenticated
  with check (source_url is null);

-- ── collection_item_images ────────────────────────────────────────────

create table public.collection_item_images (
  id uuid primary key default gen_random_uuid(),
  collection_item_id uuid not null references public.collection_items(id) on delete cascade,
  user_id uuid not null, -- denormalized for RLS, matches collection_items.user_id convention
  image_cache_id uuid not null references public.image_cache(id),
  storage_path text not null,
  width int,
  height int,
  "position" int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index collection_item_images_item_idx on public.collection_item_images (collection_item_id);

-- At most one primary photo per item.
create unique index collection_item_images_one_primary
  on public.collection_item_images (collection_item_id)
  where is_primary;

-- ── Max 6 photos per item ─────────────────────────────────────────────

create or replace function public.trg_collection_item_images_max_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.collection_item_images
  where collection_item_id = new.collection_item_id;

  if v_count >= 6 then
    raise exception 'collection_item % already has the maximum of 6 photos', new.collection_item_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_collection_item_images_max_count on public.collection_item_images;
create trigger trg_collection_item_images_max_count
  before insert on public.collection_item_images
  for each row execute function public.trg_collection_item_images_max_count();

-- ── RLS: owner CRUD + storefront public read ──────────────────────────

alter table public.collection_item_images enable row level security;

create policy "collection_item_images_owner_select"
  on public.collection_item_images for select to authenticated
  using (user_id = auth.uid());

-- Mirrors collection_items_storefront_public_read (20260503000000), one
-- join deeper: visible to anyone (incl. anonymous-auth web visitors, who
-- run as `authenticated`) when the owning collection is on a storefront.
create policy "collection_item_images_storefront_public_read"
  on public.collection_item_images for select to authenticated
  using (
    exists (
      select 1
      from public.collection_items ci
      join public.collections c on c.id = ci.collection_id
      where ci.id = collection_item_images.collection_item_id
        and c.is_storefront = true
    )
  );

create policy "collection_item_images_owner_insert"
  on public.collection_item_images for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.collection_items ci
      where ci.id = collection_item_id and ci.user_id = auth.uid()
    )
  );

create policy "collection_item_images_owner_update"
  on public.collection_item_images for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "collection_item_images_owner_delete"
  on public.collection_item_images for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.collection_item_images from anon, authenticated;
grant select, insert, update, delete on public.collection_item_images to authenticated;

-- ── storage.objects RLS (first policies of their kind in this repo) ───

-- Every write to Storage until now has gone through service-role edge
-- functions. User photos are the first client-direct write path, scoped
-- to their own folder within the existing `images` bucket:
-- user-uploads/{user_id}/{collection_item_id}/{uuid}.jpg
-- No SELECT policy needed — the bucket is public, so reads bypass RLS via
-- the public URL, same as catalog images today.

create policy "user_uploads_owner_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'user-uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "user_uploads_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'user-uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "user_uploads_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'user-uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ── set_primary_collection_item_photo ─────────────────────────────────

-- Atomic unset-old/set-new so the collection_item_images_one_primary
-- unique index is never at risk from two separate client round trips.
create or replace function public.set_primary_collection_item_photo(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_owner uuid;
begin
  select collection_item_id, user_id into v_item_id, v_owner
  from public.collection_item_images
  where id = p_photo_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not found';
  end if;

  update public.collection_item_images
  set is_primary = false
  where collection_item_id = v_item_id and is_primary = true;

  update public.collection_item_images
  set is_primary = true
  where id = p_photo_id;
end;
$$;

grant execute on function public.set_primary_collection_item_photo(uuid) to authenticated;
