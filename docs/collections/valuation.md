# Collection valuation (ITS-133)

What "Total Value" means and which prices back it.

- Migrations: `supabase/migrations/20261126000000_its133_collection_valuation.sql`, `20261126100000_its133_one_snapshot_per_transaction.sql`
- Tests: `supabase/tests/collection_valuation.sql`, `supabase/tests/collection_value_history.sql`, `__tests__/client/collectionValuation.test.ts`
- Client: `client/collections/valuation.ts`

## Decisions (Nov 25, 2026)

| Question                   | Decision                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is Total Value?       | **What you own: the Vault.** Shown split into **PC** (kept) and **For Sale**. Selling items are mirrored into the Vault, so For Sale = the Selling total and PC = Vault − For Sale. Never count Selling twice.                                           |
| Is the wishlist included?  | **No.** Wishlist cards aren't owned. The wishlist keeps its own figure in the breakdown.                                                                                                                                                                 |
| Which price backs an item? | **The latest CardHedger price for the item's grade** (`cards.grades_prices`, refreshed on a schedule; daily history in `card_price_history`). No price for that grade counts as **$0** and shows "No price".                                             |
| How fresh is a price?      | The later of the scheduled refresh (`cards.prices_refreshed_at`) and an on-demand fetch (`cards.last_updated`): `public.card_prices_as_of(...)`.                                                                                                         |
| How is freshness shown?    | Home: **"Prices as of &lt;date&gt;"** in the Total Value split (PC / For sale) that opens with "View breakdown", using the oldest price behind it, plus "N cards have no price". Card detail: **"Prices updated &lt;date&gt;"** under the price summary. |

## Where it shows

- **Home → Total Value** (`features/home/PortfolioSummary.tsx`): the Vault total. "View breakdown" opens the breakdown below.
- **Breakdown** (`features/collection/components/CollectionBreakdown.tsx`, on Home and the Collection page): PC and For sale with one bar and their share of what you own, then the Wishlist on its own row marked "Not owned" (no share, since it isn't owned). On Home it adds the freshness line from `collection_valuation(vault)`, and each row toggles its line on the chart (PC, For sale, Wishlist; `features/home/Breakdowns.tsx`).
- **Card detail** (`PriceSummaryBar`, native and web): "Prices updated &lt;date&gt;".
- **Collection rows** (`editable-entry-item.tsx`): a copy whose grade has no price shows "No price" instead of a blank amount.

## Value history

`collection_value_history` holds one snapshot per collection per transaction (unique on `collection_id, snapshotted_at`). Snapshots are written when `collection_totals` changes, and the writers upsert, so an action that touches several rows (List for Sale, a sale, mirrors) leaves one row with the settled total. Before Nov 26, 2026 each statement appended its own row at the same timestamp, and the chart and the Cards stat could pick an in-between value (e.g. a listed card counted twice in the Vault).

The chart's PC line is the day's Vault minus Selling, each carried forward over days without a snapshot.

## `collection_valuation(collection_id)`

Returns `total_cents`, `priced_quantity`, `unpriced_quantity`, `prices_as_of` (oldest price behind the total) and `newest_price_at`. It runs as the caller, so RLS decides which collections are visible. Its total matches `collection_totals`, which the app already shows; this function adds the counts and freshness.

## Not decided here

- Smoothing (e.g. averaging recent sales) or falling back to the ungraded price when a grade has no price. Today neither is done.
- Cost basis and gain/loss: decided in ITS-137, see `docs/collections/item-attributes.md`.
- The PC / For Sale dashboard and graph: ITS-139.
