-- ITS-194: promo results for the console dashboard.
--
--   admin.promo_results(from, to)              one row per promo: impressions, taps, tap rate,
--                                              signed-in viewers/tappers and 7-day conversions
--   admin.promo_results_daily(promo, from, to) impressions/taps per UTC day, zero-filled, for the
--                                              line chart
--
-- Both are read-only and need the editor or ops role (owner always passes).
--
-- Where the numbers come from (ITS-192, 20261116000000):
--   * Impressions and taps are app sessions, from the hourly rollup admin.promo_event_daily (raw
--     events are deduplicated per promo, kind and session, so one session counts once). Today's
--     row is at most an hour behind.
--   * Viewers, tappers and conversions need user ids, so they read the raw admin.promo_events,
--     which are kept 90 days. Anonymous sessions count as impressions/taps but can't convert.
--
-- A conversion is something a user who tapped the promo did within 7 days of their first tap in
-- the range, on a card the promo covers (its section's listings or its pinned cards):
--   * wishlist add  a covered card added to one of the user's wishlist collections
--   * card view     public.recent_views, item 'card' or 'listing'. Only the latest view per item
--                   is stored, so a later re-view moves it out of the window: a lower bound.
--   * offer         public.offers + offer_items, by the buyer, on a listing of a covered card
-- The covered cards are the section's current listings, not a history, so a card that has since
-- dropped out of the section no longer counts.

-- ── Covered cards ──────────────────────────────────────────────────────────────────────────────
-- Cards (ref_id) and listings (collection_item_id) a promo covers right now.
create or replace function admin._promo_covered(p_promo_id uuid)
returns table (ref_id uuid, collection_item_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select (i.payload ->> 'ref_id')::uuid, i.collection_item_id
    from public.marketplace_section_items i
   where i.section_key = admin._promo_section_key(p_promo_id)
  union
  select unnest(p.pinned_ref_ids), null::uuid
    from admin.promos p
   where p.id = p_promo_id;
$$;

-- ── Range check ────────────────────────────────────────────────────────────────────────────────
-- Defaults to the last 30 UTC days; at most a year.
create or replace function admin._promo_results_range(p_from date, p_to date)
returns table (d_from date, d_to date)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_to   date := coalesce(p_to, (now() at time zone 'utc')::date);
  v_from date := coalesce(p_from, v_to - 29);
begin
  if v_from > v_to then
    raise exception 'from must be on or before to' using errcode = '22023';
  end if;
  if v_to - v_from > 366 then
    raise exception 'range is limited to a year' using errcode = '22023';
  end if;
  return query select v_from, v_to;
end;
$$;

-- ── Results per promo ──────────────────────────────────────────────────────────────────────────
create or replace function admin.promo_results(p_from date default null, p_to date default null)
returns table (
  promo_id         uuid,
  slug             text,
  title            text,
  template         text,
  placement        text,
  status           text,
  phase            text,
  impressions      int,
  taps             int,
  tap_rate         numeric,   -- taps / impressions, 0..1; null with no impressions
  viewers          int,       -- signed-in users who saw it
  tappers          int,       -- signed-in users who tapped it
  wishlist_adds    int,
  card_views       int,
  offers           int,
  converted_users  int,       -- tappers with at least one conversion
  conversion_rate  numeric    -- converted_users / tappers, 0..1; null with no tappers
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_to   date;
  v_start timestamptz;
  v_end   timestamptz;
begin
  perform admin._require_role('editor', 'ops');
  select r.d_from, r.d_to into v_from, v_to from admin._promo_results_range(p_from, p_to) r;
  v_start := v_from::timestamp at time zone 'utc';
  v_end   := (v_to + 1)::timestamp at time zone 'utc';

  return query
  with daily as (
    select d.promo_id,
           sum(d.sessions) filter (where d.kind = 'impression')::int as impressions,
           sum(d.sessions) filter (where d.kind = 'tap')::int        as taps
      from admin.promo_event_daily d
     where d.day between v_from and v_to
     group by d.promo_id
  ),
  users as (
    select e.promo_id,
           count(distinct e.user_id) filter (where e.kind = 'impression')::int as viewers,
           count(distinct e.user_id) filter (where e.kind = 'tap')::int        as tappers
      from admin.promo_events e
     where e.created_at >= v_start and e.created_at < v_end and e.user_id is not null
     group by e.promo_id
  ),
  first_tap as (
    select e.promo_id, e.user_id, min(e.created_at) as tapped_at
      from admin.promo_events e
     where e.kind = 'tap' and e.user_id is not null
       and e.created_at >= v_start and e.created_at < v_end
     group by e.promo_id, e.user_id
  ),
  covered as (
    select distinct t.promo_id, c.ref_id, c.collection_item_id
      from (select distinct ft.promo_id from first_tap ft) t
      cross join lateral admin._promo_covered(t.promo_id) c
  ),
  conv as (
    -- Wishlist adds: a covered card put in one of the user's wishlist collections.
    select ft.promo_id, ft.user_id, 'wishlist'::text as kind, wi.id as item
      from first_tap ft
      join public.collections wc on wc.user_id = ft.user_id and wc.is_wishlist
      join public.collection_items wi
        on wi.collection_id = wc.id
       and wi.created_at >= ft.tapped_at and wi.created_at < ft.tapped_at + interval '7 days'
      join covered c on c.promo_id = ft.promo_id and c.ref_id = wi.ref_id
    union
    -- Card or listing views.
    select ft.promo_id, ft.user_id, 'view', v.item_id
      from first_tap ft
      join public.recent_views v
        on v.user_id = ft.user_id
       and v.viewed_at >= ft.tapped_at and v.viewed_at < ft.tapped_at + interval '7 days'
      join covered c
        on c.promo_id = ft.promo_id
       and ((v.item_type = 'card' and v.item_id = c.ref_id)
         or (v.item_type = 'listing' and v.item_id = c.collection_item_id))
    union
    -- Offers on a listing of a covered card.
    select ft.promo_id, ft.user_id, 'offer', o.id
      from first_tap ft
      join public.offers o
        on o.buyer_id = ft.user_id
       and o.created_at >= ft.tapped_at and o.created_at < ft.tapped_at + interval '7 days'
      join public.offer_items oi on oi.offer_id = o.id
      join public.collection_items ci on ci.id = oi.collection_item_id
      join covered c on c.promo_id = ft.promo_id and c.ref_id = ci.ref_id
  ),
  conv_totals as (
    select cv.promo_id,
           count(*) filter (where cv.kind = 'wishlist')::int as wishlist_adds,
           count(*) filter (where cv.kind = 'view')::int     as card_views,
           count(*) filter (where cv.kind = 'offer')::int    as offers,
           count(distinct cv.user_id)::int                   as converted_users
      from conv cv
     group by cv.promo_id
  )
  select p.id, p.slug, p.title, p.template, p.placement, p.status, admin._promo_phase(p),
         coalesce(d.impressions, 0),
         coalesce(d.taps, 0),
         case when coalesce(d.impressions, 0) > 0
              then round(coalesce(d.taps, 0)::numeric / d.impressions, 4) end,
         coalesce(u.viewers, 0),
         coalesce(u.tappers, 0),
         coalesce(ct.wishlist_adds, 0),
         coalesce(ct.card_views, 0),
         coalesce(ct.offers, 0),
         coalesce(ct.converted_users, 0),
         case when coalesce(u.tappers, 0) > 0
              then round(coalesce(ct.converted_users, 0)::numeric / u.tappers, 4) end
    from admin.promos p
    left join daily d        on d.promo_id = p.id
    left join users u        on u.promo_id = p.id
    left join conv_totals ct on ct.promo_id = p.id
   -- Every published promo (so a live box with no traffic shows as zero), plus any other promo
   -- that had traffic in the range (since ended or archived).
   where p.status = 'published' or d.promo_id is not null or u.promo_id is not null
   order by coalesce(d.impressions, 0) desc, p.priority desc, p.title;
end;
$$;

-- ── Daily series for one promo ─────────────────────────────────────────────────────────────────
create or replace function admin.promo_results_daily(
  p_promo_id uuid,
  p_from     date default null,
  p_to       date default null
)
returns table (day date, impressions int, taps int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_to   date;
begin
  perform admin._require_role('editor', 'ops');
  select r.d_from, r.d_to into v_from, v_to from admin._promo_results_range(p_from, p_to) r;

  return query
    select g.day::date,
           coalesce(sum(d.sessions) filter (where d.kind = 'impression'), 0)::int,
           coalesce(sum(d.sessions) filter (where d.kind = 'tap'), 0)::int
      from generate_series(v_from, v_to, interval '1 day') g(day)
      left join admin.promo_event_daily d
        on d.day = g.day::date and d.promo_id = p_promo_id
     group by g.day
     order by g.day;
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function admin._promo_covered(uuid)                     from public, anon, authenticated;
revoke all on function admin._promo_results_range(date, date)         from public, anon, authenticated;
revoke all on function admin.promo_results(date, date)                from public, anon;
revoke all on function admin.promo_results_daily(uuid, date, date)    from public, anon;

grant execute on function admin._promo_covered(uuid)                  to service_role;
grant execute on function admin._promo_results_range(date, date)      to service_role;
grant execute on function admin.promo_results(date, date)             to authenticated, service_role;
grant execute on function admin.promo_results_daily(uuid, date, date) to authenticated, service_role;
