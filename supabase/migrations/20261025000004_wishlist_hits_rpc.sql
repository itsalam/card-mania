-- Wishlist Hits: cards on a user's wishlist that another user currently has listed.
--
-- A hit pairs a wishlist row with a live storefront listing of the same card, sold by someone
-- else, at the wishlisted grade (a wishlist row with no grade matches any grade). It carries
-- the current market price (grades_prices at the listing's grade — listings have no asking
-- price) and the price at wishlist time (collection_items.price_snapshot at that grade), so the
-- client can show "now $X — $Y when you wishlisted it".
--
-- _wishlist_hits(p_user_id) is the shared internal matcher (null = every user, used by the
-- notification generator); get_wishlist_hits(p_limit) is the client RPC, scoped to auth.uid().
--
-- Listing rules mirror _marketplace_base_listings (listed storefront, storefront collection in
-- sf.collection_ids, quantity > 0). That function isn't reused directly because its popularity
-- CTEs scan every wishlist and transaction; supabase/tests/get_wishlist_hits.sql asserts the
-- two agree.

create or replace function public._wishlist_hits(p_user_id uuid default null)
returns table (
  user_id                     uuid,
  wishlist_item_id            uuid,
  wishlisted_at               timestamptz,
  wishlist_grade_condition_id uuid,
  listing_item_id             uuid,
  listing_collection_id       uuid,
  storefront_id               uuid,
  listed_at                   timestamptz,
  ref_id                      uuid,
  name                        text,
  set_name                    text,
  grading_company             text,
  price_key                   text,
  seller_id                   uuid,
  seller_username             text,
  seller_display_name         text,
  seller_avatar_url           text,
  current_price_cents         int,
  snapshot_price_cents        int,
  snapshot_at                 timestamptz,
  savings_pct                 numeric,
  prices_refreshed_at         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with wishlist as (
    select w.id, w.user_id, w.ref_id, w.grade_condition_id, w.created_at,
           w.price_snapshot, w.price_snapshot_at
      from public.collection_items w
      join public.collections wc on wc.id = w.collection_id and wc.is_wishlist
     where w.item_kind = 'card'::public.item_kind
       and (p_user_id is null or w.user_id = p_user_id)
  ),
  listings as (
    select l.id, l.collection_id, l.user_id, l.ref_id, l.grade_condition_id, l.grading_company,
           sf.id as storefront_id, sf.listed_at,
           public.grade_condition_price_key(l.grade_condition_id) as price_key
      from public.storefronts sf
      join public.collections col
        on col.id = any(sf.collection_ids) and coalesce(col.is_storefront, false)
      join public.collection_items l
        on l.collection_id = col.id and l.quantity > 0
       and l.item_kind = 'card'::public.item_kind
     where sf.is_listed
       and l.ref_id in (select ref_id from wishlist)
  )
  select
    w.user_id,
    w.id,
    w.created_at,
    w.grade_condition_id,
    l.id,
    l.collection_id,
    l.storefront_id,
    l.listed_at,
    c.id,
    c.name,
    c.set_name,
    l.grading_company,
    l.price_key,
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    cur.cents,
    snap.cents,
    w.price_snapshot_at,
    case when snap.cents > 0 and cur.cents > 0
         then round((snap.cents - cur.cents)::numeric / snap.cents * 100, 1) end,
    c.prices_refreshed_at
  from wishlist w
  join listings l
    on l.ref_id = w.ref_id
   and l.user_id <> w.user_id
   and (w.grade_condition_id is null or l.grade_condition_id = w.grade_condition_id)
  join public.cards c on c.id = w.ref_id
  join public.user_profile up on up.user_id = l.user_id
  cross join lateral (select nullif(round((c.grades_prices ->> l.price_key)::numeric), 0)::int as cents) cur
  cross join lateral (select nullif(round((w.price_snapshot ->> l.price_key)::numeric), 0)::int as cents) snap
$$;

revoke execute on function public._wishlist_hits(uuid) from public, anon, authenticated;
grant execute on function public._wishlist_hits(uuid) to service_role;

-- One row per (card, grade) for the caller: a listing that matches several of their wishlist
-- rows (e.g. "any grade" and "PSA 10") prefers the graded row (its snapshot is the relevant
-- one); several listings of the same card+grade collapse to the newest, with the rest counted.
create or replace function public.get_wishlist_hits(p_limit int default 10)
returns table (
  wishlist_item_id      uuid,
  wishlisted_at         timestamptz,
  listing_item_id       uuid,
  listing_collection_id uuid,
  storefront_id         uuid,
  listed_at             timestamptz,
  ref_id                uuid,
  name                  text,
  set_name              text,
  grading_company       text,
  price_key             text,
  seller_id             uuid,
  seller_username       text,
  seller_display_name   text,
  seller_avatar_url     text,
  current_price_cents   int,
  snapshot_price_cents  int,
  snapshot_at           timestamptz,
  savings_pct           numeric,
  prices_refreshed_at   timestamptz,
  other_listings_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  with hits as (
    select * from public._wishlist_hits(auth.uid())
  ),
  per_listing as (
    select distinct on (h.listing_item_id) h.*
      from hits h
     order by h.listing_item_id, (h.wishlist_grade_condition_id is null), h.wishlisted_at desc
  ),
  ranked as (
    select p.*,
           row_number() over (partition by p.ref_id, p.price_key
                              order by p.listed_at desc nulls last, p.listing_item_id) as rn,
           count(*) over (partition by p.ref_id, p.price_key) as listings
      from per_listing p
  )
  select r.wishlist_item_id, r.wishlisted_at, r.listing_item_id, r.listing_collection_id,
         r.storefront_id, r.listed_at, r.ref_id, r.name, r.set_name, r.grading_company,
         r.price_key, r.seller_id, r.seller_username, r.seller_display_name, r.seller_avatar_url,
         r.current_price_cents, r.snapshot_price_cents, r.snapshot_at, r.savings_pct,
         r.prices_refreshed_at, (r.listings - 1)::int
    from ranked r
   where r.rn = 1
   order by r.savings_pct desc nulls last, r.listed_at desc nulls last, r.listing_item_id
   limit greatest(coalesce(p_limit, 10), 0)
$$;

revoke execute on function public.get_wishlist_hits(int) from public, anon;
grant execute on function public.get_wishlist_hits(int) to authenticated;
