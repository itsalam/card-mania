-- Tables ----------------------------------

-- Canonical tags (global namespace, lower-cased + slugged)
create table public.tags (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,         -- display name ("Rookie", "PSA 10")
  slug          text not null,         -- normalized ("rookie", "psa-10")
  created_at    timestamptz not null default now(),
  source text not null default 'user' check (source in ('user','curated','system')),
  curated_weight numeric not null default 1.0, -- ranking boost for curated
  is_active boolean not null default true,     -- hide without delete
  approved_at timestamptz,
  unique(slug)
);

create table if not exists public.tag_aliases (
  alias_slug text primary key,
  tag_id uuid not null references public.tags(id) on delete cascade
);

-- Join table: which tags are on which collection (or collection_item)
create table public.collection_tags (
  collection_id uuid not null references public.collections(id) on delete cascade,
  tag_id        uuid not null references public.tags(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, tag_id)
);

-- Per-user tag usage (drives suggestions)
create table public.user_tag_stats (
  user_id       uuid not null references auth.users(id) on delete cascade,
  tag_id        uuid not null references public.tags(id) on delete cascade,
  use_count     int  not null default 0,
  last_used_at  timestamptz not null default now(),
  primary key (user_id, tag_id)
);

-- Indexes ----------------------------------

-- Fast lookups by user
create index on public.collection_tags (user_id, collection_id);
create index on public.user_tag_stats (user_id, use_count desc, last_used_at desc);

-- Prefix/fuzzy tag search (enable extension once per DB)
create extension if not exists pg_trgm with schema extensions;;

create index tags_slug_trgm_idx on public.tags using gin (slug gin_trgm_ops);
create index tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);

-- RLS ----------------------------------

alter table public.collection_tags enable row level security;
create policy "user owns their collection tags"
  on public.collection_tags
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.user_tag_stats enable row level security;
create policy "user reads/writes own tag stats"
  on public.user_tag_stats
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- tags table can be globally readable; writes restricted to app (or allow user create):
alter table public.tags enable row level security;
create policy "public read tags" on public.tags for select using (true);
-- optional write policy if you want users to mint tags:
create policy "app or user can insert tags"
  on public.tags for insert
  with check (true);

-- RPC: suggest_tags -----------------------

-- Enable helpful extensions once (safe to run repeatedly)
create extension if not exists "uuid-ossp" with schema extensions;

-- Optional supporting indexes (recommended)
create index if not exists collection_tags_user_collection_idx
  on public.collection_tags (user_id, collection_id);
create index if not exists collection_tags_tag_idx
  on public.collection_tags (tag_id);

create index if not exists user_tag_stats_user_scoring_idx
  on public.user_tag_stats (user_id, use_count desc, last_used_at desc);

create index if not exists tags_slug_trgm_idx
  on public.tags using gin (slug gin_trgm_ops);
create index if not exists tags_name_trgm_idx
  on public.tags using gin (name gin_trgm_ops);

-- Personalized suggestions RPC
-- Blend personal usage + global popularity, optionally filtered by query `q`
-- `tau_hours` controls how quickly personal usage decays with time (recency boost).
create or replace function public.suggest_tags(
  q            text default null,
  max_results  int  default 20,
  tau_hours    int  default 720,
  personal_w   numeric default 1.0,
  global_w     numeric default 0.4,
  sim_thresh   numeric default 0.3,
  curated_w    numeric default 0.5         -- NEW: base weight for curated tags
)
returns table (id uuid, name text, score numeric)
language sql
stable
security definer
set search_path = public
as $$
with params as (
  select
    nullif(trim(lower(q)), '') as qnorm,
    greatest(1, max_results) as lim,
    greatest(1, tau_hours)   as tau,
    personal_w, global_w, sim_thresh, curated_w
),
me as (
  select t.id, t.name, s.use_count::numeric, extract(epoch from (now()-s.last_used_at)) as age_seconds
  from public.user_tag_stats s
  join public.tags t on t.id = s.tag_id
  where s.user_id = auth.uid()
    and t.is_active
    and (
      (select qnorm from params) is null
      or t.slug ilike (select qnorm from params)||'%'
      or t.name ilike (select qnorm from params)||'%'
      or similarity(t.slug, (select qnorm from params)) > (select sim_thresh from params)
      or similarity(t.name, (select qnorm from params)) > (select sim_thresh from params)
    )
),
me_scored as (
  select id, name,
         use_count * exp(- (age_seconds/3600.0) / (select tau from params)) as weighted
  from me
),
glob as (
  select t.id, t.name, count(*)::numeric as use_count
  from public.collection_tags ct
  join public.tags t on t.id = ct.tag_id
  where t.is_active and (
    (select qnorm from params) is null
    or t.slug ilike (select qnorm from params)||'%'
    or t.name ilike (select qnorm from params)||'%'
    or similarity(t.slug, (select qnorm from params)) > (select sim_thresh from params)
    or similarity(t.name, (select qnorm from params)) > (select sim_thresh from params)
  )
  group by t.id, t.name
  order by count(*) desc
  limit 100
),
curated as (  -- NEW: include curated even with zero usage
  select t.id, t.name,
         -- score is curated_w * tag.curated_weight
         (select curated_w from params) * t.curated_weight as curated_score
  from public.tags t
  where t.is_active
    and t.source = 'curated'
    and (
      (select qnorm from params) is null
      or t.slug ilike (select qnorm from params)||'%'
      or t.name ilike (select qnorm from params)||'%'
      or exists (select 1 from public.tag_aliases a
                 where a.tag_id = t.id
                   and a.alias_slug ilike (select qnorm from params)||'%')
      or similarity(t.slug, (select qnorm from params)) > (select sim_thresh from params)
      or similarity(t.name, (select qnorm from params)) > (select sim_thresh from params)
    )
),
blended as (
  select id, name, sum(score) as score
  from (
    select id, name, weighted                                         as score from me_scored
    union all
    select id, name, use_count * (select global_w from params)        as score from glob
    union all
    select id, name, curated_score                                    as score from curated
  ) u
  group by id, name
)
select id, name, score
from blended
order by score desc, name asc
limit (select lim from params);
$$;

grant execute on function public.suggest_tags(text,int,int,numeric,numeric,numeric,numeric)
  to anon, authenticated, service_role;

-- Trigger for popularity stats -----------------------
-- Add a popularity column to tags (if not present)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tags' and column_name = 'popularity'
  ) then
    alter table public.tags add column popularity int not null default 0;
  end if;
end$$;

-- Helper: ensure no negatives
create or replace function public._clamp_nonnegative(val int)
returns int language sql immutable as $$
  select case when $1 < 0 then 0 else $1 end
$$;

-- Trigger function
create or replace function public.tags_popularity_maintain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.tags
      set popularity = popularity + 1
      where id = new.tag_id;
    return new;

  elsif (tg_op = 'DELETE') then
    update public.tags
      set popularity = public._clamp_nonnegative(popularity - 1)
      where id = old.tag_id;
    return old;

  elsif (tg_op = 'UPDATE') then
    -- if tag_id changed, decrement old, increment new
    if new.tag_id is distinct from old.tag_id then
      update public.tags
        set popularity = public._clamp_nonnegative(popularity - 1)
        where id = old.tag_id;
      update public.tags
        set popularity = popularity + 1
        where id = new.tag_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;

-- Attach trigger to collection_tags
drop trigger if exists trg_collection_tags_popularity on public.collection_tags;
create trigger trg_collection_tags_popularity
after insert or update or delete on public.collection_tags
for each row execute function public.tags_popularity_maintain();

-- (Optional but handy)
create index if not exists tags_popularity_idx on public.tags (popularity desc);

create or replace view public.collections_with_tags as
select
  c.*,
  coalesce(array_agg(distinct t.name) filter (where t.id is not null), '{}')::text[] as tags_cache
from public.collections c
left join public.collection_tags ct on ct.collection_id = c.id
left join public.tags t on t.id = ct.tag_id
group by c.id;

  -- Helper upsert for curated tags
create or replace function public.curated_tag_upsert(p_name text, p_slug text, p_weight numeric default 1.0)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.tags (name, slug, source, curated_weight, approved_at)
  values (p_name, p_slug, 'curated', p_weight, now())
  on conflict (slug) do update
     set name = excluded.name,
         source = 'curated',
         curated_weight = excluded.curated_weight,
         is_active = true,
         approved_at = coalesce(public.tags.approved_at, now())
  returning id;
$$;

-- Example seeds (slugify your names in app code or do it manually here)
select public.curated_tag_upsert('Rookie Card', 'rookie', 1.6);
select public.curated_tag_upsert('PSA 10', 'psa-10', 1.4);
select public.curated_tag_upsert('On-Card Auto', 'on-card-auto', 1.5);
select public.curated_tag_upsert('Refractor', 'refractor', 1.2);
select public.curated_tag_upsert('Short Print', 'short-print', 1.3);       