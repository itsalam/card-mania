-- ITS-30: RPC for public storefronts + featured listings
-- Sort: Option A — recently listed (storefront.listed_at DESC)

-- ============================================================
-- RLS: storefronts table
-- ============================================================
alter table public.storefronts enable row level security;

drop policy if exists storefronts_public_read on public.storefronts;
create policy storefronts_public_read
  on public.storefronts
  for select
  using (is_listed = true);

drop policy if exists storefronts_owner_all on public.storefronts;
create policy storefronts_owner_all
  on public.storefronts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- RPC: get_featured_listings
-- Collection items from public storefronts with card + seller
-- data, sorted by storefront.listed_at DESC (most recently listed).
-- ============================================================
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
  market_value          int
)
language sql
stable
security definer
set search_path = public
as $$
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
    )                                                                      as market_value
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
  where sf.is_listed = true
  order by sf.listed_at desc nulls last, ci.id
  limit coalesce(result_limit, 20);
$$;

grant execute on function public.get_featured_listings(int) to authenticated, anon;

-- ============================================================
-- RPC: get_public_storefronts
-- Paginated list of public storefronts with seller info and
-- item count. Cursor-paginated by listed_at DESC.
-- ============================================================
create or replace function public.get_public_storefronts(
  result_limit int         default 20,
  page_param   timestamptz default null
)
returns table (
  storefront_id         uuid,
  seller_id             uuid,
  seller_username       text,
  seller_display_name   text,
  seller_avatar_url     text,
  seller_is_seller      boolean,
  title                 text,
  description           text,
  tags                  text[],
  listed_at             timestamptz,
  item_count            bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sf.id                as storefront_id,
    up.user_id           as seller_id,
    up.username          as seller_username,
    up.display_name      as seller_display_name,
    up.avatar_url        as seller_avatar_url,
    up.is_seller         as seller_is_seller,
    sf.title,
    sf.description,
    sf.tags,
    sf.listed_at,
    count(ci.id)         as item_count
  from public.storefronts sf
  join public.user_profile up
    on up.user_id = sf.user_id
  join public.collections col
    on col.id = any(sf.collection_ids)
   and coalesce(col.is_storefront, false) = true
  join public.collection_items ci
    on ci.collection_id = col.id
   and ci.quantity > 0
  where sf.is_listed = true
    and (page_param is null or sf.listed_at < page_param)
  group by sf.id, up.user_id, up.username, up.display_name, up.avatar_url, up.is_seller
  order by sf.listed_at desc nulls last
  limit coalesce(result_limit, 20);
$$;

grant execute on function public.get_public_storefronts(int, timestamptz) to authenticated, anon;
