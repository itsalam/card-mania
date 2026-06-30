-- ITS-56 follow-on: surface popularity signal in get_featured_listings
--
-- Adds a popularity_score column (same formula as s_pop in search_cards_blended,
-- reading weights from search_config) and reorders results by it so the most
-- wished-for and best-selling cards surface first in the marketplace feed.
--
-- Order: popularity_score DESC → listed_at DESC → ci.id (stable tiebreaker)

-- DROP required because the return type gains a new column
drop function if exists public.get_featured_listings(int);

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
    )                                                                      as popularity_score
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
  where sf.is_listed = true
  order by popularity_score desc nulls last, sf.listed_at desc nulls last, ci.id
  limit coalesce(result_limit, 20);
$$;

grant execute on function public.get_featured_listings(int) to authenticated, anon;
