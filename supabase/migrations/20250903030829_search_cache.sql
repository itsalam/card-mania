-- 1) Canonical record of searches
create table if not exists public.search_queries (
  id uuid primary key default gen_random_uuid(),
  query_raw text not null,
  query_norm text not null,                      -- lowercased, trimmed, collapsed spaces, removed punctuation
  query_hash text not null unique,               -- sha256 of query_norm
  source text not null default 'app',            -- app | web | internal
  user_id uuid null,                             -- optional, for personalization later
  created_at timestamptz not null default now()
);

-- 2) What we returned for a query (denormalized for speed)
create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_query_id uuid not null references public.search_queries(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  rank int not null,                             -- final ordering
  score numeric not null default 0,
  snippet text null,                             -- short display excerpt
  reason jsonb null,                             -- why it matched (tokens, trigram, vector)
  created_at timestamptz not null default now(),
  unique (search_query_id, card_id)
);

-- 3) Cache of raw provider responses (write-through, TTL-managed)
create table if not exists public.search_cache (
  query_hash text primary key,
  payload jsonb not null,                        -- raw combined payload (e.g., PriceCharting + SerpAPI)
  etag text null,                                -- for HTTP caching
  ttl_seconds int not null default 86400,        -- default 24h (tune per provider)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.image_search_cache (
  query_hash text primary key,
  query_norm text not null,
  candidates jsonb not null,                    -- [{url, width, height, source?, score?}]
  top_url text null,
  ttl_seconds int not null default 604800,      -- 7d
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_search_results_query on public.search_results(search_query_id);
create index if not exists idx_search_results_card on public.search_results(card_id);

-- image cache edits
alter table public.image_cache
  add column if not exists source_url text,
  add column if not exists url_hash text,
  add column if not exists content_sha256 text;

create unique index if not exists idx_image_cache_url_hash on public.image_cache(url_hash);
create unique index if not exists idx_image_cache_content_sha on public.image_cache(content_sha256);

-- Helper function for upserting images by URL:
create or replace function public.upsert_image_by_url(p_url text, p_mime text, p_w int, p_h int)
returns uuid
language plpgsql as $$
declare
  v_url_hash text := encode(digest(trim(p_url), 'sha256'), 'hex');
  v_id uuid;
begin
  insert into public.image_cache(key, source_url, url_hash, mime, width, height)
  values (gen_random_uuid()::text, p_url, v_url_hash, p_mime, p_w, p_h)
  on conflict (url_hash) do update set
    mime = coalesce(excluded.mime, image_cache.mime),
    width = coalesce(excluded.width, image_cache.width),
    height = coalesce(excluded.height, image_cache.height)
  returning id into v_id;

  return v_id;
end $$;

-- Full-text
create index if not exists idx_cards_fts
on public.cards
using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(set_name,'')));

-- Trigram
create extension if not exists pg_trgm;
create index if not exists idx_cards_name_trgm on public.cards using gin (name gin_trgm_ops);
create index if not exists idx_cards_set_trgm  on public.cards using gin (set_name gin_trgm_ops);
