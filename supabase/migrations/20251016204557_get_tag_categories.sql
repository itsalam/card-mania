-- enable if not already
create extension if not exists pg_trgm;

create or replace function public.get_tag_categories(tags text[])
returns table (
  input_text      text,
  tag_id          uuid,
  tag_name        text,
  tag_slug        text,
  category_slugs  text[],
  category_names  text[]
)
language sql
stable
security definer
set search_path = public
as $$
with inp as (
  select trim(lower(unnest(tags))) as q
),
-- direct matches on slug/name
direct as (
  select i.q as input_text, t.id, t.name, t.slug
  from inp i
  join public.tags t
    on lower(t.slug) = i.q
    or lower(t.name) = i.q
),
-- alias matches
alias_hit as (
  select i.q as input_text, t.id, t.name, t.slug
  from inp i
  join public.tag_aliases a on a.alias_slug = i.q
  join public.tags t on t.id = a.tag_id
),
resolved as (
  -- prefer direct match, fall back to alias match
  select distinct on (input_text) input_text, id, name, slug
  from (
    select * from direct
    union all
    select * from alias_hit
  ) u
  order by input_text, id nulls last
),
cats as (
  select
    r.input_text,
    r.id,
    r.name,
    r.slug,
    coalesce(array_agg(distinct c.slug) filter (where c.id is not null), '{}')::text[] as category_slugs,
    coalesce(array_agg(distinct c.name) filter (where c.id is not null), '{}')::text[] as category_names
  from resolved r
  left join public.tag_category_tags tct on tct.tag_id = r.id
  left join public.tag_categories c on c.id = tct.category_id
  group by r.input_text, r.id, r.name, r.slug
),
-- ensure every input has a row
all_inputs as (
  select i.q as input_text
  from inp i
)
select
  ai.input_text,
  c.id        as tag_id,
  c.name      as tag_name,
  c.slug      as tag_slug,
  c.category_slugs,
  c.category_names
from all_inputs ai
left join cats c on c.input_text = ai.input_text
order by ai.input_text;
$$;

grant execute on function public.get_tag_categories(text[]) to anon, authenticated, service_role;
