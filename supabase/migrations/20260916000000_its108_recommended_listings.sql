-- ITS-108: "For You" personalized recommendations for the Home/Explore tab
--
-- Ranks marketplace listings (from the shared _marketplace_base_listings() base
-- query, see 20260721000000_marketplace_sections_cache.sql) by the caller's own
-- genre affinity — inferred from cards already in their collections/wishlists —
-- with popularity_score/listed_at as the tiebreak, same as get_featured_listings.
-- Cards the caller already owns, and listings from the caller's own storefront,
-- are excluded. A caller with no collection/wishlist signal yet naturally falls
-- back to plain popularity order (the genre-priority CASE is always 1 when
-- my_genres is empty).
--
-- Personalized to auth.uid() (no p_user_id param — same idiom as other
-- security-definer RPCs in this schema), so unlike get_featured_listings this
-- is granted to `authenticated` only, not `anon`.

create or replace function public.get_recommended_listings(
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
  my_genres as (
    select distinct public.canonical_genre(c.genre) as genre
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    join public.cards c on c.id = ci.ref_id
    where col.user_id = auth.uid()
      and ci.item_kind = 'card'
      and c.genre is not null
  ),
  my_owned as (
    select distinct ci.ref_id as card_id
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    where col.user_id = auth.uid()
      and ci.item_kind = 'card'
      and coalesce(col.is_wishlist, false) = false
      and ci.quantity > 0
  )
  select
    b.collection_item_id, b.collection_id, b.storefront_id, b.seller_id,
    b.seller_username, b.seller_display_name, b.seller_avatar_url, b.item_kind,
    b.ref_id, b.grade_condition_id, b.grading_company, b.quantity, b.variants,
    b.listed_at, b.name, b.set_name, b.latest_price, b.grades_prices, b.genre,
    b.front_id, b.back_id, b.price_key, b.market_value, b.popularity_score
  from public._marketplace_base_listings() b
  where b.seller_id is distinct from auth.uid()
    and not exists (select 1 from my_owned o where o.card_id = b.ref_id)
  order by
    (case when public.canonical_genre(b.genre) in (select genre from my_genres)
          then 0 else 1 end),
    b.popularity_score desc nulls last,
    b.listed_at desc nulls last,
    b.collection_item_id
  limit coalesce(result_limit, 20);
$$;

grant execute on function public.get_recommended_listings(int) to authenticated;
