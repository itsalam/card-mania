create extension if not exists pgcrypto;

alter table public.image_cache
  add column if not exists id uuid;
update public.image_cache set id = gen_random_uuid() where id is null;
alter table public.image_cache alter column id set not null;

-- 3) Make id the PRIMARY KEY
--    (You can only have one PK; drop the current one if it's on 'key')
do $$
declare
  pk_name text;
begin
  select conname into pk_name
  from pg_constraint
  where conrelid = 'public.image_cache'::regclass
    and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.image_cache drop constraint %I', pk_name);
  end if;
end $$;

alter table public.image_cache
  add constraint image_cache_pkey primary key (id);

-- 4) Add unique constraints you want for idempotency/dedup
alter table public.image_cache
  add column if not exists url_hash text,
  add column if not exists content_sha256 text;

create unique index if not exists idx_image_cache_url_hash on public.image_cache(url_hash);
create unique index if not exists idx_image_cache_content_sha on public.image_cache(content_sha256);
