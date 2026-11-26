-- ITS-133: what "Total Value" means and how fresh its prices are.
--
-- Decisions (Nov 25, 2026; docs/collections/valuation.md):
--   * Total Value = the Vault (everything you own). Selling items are mirrored into the Vault,
--     so the Selling total is the "For Sale" share and PC = Vault - For Sale. The wishlist is
--     never part of it.
--   * An item's price = the latest CardHedger price for its grade (cards.grades_prices). No
--     price for that grade counts as $0 and the item is reported as unpriced.
--   * Freshness = when the card's prices were last updated: the later of the scheduled refresh
--     (prices_refreshed_at) and an on-demand fetch (last_updated).
--
-- collection_valuation reports, for one collection, the value plus how many items are priced or
-- unpriced and how old the oldest price is ("Prices as of ..." on Home). Runs as the caller, so
-- RLS decides which collections they can see.

-- When a card's prices were last updated, from either refresh path.
create or replace function public.card_prices_as_of(p_prices_refreshed_at timestamptz, p_last_updated timestamptz)
returns timestamptz
language sql
immutable
as $$ select greatest(p_prices_refreshed_at, p_last_updated) $$;

create or replace function public.collection_valuation(p_collection_id uuid)
returns table (
  total_cents bigint,
  priced_quantity bigint,
  unpriced_quantity bigint,
  -- The oldest price behind the total (null when nothing is priced).
  prices_as_of timestamptz,
  newest_price_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with items as (
    select
      ci.quantity,
      coalesce(
        (c.grades_prices ->> coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'))::numeric,
        0
      ) as unit_cents,
      public.card_prices_as_of(c.prices_refreshed_at, c.last_updated) as as_of
    from public.collection_items ci
    left join public.cards c
      on ci.item_kind = 'card'::public.item_kind and c.id = ci.ref_id
    left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
    left join public.grading_companies gc on gc.id = gcnd.company_id
    where ci.collection_id = p_collection_id
  )
  select
    coalesce(sum(round(unit_cents) * quantity), 0)::bigint,
    coalesce(sum(quantity) filter (where unit_cents > 0), 0)::bigint,
    coalesce(sum(quantity) filter (where unit_cents <= 0), 0)::bigint,
    min(as_of) filter (where unit_cents > 0),
    max(as_of) filter (where unit_cents > 0)
  from items
$$;

grant execute on function public.card_prices_as_of(timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.collection_valuation(uuid) to anon, authenticated, service_role;
