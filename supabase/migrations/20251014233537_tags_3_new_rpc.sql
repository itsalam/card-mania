create or replace function public.suggest_tags_v2(
  q               text default null,
  max_results     int  default 20,
  tau_hours       int  default 720,
  personal_w      numeric default 1.0,
  global_w        numeric default 0.4,
  sim_thresh      numeric default 0.3,
  curated_w       numeric default 0.5,
  category_w      numeric default 0.5,
  category_ids    uuid[] default null,
  category_slugs  text[] default null
)
returns table (
  id uuid,
  name text,
  score numeric,
  category_slugs text[],
  category_names text[]
)
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
select
  b.id,
  b.name,
  b.score,
  coalesce(array_agg(distinct c.slug)  filter (where c.id is not null), '{}')::text[]  as category_slugs,
  coalesce(array_agg(distinct c.name)  filter (where c.id is not null), '{}')::text[]  as category_names
from boosted b
left join public.tag_category_tags tct on tct.tag_id = b.id
left join public.tag_categories c      on c.id = tct.category_id
group by b.id, b.name, b.score
order by b.score desc, b.name asc
limit (select lim from params);
$$;

grant execute on function public.suggest_tags_v2(
  text,int,int,numeric,numeric,numeric,numeric,numeric,uuid[],text[]
) to anon, authenticated, service_role;
