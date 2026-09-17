-- ITS-107 (follow-up): Home feed sections → config-driven, not hardcoded
--
-- The Home feed's expandable-card sections (Wishlist Hits, Collections, Suggested
-- Sellers) had their title/icon/rail sizing/result limit hardcoded per component.
-- Mirrors the `marketplace_section_meta` / `get_marketplace_sections()` precedent
-- (20260721000000_marketplace_sections_cache.sql): a config table + a single read
-- RPC drive title, icon, sort order, item limit and rail layout.
--
-- Unlike marketplace sections, each section's *items* are per-user data (my
-- collections, sellers I don't already follow, etc.) — cheap, already-cached
-- per-user React Query hooks, not a shared feed worth denormalizing into a cron-
-- refreshed cache table. So only the section metadata lives here; each section
-- still fetches its own items client-side via its existing hook, using this
-- table's `result_limit` and `layout` to parameterize that fetch/render.
--
-- The `key` column is deliberately a fixed set of known values, not a free-form
-- query descriptor: each key maps to one already-reviewed, RLS-scoped client
-- query. Storing an arbitrary table/filter descriptor here would let a config
-- row read anything the config-table's RLS-blind RPC can reach — same reasoning
-- the marketplace_section_meta cache table follows for its per-key branches in
-- refresh_marketplace_sections().

create table if not exists public.home_feed_section_meta (
  key          text primary key,
  title        text        not null,
  icon         text        not null,
  enabled      boolean     not null default true,
  sort_order   int         not null default 0,
  result_limit int         not null default 10,
  -- Rail sizing overrides consumed by ExpandableCard (itemWidth/collapsedHeight/
  -- expandedHeight); a section that renders TCG-card-shaped items can omit any of
  -- these and fall back to ExpandableCard's own card-aspect-ratio defaults.
  layout       jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Read access goes exclusively through get_home_feed_sections(); deny direct
-- PostgREST table access (same posture as marketplace_section_meta).
alter table public.home_feed_section_meta enable row level security;

insert into public.home_feed_section_meta (key, title, icon, sort_order, result_limit, layout)
values
  ('wishlist_hits',     'Wishlist Hits',      'heart',  0, 10, jsonb_build_object('itemWidth', 120)),
  ('collections',       'Collections',        'layers', 1, 10, '{}'::jsonb),
  ('suggested_sellers', 'Suggested Sellers',  'users',  2, 10,
    jsonb_build_object('itemWidth', 92, 'collapsedHeight', 108, 'expandedHeight', 216))
on conflict (key) do nothing;

create or replace function public.get_home_feed_sections()
returns table (
  key          text,
  title        text,
  icon         text,
  sort_order   int,
  result_limit int,
  layout       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select key, title, icon, sort_order, result_limit, layout
  from public.home_feed_section_meta
  where enabled
  order by sort_order;
$$;

grant execute on function public.get_home_feed_sections() to authenticated, anon;
