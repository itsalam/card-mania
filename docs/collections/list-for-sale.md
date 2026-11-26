# List for Sale and asking prices (ITS-134)

Decided Nov 26, 2026. Migration: `supabase/migrations/20261128000000_its134_list_for_sale.sql`.
Builds on ITS-135 (holds and transfer, `docs/collections/ownership-transfer.md`).

## The model

- **Total Value = the Vault.** PC is the Vault minus what's for sale (ITS-133).
- **A listing** is a row in a storefront collection. It's mirrored into Selling, and Selling
  into the Vault. Each mirror points at what it mirrors (`collection_items.mirror_of`).
- **List for Sale** (`list_for_sale`) moves _n_ copies out of a PC row into the user's
  automatic **"For Sale"** storefront collection (`collections.is_listing_default`, created and
  published on first use). The PC row shrinks by _n_, the listing's Vault mirror adds _n_, so
  the Vault total doesn't change. Photos go with the copies (shared files).
- **Remove from sale** (`unlist_item`) moves the copies back into PC (into a matching PC row,
  or a new one). Refused while a sale holds them.
- **Asking price** (`asking_price_cents`, USD) lives on the listing and is copied to its
  mirrors; `set_asking_price` works from any of them. Required for new listings, prefilled
  with the market price for the grade.
- **Older listings** have no asking price and keep selling at the market price, labeled
  "Market price".

## Mirrors

| Action                        | Effect                                             |
| ----------------------------- | -------------------------------------------------- |
| Insert into a storefront      | Selling mirror, then Vault mirror                  |
| Edit a listing or a mirror    | Copied to the rest of the chain (no-op edits stop) |
| Delete a mirror               | Deletes the listing, so the whole chain goes       |
| Delete the listing / sell out | Mirrors go with it (foreign key cascade)           |
| Mark a collection storefront  | Its cards get Selling (and Vault) mirrors          |
| Unmark it                     | Mirrors removed; the cards stay in the collection  |

Held copies (ITS-135) block deletes and shrinking from any row in the chain.

### The bug this replaced

The old triggers matched mirrors on card + grade + variants. If a PC row of the same card
existed, no Vault mirror was created, and later updates and deletes of the listing hit the PC
row instead: own 3, list 1, sell or delist it, and all 3 disappeared from the Vault.

### Existing data

The migration links existing mirrors by the old key match, then creates mirrors the old
triggers skipped. When a Selling row had no Vault mirror because a PC row stood in for it,
its copies are taken out of that PC row, so the Vault total is unchanged. Storefront rows that
had never been mirrored into Selling (some older listings) now are, so their copies start
counting in Selling and the Vault.

## Where the price shows

- **Marketplace cards** (`GridCard`, `FeaturedCard`, `MarketListItem`): the asking price, or
  the market price labeled "Market price".
- **Storefront rows and web catalog** (`storefront-view.tsx`, `StorefrontCatalog.tsx`): the
  asking price, also used for the cart and for sorting by price.
- **Card detail "Add to Deal"** (`CollectionInfoCard`): the asking price, with "Market price"
  shown when there isn't one.
- **Wishlist hits**: priced at the asking price.
- **Collection views** keep showing market value (that's what valuation uses).

Quantities offered to buyers exclude copies on hold (`quantity - held_quantity`).

## UI

In a collection row's **Options** menu:

- **List for sale**: shown on Vault rows with PC copies. Pick the copy group, the number of
  copies and the price.
- **Price & listing**: shown on listed copies. Change the price, or remove the copies from
  sale.

References: Shopify's product Price form
(https://mobbin.com/screens/ec76920b-6579-43a3-920b-ad162537a15a) and Glovo's one-field bottom
sheet (https://mobbin.com/screens/58eda562-3324-462b-a1d2-0e581521dfc1).

## Not covered

- Currencies other than USD for asking prices.
- An "On hold" badge on collection rows.
- Listing straight from the card detail screen (it only receives an owned item from storefront
  links today).
