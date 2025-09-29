create table if not exists provider_search_cache (
  provider           text        not null,
  provider_query_key text        not null,        -- e.g., normalized params or a hash
  normalized_items   jsonb       not null,        -- your schema, not raw provider blobs
  raw_payload        jsonb       null,            -- optional, for debugging
  fetched_at         timestamptz not null default now(),
  expires_at         timestamptz not null,        -- per-provider TTL policy
  constraint provider_search_cache_pk primary key (provider, provider_query_key)
);

create index if not exists idx_provider_cache_expires
  on provider_search_cache (expires_at);

