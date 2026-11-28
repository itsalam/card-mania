# Item attributes and gain/loss (ITS-137)

Cost basis, serial number and condition notes on collection rows, and the gain they make
possible.

- Migration: `supabase/migrations/20261129000000_its137_item_attributes.sql`
- Tests: `supabase/tests/item_attributes.sql`, `__tests__/client/itemDetails.test.ts`
- Client: `client/collections/item-details.ts`
- UI: `components/collections/items/item-details-sheet.tsx` (a card's Options → "Cost, serial &
  notes"), the gain rows in `features/collection/components/CollectionBreakdown.tsx`, and the
  serial number on collection rows (`editable-entry-item.tsx`)

## Decisions (Nov 27, 2026)

| Question                    | Decision                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How is cost basis recorded? | **Per copy**, in cents (USD). Unrealized gain = (market price for the grade − cost) × quantity.                                                                                                                                            |
| Who can see it?             | **Only the owner.** Cost basis and condition notes live in `collection_item_private` (owner-only RLS), because `collection_items` rows are readable by others (public collections, storefronts, offers).                                   |
| Serial number               | **Public**, on the row (`collection_items.serial_number`, e.g. "12/99", up to 32 characters). **Only on a row holding one copy**: the database refuses a serial on a larger row, and the row's quantity stepper stops at 1.                |
| Sales in the app            | The buyer's new row gets **the price paid per copy** as its cost basis, and keeps the serial number. The seller's notes stay behind. The seller's sale is recorded in `realized_sales` (seller-only) with their cost basis at that moment. |
| Realized gain               | (sale price − cost basis) × quantity, over sales that had a cost basis. Sales before Nov 27, 2026 weren't recorded and don't count.                                                                                                        |
| Copies without a cost       | Left out of the gain and counted ("3 of 5 copies"), never guessed.                                                                                                                                                                         |

## Listings and mirrors

A listing chain (storefront listing → Selling mirror → Vault mirror) keeps the private
attributes once, on its root (the row with no `mirror_of`). Reading or editing from a mirror goes
to the root (`public._item_root`). The serial number is copied along the chain like the other
row fields.

- **List for Sale** gives the listing the copies' cost basis, notes and serial number.
- **Remove from sale** merges the copies back into a PC row only when nothing tells them apart:
  same card, grade and variants, no serial number, and the same cost basis and notes. Otherwise
  they get a PC row of their own, so no cost is averaged away.

## RPCs

| Function                                         | Returns                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `item_details(item_id)`                          | The row's quantity, serial number, cost basis, notes, market price per copy and unrealized gain. Owner only.                |
| `set_item_details(item_id, cost, serial, notes)` | Replaces all three (null or blank clears). Refuses a negative cost, or a serial on a row with more than one copy.           |
| `portfolio_gain()`                               | Unrealized gain and cost over the caller's Vault (copies with and without a cost), and realized gain from `realized_sales`. |

## Where it shows

- **Item details sheet**: Market value, Cost and Unrealized gain (with its percentage, green or
  red) above the three fields. Layout references: Fidelity's position details
  (https://mobbin.com/screens/8b6bc6fa-11c6-400b-978e-3e895e3ef061), Lightyear's profit and loss
  sheet (https://mobbin.com/screens/3bbd7fe8-2e93-4540-a045-2c6b4e642bfd), Public's cost basis
  summary (https://mobbin.com/screens/b8208254-9065-4d64-9783-da4d95becd17).
- **Breakdown** (Home and the Collection page): Unrealized gain and Realized gain below the
  Wishlist row, or a hint to add costs when none are set.
- **Collection rows**: "#12/99" under the grade, price and quantity.

## Not decided here

- Showing condition notes to buyers on a listing.
- Lots (several purchases of one card at different costs in one row). Today each cost is its own
  row.
- Gain over time: ITS-139 (the PC / For Sale dashboard).
