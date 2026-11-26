# Ownership transfer on a completed sale (ITS-135)

Decided Nov 26, 2026. Migration: `supabase/migrations/20261127000000_its135_ownership_transfer.sql`.

## Flow

| Step                   | Seller                                                         | Buyer                                        |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| Offer accepted         | Copies **held**: still owned, no longer for sale               | nothing yet                                  |
| Shipped                | still held                                                     | nothing yet                                  |
| Buyer confirms receipt | Copies sold: listing, Selling and Vault counts drop (0 → gone) | New Vault row per offer item                 |
| Disputed               | Stays held                                                     | nothing (resolution is follow-up admin work) |

All of it happens in the database, inside `accept_offer` and `confirm_transaction_receipt`. The
app no longer copies cards itself (the old "Reflect changes in my collection" tick is gone).

## Decisions

- **Hold, don't remove, at acceptance.** `collection_items.held_quantity` on the listing row.
  `quantity` still means "copies owned"; what can be bought is `quantity - held_quantity`.
  `create_offer`, `accept_offer`, the marketplace listings, storefront counts, suggested
  sellers, wishlist hits and storefront search all use the available count.
- **A held listing is locked.** It can't be deleted, shrunk below the hold, or changed (card,
  grade, variants, collection) until the sale finishes (`collection_items_guard_held`).
- **One new Vault row per purchase.** The buyer's row keeps grade, grading company and
  variants, and links back through `source_offer_item_id` (unique, so the transfer can't
  double-add). Two identical copies bought separately are two rows.
- **Photos are shared, not copied.** The buyer's rows point at the seller's stored files.
  `delete_collection_item_photo` deletes a photo row and returns the file path only when no
  other row uses it; the app removes the file only then.
- **Disputes keep the hold.** Nothing moves; releasing or completing a disputed sale is a
  follow-up admin ticket.
- **Idempotent.** `transactions.transferred_at` is set once; rerunning the transfer is a no-op.

## Older transactions

Transactions accepted before this migration already removed the seller's stock
(`transactions.holds_stock = false`). Completing one only adds the buyer's copy, using the
listing if it still exists or the card id from the offer's snapshot. Already-completed
transactions are left alone (their buyers may have used the old opt-in).

## Not covered

- An "On hold" badge on the seller's collection rows (the hold is on the listing; Selling and
  Vault rows show the full count until the sale completes).
- Dispute resolution.
- Sale counts in `_marketplace_base_listings` still join through the listing, so a fully sold
  listing stops counting toward popularity (unchanged from before).
