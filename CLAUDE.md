# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**

```bash
yarn start              # Start Expo dev server
yarn start:local        # Start with .env.local (local Supabase)
yarn ios                # iOS simulator
yarn android            # Android emulator
yarn web                # Web (Metro bundler)
```

**Linting & Formatting:**

```bash
yarn lint               # Expo linter
yarn eslint             # ESLint
yarn format             # Prettier
```

**Database (Supabase):**

```bash
yarn db:new             # Create new migration
yarn db:diff            # Generate migration diffs
yarn db:reset           # Reset local DB
yarn db:push            # Push migrations to remote
yarn db:types           # Regenerate TypeScript types from schema
```

## Architecture

**card-mania** is a cross-platform TCG (Trading Card Game) marketplace app built with Expo/React Native, supporting iOS, Android, and Web.

### Routing

Expo Router (file-based, typed routes). Tab-based navigation with stack modals:

- `app/(tabs)/` — main tabbed interface (home, collection, marketplace, profile)
- `app/cards/[card]` — card detail modal
- `app/storefront/[username]` — public web seller storefront
- `app/cart.tsx` — shopping cart modal
- `app/_layout.tsx` — root layout (Sentry init, auth gate)
- `app/_providers.tsx` — all context providers wrapped here

### Feature Structure

Code is organized by vertical feature slices in `features/`:

- `features/offers/` — offer system + Supabase realtime subscriptions for notifications
- `features/collection/` — user card collections
- `features/cart/` — shopping cart logic
- `features/profile/` — public and private profile views
- `features/tcg-card-views/` — card display variants
- `features/notifications/` — notification center

Shared reusable components live in `components/`, with `components/ui/` containing Shadcn-style RN primitives (accessible, unstyled base components from `rn-primitives`).

### State Management

Three layers:

1. **Zustand** (`lib/store/`) — local/auth state. `useUserStore` (persisted, handles auth), `useCartStore` (cart items).
2. **TanStack React Query** — server state, caching, mutations.
3. **Supabase realtime** — live offer notifications via channel subscriptions.

Client query functions in `client/` are organized by domain (card, collections, offers, notifications, etc.) and called from React Query hooks in features. If a client query is deemed feature specific, without a possible extentsion/use case for other features, then it can exist in the corresponding feature folder.

### Backend

- **Supabase** — PostgreSQL + Auth + Realtime + Edge Functions
- Migrations in `supabase/migrations/` (75+ files tracking full schema history)
- Edge functions in `supabase/functions/` written in Deno (fetch-card, image-proxy, etc.)
- RLS (Row Level Security) enforced for all user data
- Full-text search via `tsvector`/trigram indexes on collections

### Styling

**NativeWind 4** (Tailwind CSS for React Native) — use Tailwind classes everywhere. Platform-specific styles handled via NativeWind's platform utilities. Gluestack UI is being phased out — prefer `components/ui/` primitives.

**React Native UI Lib** — Numerous common components leverage the components and utility classes (Colors, Spacings, BorderRadiuses, etc.) via React Native UI Lib. While referencing a component directly from RN-UI should be used sparingly, if it is widely adopted and used throughout the app already, then usage of the component library is acceptable.

### Key Config

- Path alias `@/*` maps to repo root (configured in babel + tsconfig)
- Environment variables use `EXPO_PUBLIC_` prefix (loaded in `app.config.js`)
- `.env.local` targets local Supabase on port 54321
- Husky pre-commit hook runs lint + eslint + format on staged `.{js,ts,tsx}` files
- New Architecture enabled for React Native

---

## Search Architecture

### Edge Function: `supabase/functions/price-charting/index.ts`

Multi-provider search that blends local PostgreSQL full-text results with external vendor data.

**Provider priority (blend order):**

1. **Local DB** (`search_cards_blended` RPC) — score ≥ 0.35 threshold; these float to the top
2. **eBay seller listings** — when the requesting user has a linked eBay account (`user_ebay_accounts` table), their own listings rank just below local results (score ~0.7)
3. **General vendor results** — PriceCharting + eBay Browse API fill the remainder, deduplicated by ID

**Key design decisions:**

- Blending is a true merge (not binary either/or); local + vendor results can coexist
- Image hints use a single batched DB query instead of N sequential fetches
- Filters (`sport`→`genre`, `minPrice`, `maxPrice`) are forwarded to both PriceCharting and eBay
- Cursor-based pagination uses a string offset; `cursor=20` means "skip 20" (eBay supports this; PriceCharting may not)
- eBay is opt-in: only runs when `EBAY_APP_ID` + `EBAY_CERT_ID` env vars are set

**PriceCharting grade field mapping (corrected):**

```text
psa10     → grade-price-10
psa9_5    → grade-price-9-5
psa9      → grade-price-9
psa8      → grade-price-8
psa7      → grade-price-7
cgc10     → condition-17-price
sgc10     → condition-18-price
ungraded  → loose-price
```

### eBay Integration: `supabase/functions/_shared/providers/ebay.ts`

- Uses **eBay Browse API** (free, app-level OAuth2 client credentials)
- App token is module-level cached (~2h validity, survives warm function instances)
- Searches categories `183454` (sports cards) + `2536` (non-sport TCG) simultaneously
- User-linked seller listings surfaced via `filter=sellers:{username}` — no user-level token needed for Browse API

**Required Supabase secrets (edge function env vars):**

```bash
EBAY_APP_ID=
EBAY_CERT_ID=
EBAY_MARKETPLACE=EBAY_US   # optional, defaults to EBAY_US
```

### eBay Account Linking: `user_ebay_accounts` table

Migration: `supabase/migrations/20260329000000_user_ebay_accounts.sql`

Stores each user's eBay `ebay_username` (and optionally OAuth tokens for future seller-level APIs). The edge function reads this via service role to look up the caller's eBay username when an `Authorization` header is present in the search request.

**Flow:** user links eBay account → `ebay_username` stored → search requests include user JWT → edge function decodes `sub` from JWT → fetches seller username → runs parallel seller-scoped eBay search → seller's listings promoted in results.

**OAuth flow for account linking is not yet implemented** — needs a UI + edge function callback route. The DB table and search-side consumption are ready.

### Client: `client/price-charting/index.ts`

- **Pagination**: `getNextPageParam` returns a string offset (`"20"`, `"40"`, …) or `undefined` when exhausted. `cursor` param in `SearchRequest` carries it to the edge function.
- **Suggestions**: `useSuggestionsFixed` fetches the hottest query from `search_queries` (by `hits DESC`) to drive the suggestions carousel. Falls back to `EXPO_PUBLIC_DEFAULT_SUGGESTIONS_QUERY` env var, then `"baseball cards 2025 topps"`.

### Planned Providers (Phase 4)

| Provider         | What it adds                                |
| ---------------- | ------------------------------------------- |
| 130point         | eBay sold comps aggregated for sports cards |
| TCGPlayer        | MTG/Pokemon/YuGiOh catalog + market prices  |
| PSA Registry     | Graded cert lookup by cert number           |
| Beckett          | Industry book value for vintage             |
| PWCC Marketplace | High-end auction results                    |

Add each as a new provider module in `supabase/functions/_shared/providers/` and fan-out via `Promise.allSettled` in the main edge function.
