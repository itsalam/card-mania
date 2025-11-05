create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- core tables you already have, with curated fields added if missing
alter table public.tags
  add column if not exists source text not null default 'user' check (source in ('user','curated','system')),
  add column if not exists curated_weight numeric not null default 1.0,
  add column if not exists is_active boolean not null default true,
  add column if not exists approved_at timestamptz,
  add column if not exists popularity int not null default 0;


create table if not exists public.tag_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table if not exists public.tag_category_tags (
  category_id uuid not null references public.tag_categories(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (category_id, tag_id)
);

-- helpful indexes
create index if not exists tags_slug_trgm_idx on public.tags using gin (slug gin_trgm_ops);
create index if not exists tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);
create index if not exists tag_aliases_tag_idx on public.tag_aliases(tag_id);
create index if not exists tag_category_tags_tag_idx on public.tag_category_tags(tag_id);
create index if not exists tag_categories_slug_idx on public.tag_categories(slug);
create index if not exists tags_popularity_idx on public.tags (popularity desc);

alter table public.tags            enable row level security;
alter table public.tag_aliases     enable row level security;
alter table public.tag_categories  enable row level security;
alter table public.tag_category_tags enable row level security;

alter table public.tags enable row level security;

-- make this idempotent
drop policy if exists tags_read_all on public.tags;
drop policy if exists tag_aliases_read_all on public.tag_aliases;
drop policy if exists tag_categories_read_all on public.tag_categories;
drop policy if exists tag_category_tags_read_all on public.tag_category_tags;

-- Read for all
create policy tags_read_all            on public.tags            for select using (true);
create policy tag_aliases_read_all     on public.tag_aliases     for select using (true);
create policy tag_categories_read_all  on public.tag_categories  for select using (true);
create policy tag_category_tags_read_all on public.tag_category_tags for select using (true);

create or replace function public.curated_tag_upsert(p_name text, p_slug text, p_weight numeric default 1.0)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.tags (name, slug, source, curated_weight, approved_at, is_active)
  values (p_name, p_slug, 'curated', p_weight, now(), true)
  on conflict (slug) do update
     set name = excluded.name,
         source = 'curated',
         curated_weight = excluded.curated_weight,
         is_active = true,
         approved_at = coalesce(public.tags.approved_at, now())
  returning id;
$$;

grant execute on function public.curated_tag_upsert(text,text,numeric)
  to anon, authenticated, service_role;

create or replace function public.curated_tag_upsert(p_name text, p_slug text, p_weight numeric default 1.0)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.tags (name, slug, source, curated_weight, approved_at, is_active)
  values (p_name, p_slug, 'curated', p_weight, now(), true)
  on conflict (slug) do update
     set name = excluded.name,
         source = 'curated',
         curated_weight = excluded.curated_weight,
         is_active = true,
         approved_at = coalesce(public.tags.approved_at, now())
  returning id;
$$;

grant execute on function public.curated_tag_upsert(text,text,numeric)
  to anon, authenticated, service_role;

create or replace function public.curated_tags_import(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item     jsonb;
  v_name   text;
  v_slug   text;
  v_weight numeric;
  v_tag_id uuid;
  alias    text;
  cat      text;
  cat_id   uuid;
  inserted_count int := 0;
  updated_count  int := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'payload must be a JSON array of tags';
  end if;

  -- iterate array
  for item in select * from jsonb_array_elements(payload)
  loop
    v_name   := coalesce(item->>'name', '');
    v_slug   := coalesce(item->>'slug', '');
    v_weight := coalesce((item->>'curated_weight')::numeric, 1.0);

    if v_name = '' or v_slug = '' then
      raise exception 'each item must have name and slug';
    end if;

    -- upsert tag
    select public.curated_tag_upsert(v_name, v_slug, v_weight) into v_tag_id;

    -- aliases
    if item ? 'aliases' and jsonb_typeof(item->'aliases') = 'array' then
      for alias in
        select trim(lower(value::text), '"')
        from jsonb_array_elements(item->'aliases')
      loop
        insert into public.tag_aliases (alias_slug, tag_id)
        values (alias, v_tag_id)
        on conflict (alias_slug) do update set tag_id = excluded.tag_id;
      end loop;
    end if;

    -- categories (by slug; also upsert name same as slug if not provided)
    if item ? 'categories' and jsonb_typeof(item->'categories') = 'array' then
      for cat in
        select trim(lower(value::text), '"')
        from jsonb_array_elements(item->'categories')
      loop
        -- upsert category
        insert into public.tag_categories (name, slug)
        values (cat, cat)
        on conflict (slug) do update set name = excluded.name
        returning id into cat_id;

        -- connect category <-> tag
        insert into public.tag_category_tags (category_id, tag_id)
        values (cat_id, v_tag_id)
        on conflict do nothing;
      end loop;
    end if;

    -- crude insert/update accounting
    if (select xmax = 0 from public.tags where id = v_tag_id) then
      inserted_count := inserted_count + 1;
    else
      updated_count := updated_count + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'updated', updated_count);
end;
$$;

grant execute on function public.curated_tags_import(jsonb)
  to anon, authenticated, service_role;

-- make sure pg_trgm is enabled once:
create extension if not exists pg_trgm;

create or replace function public.suggest_tags(
  q               text default null,
  max_results     int  default 20,
  tau_hours       int  default 720,     -- recency half-life-ish
  personal_w      numeric default 1.0,  -- weight personal usage
  global_w        numeric default 0.4,  -- weight global popularity
  sim_thresh      numeric default 0.3,  -- pg_trgm similarity cutoff
  curated_w       numeric default 0.5,  -- base weight for curated
  category_w      numeric default 0.5,  -- multiplicative boost if in chosen categories
  category_ids    uuid[] default null,
  category_slugs  text[] default null
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
    personal_w, global_w, sim_thresh, curated_w, category_w,
    category_ids, category_slugs
),
chosen_categories as (
  select c.id
  from public.tag_categories c, params p
  where (p.category_ids   is not null and c.id   = any(p.category_ids))
     or (p.category_slugs is not null and c.slug = any(p.category_slugs))
),
cat_tags as (
  select distinct tct.tag_id
  from public.tag_category_tags tct
  join chosen_categories cc on cc.id = tct.category_id
),
me as (
  select t.id, t.name, s.use_count::numeric, extract(epoch from (now()-s.last_used_at)) as age_seconds
  from public.user_tag_stats s
  join public.tags t on t.id = s.tag_id
  where s.user_id = auth.uid() and t.is_active
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
curated as (
  select t.id, t.name,
         (select curated_w from params) * t.curated_weight as curated_score
  from public.tags t
  where t.is_active and t.source = 'curated'
    and (
      (select qnorm from params) is null
      or t.slug ilike (select qnorm from params)||'%'
      or t.name ilike (select qnorm from params)||'%'
      or similarity(t.slug, (select qnorm from params)) > (select sim_thresh from params)
      or similarity(t.name, (select qnorm from params)) > (select sim_thresh from params)
      or exists (
          select 1 from public.tag_aliases a
          where a.tag_id = t.id
            and ( a.alias_slug ilike (select qnorm from params)||'%'
               or similarity(a.alias_slug, (select qnorm from params)) > (select sim_thresh from params) )
      )
    )
),
blended as (
  select id, name, sum(score) as base_score
  from (
    select id, name, weighted                                  as score from me_scored
    union all
    select id, name, use_count * (select global_w from params) as score from glob
    union all
    select id, name, curated_score                              as score from curated
  ) u
  group by id, name
),
boosted as (
  select b.id, b.name,
         b.base_score *
         case when exists (select 1 from cat_tags ct where ct.tag_id = b.id)
              then (1 + (select category_w from params))
              else 1 end as score
  from blended b
)
select id, name, score
from boosted
order by score desc, name asc
limit (select lim from params);
$$;

grant execute on function public.suggest_tags(
  text,int,int,numeric,numeric,numeric,numeric,numeric,uuid[],text[]
) to anon, authenticated, service_role;

create or replace function public._clamp_nonnegative(val int)
returns int language sql immutable as $$ select case when $1 < 0 then 0 else $1 end $$;

create or replace function public.tags_popularity_maintain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.tags set popularity = popularity + 1 where id = new.tag_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.tags set popularity = public._clamp_nonnegative(popularity - 1) where id = old.tag_id;
    return old;
  elsif tg_op = 'UPDATE' then
    if new.tag_id is distinct from old.tag_id then
      update public.tags set popularity = public._clamp_nonnegative(popularity - 1) where id = old.tag_id;
      update public.tags set popularity = popularity + 1 where id = new.tag_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_collection_tags_popularity on public.collection_tags;
create trigger trg_collection_tags_popularity
after insert or update or delete on public.collection_tags
for each row execute function public.tags_popularity_maintain();
