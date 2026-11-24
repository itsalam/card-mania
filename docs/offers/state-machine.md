# Offer state machine (ITS-140 / ITS-141)

How an offer moves from "make offer" to a transaction, and who can move it. The database
is the authority: every transition is a `SECURITY DEFINER` RPC that checks the caller, the
current status, and whose turn it is. Clients can't write `offers`, `offer_items`,
`offer_revisions` or `transactions` directly.

- Migration: `supabase/migrations/20261124000000_its140_offer_state_machine.sql` (built on
  `20261123000000_its121_its122_offer_transaction_rpcs.sql`)
- Tests: `supabase/tests/offer_state_machine.sql`, `supabase/tests/offer_transaction_rpcs.sql`
- Client mirror (display only): `client/offers/state.ts`

## Decisions (Nov 24, 2026)

| Question (Master File §14)    | Decision                                                                                                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are offers binding?           | **Binding on accept.** Until the other side accepts, either party can walk away: the seller declines, the buyer cancels. Accepting creates the transaction and moves stock. The buyer can't cancel from `accepted`. Disputes go through the transaction. |
| For how long?                 | **72 hours** to respond to each proposal. Every counter gives the other side a fresh 72 hours. One constant: `public.offer_response_window()`.                                                                                                           |
| Counteroffers at launch?      | **Yes, unlimited rounds.** A counter changes the **total** and can add a note. The items stay fixed.                                                                                                                                                     |
| Bundles at launch?            | **Yes, as one offer.** An offer can hold several items from one seller (the cart already does this), and it's negotiated and accepted as a whole, priced by its total. There's no per-item countering or partial acceptance.                             |
| Hold items while under offer? | Open offers don't reserve stock; any number of buyers can bid. **Acceptance** locks the listings, re-checks stock, decrements inventory and declines open competitors that can no longer be filled (ITS-122). See ITS-144 below for payment.             |

## States

```
                   counter_offer (seller)
       ┌─────────┐ ───────────────────────▶ ┌────────────┐
 ────▶ │ pending │                          │ countered  │
       └─────────┘ ◀─────────────────────── └────────────┘
         │  │  │     counter_offer (buyer)     │  │  │
         │  │  └── accept_offer (seller) ──┐   │  │  └── accept_offer (buyer)
         │  │                              ▼   ▼  │
         │  │                           ┌──────────┐  confirm_transaction_receipt
         │  │                           │ accepted │ ─────────────────────────▶ completed
         │  │                           └──────────┘
         │  └─ decline_offer (seller) / cancel_offer (buyer) ─▶ declined / cancelled
         └──── expire_offers (pg_cron, expires_at passed) ─────▶ expired
```

| Status      | Meaning                                                     | Waiting on |
| ----------- | ----------------------------------------------------------- | ---------- |
| `pending`   | The buyer's terms are on the table (original or a counter)  | seller     |
| `countered` | The seller's counter is on the table                        | buyer      |
| `accepted`  | Binding; a transaction exists (pending → shipped → …)       | —          |
| `completed` | The buyer confirmed receipt                                 | —          |
| `declined`  | The seller walked away, or a competing offer took the stock | —          |
| `cancelled` | The buyer walked away                                       | —          |
| `expired`   | Nobody answered within 72 hours                             | —          |

## Transitions and who can make them

| RPC                              | Caller                | From                    | To                                       |
| -------------------------------- | --------------------- | ----------------------- | ---------------------------------------- |
| `create_offer`                   | buyer                 | —                       | `pending` (revision 1, expires in 72h)   |
| `counter_offer(id, total, note)` | seller                | `pending`               | `countered` (new revision, window reset) |
| `counter_offer(id, total, note)` | buyer                 | `countered`             | `pending` (new revision, window reset)   |
| `accept_offer`                   | seller                | `pending`               | `accepted` + transaction                 |
| `accept_offer`                   | buyer                 | `countered`             | `accepted` + transaction                 |
| `decline_offer`                  | seller                | `pending`, `countered`  | `declined`                               |
| `cancel_offer`                   | buyer                 | `pending`, `countered`  | `cancelled`                              |
| `expire_offers()`                | pg_cron (every 5 min) | `pending`, `countered`  | `expired`                                |
| `confirm_transaction_receipt`    | buyer                 | (transaction `shipped`) | `completed`                              |

Rules:

- **Turn.** Only the party the offer is waiting on can accept or counter. The other party
  gets `Only the seller can accept this offer` / `Only the buyer can counter this
counteroffer` (42501).
- **Expiry.** `accept_offer` and `counter_offer` reject an offer past `expires_at`, even if
  the cron job hasn't flipped it yet (`This offer has expired`, 22023). Decline and cancel
  still work on a lapsed offer.
- **A counter must change the price** and be above zero. Same price means accept.
- **Competitors.** Accepting declines other `pending` or `countered` offers on the same
  listings that the remaining stock can't fill.

## History

`offer_revisions` holds one row per proposal: the author, their role, the total and the
note. Revision 1 is written by a trigger when the offer is created. Each counter adds one.
`offers.total_amount` is always the latest proposal; `offers.buyer_note` stays the original
note. Participants can read an offer's revisions; nobody can write them directly.

## Notifications

All rows go to `public.notifications` (category `offer`), so push delivery follows
automatically through `push_outbox`.

| Event                       | Recipient | Type              |
| --------------------------- | --------- | ----------------- |
| Offer created               | seller    | `offer_received`  |
| Seller counters             | buyer     | `offer_countered` |
| Buyer counters back         | seller    | `offer_countered` |
| Seller accepts              | buyer     | `offer_accepted`  |
| Buyer accepts a counter     | seller    | `offer_accepted`  |
| Declined (incl. competitor) | buyer     | `offer_declined`  |
| Cancelled                   | seller    | `offer_cancelled` |
| Expired                     | both      | `offer_expired`   |

## Expiry job

`expire-offers` runs `select public.expire_offers()` every 5 minutes. It's plain SQL, so
it needs no edge function or Vault `edge_token`. It shows up in the admin console's
Scheduled jobs dashboard like the other cron jobs. To change the window, redefine
`public.offer_response_window()`. That changes the column default and every future
counter; existing `expires_at` values stay as they are.

## ITS-144: holding items

Today accepting an offer is the hold: `accept_offer` locks the listings, re-checks stock,
creates the transaction, and the inventory trigger decrements stock. Two buyers can't both
be accepted for the last unit. There is no payment step yet (Payments epic). When one is
added, "accepted, awaiting payment" should use `reservations` with a timeout, and roll the
offer back if payment doesn't arrive.

## App UI (ITS-142 / ITS-145)

- Offer cards (`features/offers/negotiation.tsx`) show whose move it is and a time-left
  pill. Once there's a counter, they show the negotiation history (earlier totals struck
  through) in place of the single note.
- When it's your move: **Decline · Counter · Accept**. Counter opens an inline composer
  with a total, an optional message, and a send button that shows `Sending…` while the
  request is in flight. A counter isn't applied optimistically: it's a proposal the other
  side can bind to.
- When you're waiting: **Cancel Offer** (buyer) or **Withdraw Counter** (seller).
- Inbox filters add **Active** (pending + countered + accepted), **Countered** and
  **Expired** on native (`app/(tabs)/offers.tsx`) and web (`features/web/WebOffersPage.tsx`).
  An open offer past its deadline shows as expired before the cron job catches up.

### Design references (Mobbin)

- [eBay — Offer sheet](https://mobbin.com/screens/616ba8e1-0340-4539-8bb0-03622773982a):
  an "Offer expires 7h 53m" row, the seller's message, and stacked
  checkout / make counteroffer / decline actions. We follow its action set and the
  expiry-near-the-terms placement.
- [GOAT — offer modal](https://mobbin.com/screens/5f02bf42-d8c2-4612-8c88-a935005e47fc):
  a compact pill countdown ("1D 16H 47M") beside the offer, which our time-left pill
  copies.
- [Grailed — Review offer](https://mobbin.com/screens/41ebb84e-f5f6-4678-9883-49f6a91b744e):
  "This offer is binding and expires after 24 hours". It confirms binding on acceptance
  plus a fixed response window as the norm for collectible resale.
