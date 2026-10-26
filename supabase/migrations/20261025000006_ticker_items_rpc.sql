-- Home ticker tape: 7-day (p_days) price moves for the caller's tracked cards.
--
-- Tracked = cards the caller holds (non-wishlist collection_items, quantity > 0 → 'owned') plus
-- their wishlist ('watching'), one row per (card, grade). Owned wins over watching for the
-- same card+grade; wishlist rows with no grade track the ungraded price. The comparison point
-- is the latest card_price_history row for that card+grade at least p_days old, so change_pct
-- is null until tracked-price-refresh has built enough history (shown as "—").
--
-- Rows with no current price are dropped — a ticker entry needs a number. Owned rows lead,
-- biggest absolute move first.

create or replace function public.get_ticker_items(p_limit int default 20, p_days int default 7)
returns table (
  ref_id        uuid,
  name          text,
  set_name      text,
  price_key     text,
  source        text,
  current_cents int,
  past_cents    int,
  change_pct    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with tracked as (
    select distinct on (ci.ref_id, public.grade_condition_price_key(ci.grade_condition_id))
           ci.ref_id,
           public.grade_condition_price_key(ci.grade_condition_id) as price_key,
           case when col.is_wishlist then 'watching' else 'owned' end as source
      from public.collection_items ci
      join public.collections col on col.id = ci.collection_id
     where ci.user_id = auth.uid()
       and ci.item_kind = 'card'::public.item_kind
       and (ci.quantity is null or ci.quantity > 0)
     order by ci.ref_id, public.grade_condition_price_key(ci.grade_condition_id),
              col.is_wishlist asc -- owned first
  ),
  priced as (
    select t.*, c.name, c.set_name,
           nullif(round((c.grades_prices ->> t.price_key)::numeric), 0)::int as current_cents,
           (select h.price_cents
              from public.card_price_history h
             where h.card_id = t.ref_id and h.grade = t.price_key
               and h.recorded_date <= current_date - greatest(p_days, 1)
             order by h.recorded_at desc
             limit 1) as past_cents
      from tracked t
      join public.cards c on c.id = t.ref_id
  )
  select p.ref_id, p.name, p.set_name, p.price_key, p.source, p.current_cents, p.past_cents,
         case when p.past_cents > 0
              then round((p.current_cents - p.past_cents)::numeric / p.past_cents * 100, 1) end
    from priced p
   where p.current_cents is not null
   order by (p.source = 'owned') desc,
            abs(case when p.past_cents > 0
                     then (p.current_cents - p.past_cents)::numeric / p.past_cents end) desc nulls last,
            p.name
   limit greatest(coalesce(p_limit, 20), 0)
$$;

revoke execute on function public.get_ticker_items(int, int) from public, anon;
grant execute on function public.get_ticker_items(int, int) to authenticated;
