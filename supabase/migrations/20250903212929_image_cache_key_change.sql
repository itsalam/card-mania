-- requires: create extension if not exists pgcrypto;
alter table public.image_cache
  add column if not exists id uuid default gen_random_uuid();

alter table public.image_cache
  alter column id set not null;

-- keep natural identifiers but not as PKs
alter table public.image_cache
  add column if not exists key text,
  add column if not exists source_url text,
  add column if not exists url_hash text,
  add column if not exists content_sha256 text,
  add column if not exists storage_path text,
  add column if not exists mime text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists created_at timestamptz default now();

-- unique constraints for idempotency
create unique index if not exists idx_image_cache_key on public.image_cache(key);
create unique index if not exists idx_image_cache_url_hash on public.image_cache(url_hash);
create unique index if not exists idx_image_cache_content_sha on public.image_cache(content_sha256);

-- switch PK to id (do this after updating FKs; see below)
-- alter table public.image_cache drop constraint image_cache_pkey;
-- alter table public.image_cache add constraint image_cache_pkey primary key (id);
