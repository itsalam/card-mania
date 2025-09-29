create table if not exists price_cache (
  key         text primary key,          -- e.g. 'id:123' or 'q:charizard psa 10'
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null      -- serve fresh until
);

create index if not exists price_cache_expires_idx on price_cache (expires_at);

create table if not exists image_cache (
  key         text primary key,          -- e.g. 'q:charizard psa 10'
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists image_cache_expires_idx on image_cache (expires_at);

alter table price_cache enable row level security;
alter table image_cache enable row level security;

/* Read-only for authenticated users, but you can also require going through functions only */
create policy "read cache (auth only)" on price_cache for select
  to authenticated using (true);
create policy "read cache (auth only)" on image_cache for select
  to authenticated using (true);
create policy "read image cache (auth only)" on image_cache
  for select to authenticated using (true);

/* Writes are through Edge Functions with service role; no public insert/update policy */
