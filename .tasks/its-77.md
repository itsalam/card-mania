# ITS-77 — Search: wire all user-facing workflows end-to-end

ITS-80 (filter hierarchy) decided: **Option A — genre-first chips** ("sport" maps to `cards.genre`).

## Phases
- [x] **Phase 1 — backend + contract** (verified on Supabase dev branch `its77-search`)
  - migration `20260711000000_its77_search_filters_storefront.sql`: `sealed` flag on cards;
    `search_cards_blended` extended with genre/set/price/sealed predicates;
    new `search_storefront_items` (marketplace scope) returning seller + price + grade.
  - edge fn `price-charting`: reads `scope` + `filters`; marketplace → storefront RPC (no vendor
    fallbacks); catalog → filters passed to `search_cards_blended`.
  - client contract unified: `SearchRequest`/`SearchFilters` (types.ts), `useCardSearch({ scope, filters })`.
- [ ] Phase 2 — genre-first filter UI (chips) + set/grading filter sheet, wired to the store → RPC.
- [ ] Phase 3 — `scope` through SearchScreen; Marketplace tab opens scoped search.
- [ ] Phase 4 — per-context `itemAccessories` (collection add / cart+price / wishlist).
- [ ] Phase 5 — marketplace sections (Featured / Auctions-Graded / Auctions-Sealed) → real storefront queries.
- [ ] Phase 6 — ITS-75 fix (route param drop) + e2e walkthroughs.

## Notes
- Edge-fn changes need deploy + the migration applied to main before production search uses filters.
- `search_storefront_items` is SECURITY DEFINER (storefront items are public); grants to anon/authenticated.
- Regenerate `lib/store/supabase.d.ts` (`npm run db:types`) after the migration lands on main.
