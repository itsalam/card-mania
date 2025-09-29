-- prerequisites
create extension if not exists pg_trgm;

-- recommended indexes (once per schema, not per function)
create index if not exists idx_cards_fts
  on public.cards using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(set_name,'')));
create index if not exists idx_cards_name_trgm on public.cards using gin (name gin_trgm_ops);
create index if not exists idx_cards_set_trgm  on public.cards using gin (set_name gin_trgm_ops);

-- optional: vector column & index (if you use embeddings)
-- alter table public.cards add column if not exists embedding vector(1536);
-- create index if not exists idx_cards_embedding on public.cards using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.search_cards_blended(p_q text, p_limit int default 20)
returns table (
  id uuid,
  name text,
  set_name text,
  latest_price numeric,
  snippet text,
  score numeric,
  reason jsonb
)
language sql stable as $$
with
q as (
  select trim(regexp_replace(lower(p_q), '\s+', ' ', 'g')) as qnorm
),
t as (
  select
    c.id, c.name, c.set_name, c.latest_price,
    to_tsvector('simple', coalesce(c.name,'') || ' ' || coalesce(c.set_name,'')) as fts,
    (select qnorm from q) as qnorm
  from public.cards c
),
signals as (
  select
    id, name, set_name, latest_price,
    ts_rank_cd(fts, plainto_tsquery('simple', qnorm))         as s_fts,
    greatest(similarity(name, qnorm), similarity(set_name, qnorm)) as s_trgm,
    0.0::numeric                                              as s_vec,   -- replace if you have pgvector
    0.0::numeric                                              as s_pop,   -- replace if you track popularity
    ts_headline('simple', coalesce(name,'') || ' ' || coalesce(set_name,''),
                plainto_tsquery('simple', qnorm),
                'StartSel=<b>,StopSel=</b>,MaxFragments=1,MaxWords=20,MinWords=5') as snippet
  from t
),
scored as (
  select
    id, name, set_name, latest_price, snippet,
    (0.6*s_fts + 0.3*s_trgm + 0.1*s_vec + 0.05*s_pop) as score,
    jsonb_build_object(
      'fts', s_fts, 'trgm', s_trgm, 'vector', s_vec, 'pop', s_pop,
      'blend', '0.6*fts + 0.3*trgm + 0.1*vector + 0.05*pop'
    ) as reason
  from signals
)
select *
from scored
where score > 0  -- cheap guard; tweak
order by score desc
limit p_limit;
$$;
