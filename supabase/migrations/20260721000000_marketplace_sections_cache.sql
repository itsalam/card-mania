-- ITS-94 (Phase 5): Marketplace sections → cached storefront data
--
-- Problem: the three marketplace sections (Featured / Auctions-Graded /
-- Auctions-Sealed) were all client-side `.filter()` slices of a single live
-- `get_featured_listings()` call. "Sealed" filtered on `item_kind != 'card'`,
-- which is always empty (the item_kind enum only has 'card'), and price-desc
-- auction ordering never happened.
--
-- Fix: model each section as a first-class, cached value in the DB.
--   * `marketplace_section_meta`  — config + freshness per section.
--   * `marketplace_section_items` — one cache row per (section, rank).
--   * `refresh_marketplace_sections()` — recomputes every section from a shared
--     base query with the *real* predicates/ordering, writing snapshots.
--   * `get_marketplace_sections()`  — single read RPC; cold-start fallback
--     populates the cache on first read if empty.
--   * pg_cron refreshes every 15 minutes (matches the daily-portfolio-snapshot
--     DB-only cron precedent).

-- ============================================================
-- 1. Shared base query
--    Single source of truth for the enriched storefront-listing set
--    (join + popularity_score + sealed flag). get_featured_listings and the
--    refresh function both read from here so the join lives in one place.
-- ============================================================
create or replace function public._marketplace_base_listings()
returns table (
  collection_item_id    uuid,
  collection_id         uuid,
  storefront_id         uuid,
  seller_id             uuid,
  seller_username       text,
  seller_display_name   text,
  seller_avatar_url     text,
  item_kind             public.item_kind,
  ref_id                uuid,
  grade_condition_id    uuid,
  grading_company       text,
  quantity              int,
  variants              text[],
  listed_at             timestamptz,
  name                  text,
  set_name              text,
  latest_price          numeric,
  grades_prices         jsonb,
  genre                 text,
  front_id              text,
  back_id               text,
  price_key             text,
  market_value          int,
  popularity_score      numeric,
  sealed                boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with
  cfg as (
    select pop_wishlist_weight, pop_sale_weight, pop_log_divisor
    from public.search_config where id = 1
  ),
  wishlist_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    where ci.item_kind = 'card'
      and col.is_wishlist = true
    group by ci.ref_id
  ),
  sale_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.transactions t
    join public.offers o       on o.id  = t.offer_id
    join public.offer_items oi on oi.offer_id = o.id
    join public.collection_items ci on ci.id = oi.collection_item_id
    where t.status = 'completed'
    group by ci.ref_id
  )
  select
    ci.id                                                                  as collection_item_id,
    ci.collection_id,
    sf.id                                                                  as storefront_id,
    up.user_id                                                             as seller_id,
    up.username                                                            as seller_username,
    up.display_name                                                        as seller_display_name,
    up.avatar_url                                                          as seller_avatar_url,
    ci.item_kind,
    ci.ref_id,
    ci.grade_condition_id,
    ci.grading_company,
    ci.quantity,
    ci.variants,
    sf.listed_at,
    c.name,
    c.set_name,
    c.latest_price,
    c.grades_prices,
    c.genre,
    c.front_id,
    c.back_id,
    coalesce(gc.slug || gcnd.grade_value::text, 'ungraded')               as price_key,
    coalesce(
      (c.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int,
      0
    )                                                                      as market_value,
    least(1.0,
      (  (select pop_wishlist_weight from cfg) * log(1.0 + coalesce(wl.cnt, 0)::numeric)
       + (select pop_sale_weight     from cfg) * log(1.0 + coalesce(sl.cnt, 0)::numeric)
      ) / (select pop_log_divisor from cfg)
    )                                                                      as popularity_score,
    coalesce(c.sealed, false)                                             as sealed
  from public.storefronts sf
  join public.user_profile up
    on up.user_id = sf.user_id
  join public.collections col
    on col.id = any(sf.collection_ids)
   and coalesce(col.is_storefront, false) = true
  join public.collection_items ci
    on ci.collection_id = col.id
   and ci.quantity > 0
  left join public.cards c
    on ci.item_kind = 'card'::public.item_kind
   and c.id = ci.ref_id
  left join public.grade_conditions gcnd
    on gcnd.id = ci.grade_condition_id
  left join public.grading_companies gc
    on gc.id = gcnd.company_id
  left join wishlist_counts wl on wl.card_id = c.id
  left join sale_counts     sl on sl.card_id = c.id
  where sf.is_listed = true;
$$;

-- get_featured_listings keeps its exact signature (still used by the legacy
-- useFeaturedListings hook) but now selects from the shared base query.
create or replace function public.get_featured_listings(
  result_limit int default 20
)
returns table (
  collection_item_id    uuid,
  collection_id         uuid,
  storefront_id         uuid,
  seller_id             uuid,
  seller_username       text,
  seller_display_name   text,
  seller_avatar_url     text,
  item_kind             public.item_kind,
  ref_id                uuid,
  grade_condition_id    uuid,
  grading_company       text,
  quantity              int,
  variants              text[],
  listed_at             timestamptz,
  name                  text,
  set_name              text,
  latest_price          numeric,
  grades_prices         jsonb,
  genre                 text,
  front_id              text,
  back_id               text,
  price_key             text,
  market_value          int,
  popularity_score      numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.collection_item_id, b.collection_id, b.storefront_id, b.seller_id,
    b.seller_username, b.seller_display_name, b.seller_avatar_url, b.item_kind,
    b.ref_id, b.grade_condition_id, b.grading_company, b.quantity, b.variants,
    b.listed_at, b.name, b.set_name, b.latest_price, b.grades_prices, b.genre,
    b.front_id, b.back_id, b.price_key, b.market_value, b.popularity_score
  from public._marketplace_base_listings() b
  order by b.popularity_score desc nulls last, b.listed_at desc nulls last, b.collection_item_id
  limit coalesce(result_limit, 20);
$$;

grant execute on function public.get_featured_listings(int) to authenticated, anon;

-- ============================================================
-- 2. Section config + cache tables
-- ============================================================
create table if not exists public.marketplace_section_meta (
  key              text primary key,
  title            text        not null,
  enabled          boolean     not null default true,
  sort_order       int         not null default 0,
  result_limit     int         not null default 20,
  refresh_interval interval    not null default '15 minutes',
  refreshed_at     timestamptz,
  expires_at       timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists public.marketplace_section_items (
  section_key        text        not null references public.marketplace_section_meta(key) on delete cascade,
  rank               int         not null,
  collection_item_id uuid        not null,
  payload            jsonb       not null,
  computed_at        timestamptz not null default now(),
  primary key (section_key, rank)
);
create index if not exists idx_marketplace_section_items_key
  on public.marketplace_section_items (section_key);

-- Read access goes exclusively through the security-definer RPC below; deny
-- direct PostgREST table access.
alter table public.marketplace_section_meta  enable row level security;
alter table public.marketplace_section_items enable row level security;

-- Seed the three sections. `on conflict` keeps this migration idempotent and
-- lets a later migration tweak titles/limits without clobbering.
insert into public.marketplace_section_meta (key, title, enabled, sort_order, result_limit)
values
  ('featured',        'Featured',           true, 0, 20),
  ('auctions_graded', 'Auctions · Graded',  true, 1, 20),
  ('auctions_sealed', 'Auctions · Sealed',  true, 2, 20)
on conflict (key) do nothing;

-- ============================================================
-- 3. Refresh: recompute every enabled section from the base query
-- ============================================================
create or replace function public.refresh_marketplace_sections()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sec record;
begin
  for sec in
    select * from public.marketplace_section_meta where enabled order by sort_order
  loop
    delete from public.marketplace_section_items where section_key = sec.key;

    if sec.key = 'featured' then
      -- Curated feed: most wished-for / best-selling first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.popularity_score desc nulls last,
                                          b.listed_at desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      order by b.popularity_score desc nulls last, b.listed_at desc nulls last, b.collection_item_id
      limit sec.result_limit;

    elsif sec.key = 'auctions_graded' then
      -- Graded storefront items, highest market value first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.market_value desc nulls last,
                                          b.popularity_score desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      where b.grading_company is not null
      order by b.market_value desc nulls last, b.popularity_score desc nulls last, b.collection_item_id
      limit sec.result_limit;

    elsif sec.key = 'auctions_sealed' then
      -- Sealed product (cards.sealed = true), highest market value first.
      insert into public.marketplace_section_items (section_key, rank, collection_item_id, payload, computed_at)
      select sec.key,
             row_number() over (order by b.market_value desc nulls last,
                                          b.popularity_score desc nulls last,
                                          b.collection_item_id),
             b.collection_item_id, to_jsonb(b), now()
      from public._marketplace_base_listings() b
      where b.sealed = true
      order by b.market_value desc nulls last, b.popularity_score desc nulls last, b.collection_item_id
      limit sec.result_limit;
    end if;

    update public.marketplace_section_meta
       set refreshed_at = now(),
           expires_at   = now() + refresh_interval,
           updated_at   = now()
     where key = sec.key;
  end loop;
end;
$$;

-- ============================================================
-- 4. Read RPC: one call returns all enabled sections + their items.
--    Cold-start fallback populates the cache on first read if empty so a
--    fresh deploy self-heals without waiting for the first cron tick.
-- ============================================================
create or replace function public.get_marketplace_sections()
returns table (
  section_key   text,
  title         text,
  sort_order    int,
  refreshed_at  timestamptz,
  items         jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.marketplace_section_items) then
    perform public.refresh_marketplace_sections();
  end if;

  return query
    select m.key, m.title, m.sort_order, m.refreshed_at,
           coalesce(
             (select jsonb_agg(i.payload order by i.rank)
                from public.marketplace_section_items i
               where i.section_key = m.key),
             '[]'::jsonb
           )
    from public.marketplace_section_meta m
    where m.enabled
    order by m.sort_order;
end;
$$;

grant execute on function public.get_marketplace_sections() to authenticated, anon;

-- ============================================================
-- 5. pg_cron: refresh every 15 minutes
-- ============================================================
select cron.unschedule('marketplace-sections-refresh')
where exists (select 1 from cron.job where jobname = 'marketplace-sections-refresh');

select cron.schedule(
  'marketplace-sections-refresh',
  '*/15 * * * *',
  $$ select public.refresh_marketplace_sections(); $$
);

-- Warm the cache immediately so the first request doesn't pay the cold-start cost.
select public.refresh_marketplace_sections();
