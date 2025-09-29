create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.search_queries
  add column if not exists hits int not null default 0,
  add column if not exists last_seen timestamptz not null default now(),
  add column if not exists committed_at timestamptz null;  -- last time we pre-cached images for this query

-- helpful index if you’ll sweep “hot”/recent queries
create index if not exists idx_search_queries_last_seen on public.search_queries(last_seen desc);

create or replace function public.bump_search_query(
  p_query_raw  text,
  p_query_norm text,
  p_query_hash text,
  p_source     text default 'app'
)
returns table(hits int, last_seen timestamptz, committed_at timestamptz)
language sql
as $$
  with up as (
    insert into public.search_queries (
      query_raw, query_norm, query_hash, source, hits, last_seen
    )
    values (p_query_raw, p_query_norm, p_query_hash, coalesce(p_source,'app'), 1, now())
    on conflict (query_hash) do update
      set hits      = search_queries.hits + 1,
          last_seen = now()
    returning hits, last_seen, committed_at
  )
  select hits, last_seen, committed_at from up;
$$;

-- schedule a cron job to commit hot images every 15 minutes
select cron.schedule(
  'invoke-image-commit-from-query',
  '*/15 * * * *', -- every 15 minutes
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url')
           || '/functions/v1/image-commit-from-query',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='edge_token')
    ),
    body := jsonb_build_object('sample', 1)::jsonb
  );
  $$
);
