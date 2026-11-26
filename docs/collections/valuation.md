# Collection valuation (ITS-133)

What "Total Value" means and which prices back it.

- Migration: `supabase/migrations/20261126000000_its133_collection_valuation.sql`
- Tests: `supabase/tests/collection_valuation.sql`, `__tests__/client/collectionValuation.test.ts`
- Client: `client/collections/valuation.ts`

## Decisions (Nov 25, 2026)

| Question                   | Decision                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is Total Value?       | **What you own: the Vault.** Shown split into **PC** (kept) and **For Sale**. Selling items are mirrored into the Vault, so For Sale = the Selling total and PC = Vault − For Sale. Never count Selling twice. |
| Is the wishlist included?  | **No.** Wishlist cards aren't owned. The wishlist keeps its own figure in the breakdown.                                                                                                                       |
| Which price backs an item? | **The latest CardHedger price for the item's grade** (`cards.grades_prices`, refreshed on a schedule; daily history in `card_price_history`). No price for that grade counts as **$0** and shows "No price".   |
| How fresh is a price?      | The later of the scheduled refresh (`cards.prices_refreshed_at`) and an on-demand fetch (`cards.last_updated`): `public.card_prices_as_of(...)`.                                                               |
| How is freshness shown?    | Home: **"Prices as of &lt;date&gt;"** under the total, using the oldest price behind it, plus "N cards have no price". Card detail: **"Prices updated &lt;date&gt;"** under the price summary.                 |

## Where it shows

- **Home → Total Value** (`features/home/PortfolioSummary.tsx`): the Vault total, the caption "PC $X · For sale $Y", and the freshness line from `collection_valuation(vault)`.
- **Card detail** (`PriceSummaryBar`, native and web): "Prices updated &lt;date&gt;".
- **Collection rows** (`editable-entry-item.tsx`): a copy whose grade has no price shows "No price" instead of a blank amount.

## `collection_valuation(collection_id)`

Returns `total_cents`, `priced_quantity`, `unpriced_quantity`, `prices_as_of` (oldest price behind the total) and `newest_price_at`. It runs as the caller, so RLS decides which collections are visible. Its total matches `collection_totals`, which the app already shows; this function adds the counts and freshness.

## Not decided here

- Smoothing (e.g. averaging recent sales) or falling back to the ungraded price when a grade has no price. Today neither is done.
- Cost basis and gain/loss: ITS-137.
- The PC / For Sale dashboard and graph: ITS-139.
