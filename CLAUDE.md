# Card Mania — Agent Context

## Working on tasks

When starting work on any task, look up the corresponding Linear issue (e.g. ITS-83) for requirements, acceptance criteria, and design decisions before writing code. Use the `linear-cli` skill to fetch issue details.

For UI layout and designs, source and refer to Mobbin/Refero, via the MCP, and cite resources. If a task creates UI components/layouts that have not cited Mobbin/Refero, or the design layout, retroactively fill out the design documentation with the existing work.

## Repo

github.com/itsalam/card-mania

## Active work

- Branch: `vincentthanhlam/wishlist-hits-price-refresh` (PR into `staging`)
- Milestone: v0.1 — Demo Ready

## Environments & deploys

- **Local** — `supabase start` (API `127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio `127.0.0.1:54323`).
- **Staging** — the only hosted Supabase project (`zijgqgpwmqrgnzcictcb`, defined in `supabase/environments.json`). Used to test against live vendor APIs and services; it is _not_ production, and there is no production project yet. The EAS `preview`/`beta`/`production` env files and `app.config.js`'s fallback all point at it. Call it staging, not prod.
- **Branch flow** — feature branches open PRs into **`staging`** (not `main`). Merging into `staging` deploys it; `staging` is promoted to `main` once verified.
- **Staging deploys are automatic on merge** — `.github/workflows/deploy-staging.yml` runs on every push to `staging`: fresh local DB (`supabase db start`, proves migrations apply from scratch) → pgTAP + Deno tests → `scripts/deploy.sh staging --yes` (`supabase db push` → `supabase functions deploy` per changed function → `npm run db:types` → `deploy-staging-<timestamp>` git tag) → commits regenerated DB types back to `staging`. Needs repo/`staging`-environment secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. Manual deploys still work: `npm run deploy:staging` (preflight → confirm → same steps); use `--dry-run` first. Never deploy functions with `--prune` (staging has functions with no local source). CI (`ci.yml`) lints/exports web on PRs.
- **Staging SQL** — Dashboard SQL editor, or `psql` with the connection string from the dashboard's Connect panel. Vendor keys are staging secrets (`supabase secrets list` shows names only; values aren't readable) — for local runs put them in `supabase/functions/.env.local` (gitignored; `supabase/functions/.env` is not) and pass `--env-file`.
- **Vault vs. function secrets** — two separate stores. Edge function env vars are `supabase secrets set/list` (read via `Deno.env.get`). pg_cron jobs read `project_url` and `edge_token` from the **Postgres Vault** (`vault.decrypted_secrets`), managed only via SQL (`vault.create_secret` / `vault.update_secret`) or Dashboard → Integrations → Vault — `supabase secrets set edge_token=…` does _not_ update it. `edge_token` must be one of the project's service keys; staging uses the new API keys, so that's the `sb_secret_…` key, not the legacy `service_role` JWT. Internal cron-only functions check it with `isServiceRequest` (`_shared/service-auth.ts`). `cron.job_run_details` reports `succeeded` even when the call 401s — check `net._http_response` / the function's own ledger instead.

## Stack

| Layer         | Library                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| App framework | Expo 55, Expo Router 55, React Native 0.83                              |
| Styling       | NativeWind 4, Tailwind CSS (`darkMode: 'class'`)                        |
| UI components | `react-native-ui-lib`, `@gluestack-ui`                                  |
| Animations    | React Native Reanimated 4,`@shopify/react-native-skia` (stubbed on web) |
| State         | Zustand 5                                                               |
| Server state  | TanStack Query 5                                                        |
| Backend       | Supabase (Auth, Postgres, Realtime)                                     |
| Monitoring    | Sentry (`@sentry/react-native`)                                         |

## Routing

Expo Router file-based routing. Two top-level segments:

- `app/(tabs)/` — authenticated native app tabs (collection, marketplace, offers, notifications, profile)
- `app/[username].tsx`, `app/storefront/` — public web storefronts
- `app/cards/`, `app/cart.web.tsx`, `app/offers.web.tsx`, `app/transactions.web.tsx` — web-only routes

Many routes have both a native and web version via `.web.tsx` siblings (e.g. `cart.tsx` / `cart.web.tsx`).

## Auth architecture

- `lib/store/useUserStore.ts` — Zustand store; holds session/user/profile
- `app/_providers.tsx` — subscribes to `onAuthStateChange`, drives store; has a `.web.tsx` sibling
- `features/splash/index.tsx` — `AuthGate` (gates app) + `SplashPage` (login/signup toggle)
- `user_profile` table PK is `user_id` (not `id`)

## Interaction patterns

Buttons and other interactive controls must respond to a tap immediately — never wait on a network call before the UI changes.

- **Toggle-style state** (wishlist, collection sync, notification read state, offer accept/decline, etc.) — flip the UI state synchronously on press, run the mutation in the background, and roll back on error. With TanStack Query this means putting the state flip in `onMutate` (or, for local component state, right at the top of the press handler before calling `mutate`), reverting in `onError`, and reconciling with server truth in `onSuccess`. Reference implementation: `useToggleWishlist` in `client/card/wishlist.ts`.
- **One-time commit actions** (submit offer, checkout, save shipping address) — these are not optimistic-state toggles; don't fake a success state before the server confirms, since that misrepresents an irreversible/financial action. They still must give immediate feedback: flip to a disabled/pending visual (e.g. `isPending`-driven label and disabled state) the instant the press handler runs, not after the request resolves.

## Design system

### Color usage

All colors must come from `Colors` (`react-native-ui-lib`, imported as `import { Colors } from 'react-native-ui-lib'`) — e.g. `Colors.$textDefault`, `Colors.$textDanger`, `Colors.$backgroundElevated`, `Colors.rgba(Colors.$outlineNeutral, 0.4)`. `Colors.$xxx` tokens are resolved from the active theme (light/dark) at runtime; a literal hardcoded at compile time (`'white'`, `'#fff'`, `color="white"`) or a static Tailwind color utility (`text-white`, `bg-white`, `text-red-400`) is frozen to that literal value regardless of theme and will visibly mismatch the surrounding UI when the theme changes.

- Never hardcode a hex/named color value or a static Tailwind color class for anything that should track the theme (text, icon, background, border colors). If a `Colors.$xxx` token isn't defined for what you need, use `Colors.rgba(Colors.$someToken, alpha)` rather than inventing a literal.
- The shared `Text` component (`components/ui/text/base-text.tsx`) already defaults to `color: Colors.$textDefault` — if you just want default text color, don't add a `text-white`/`text-black` class or inline `color` override at all; only override when you need a different token (e.g. `Colors.$textDanger` for errors, `Colors.$textNeutral` for secondary text).
- Fixed brand colors (e.g. the Google/Facebook logo SVG fills) are the one legitimate exception — they represent a third party's brand mark, not this app's theme, so they stay hardcoded.
- `shadowColor` is also an accepted exception — shadows read as black in both light and dark mode by convention.

### Toggle / segmented-control styling

All toggle bars and tab strips (period selectors, Chart/Sales tabs, Vault/Wishlist/Selling tabs, etc.) must share one visual convention — a bordered pill container with a tinted active segment, never a solid-fill rectangle:

- Outer container: fully rounded (`borderRadius: 999`), `backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92)`, `borderWidth: 1`, `borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4)`.
- Active segment: fully rounded (`borderRadius: 999`), `backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)` — a translucent tint, not an opaque fill.
- Active text/icon: `Colors.$textDefault`. Inactive text/icon: `Colors.$textNeutral`.
- Reference implementation: `TabsList`/`TabsTrigger` in `components/ui/tabs/index.tsx` (used by the Vault/Wishlist/Selling collection tabs). The native time-range `SegmentedControl` (`components/graphs/hooks/useDateRange.tsx`) follows the same outline+tint convention via `react-native-ui-lib`'s component. Custom-built toggles (Chart/Sales tabs in `DetailCardView/index.tsx` / `WebCardDetailPage.tsx`, the web period selector in `PriceGraph.web.tsx`) must match this by hand since they don't use the shared `Tabs` primitive.

### Spring animation presets

All Reanimated `withSpring` calls must draw from one of these established presets rather than using ad-hoc values. The presets are derived from live usage in the codebase — do not invent new damping/stiffness pairs without a clear reason.

| Preset          | `damping` | `stiffness` | `mass` | When to use                                                                                                                |
| --------------- | --------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| **tab-slide**   | 24        | 300         | 0.6    | Sliding indicator inside a pill toggle or tab bar (e.g. Chart/Sales,`TabRow`). Reference: `components/tabs/TabRow.tsx:42`. |
| **panel-entry** | 20        | 260         | 0.9    | Cards, sheets, or panels animating into position. Reference:`features/splash/index.tsx`.                                   |
| **press-in**    | 14        | 220         | —      | Scale-down on button `onPressIn`.                                                                                          |
| **press-out**   | 12        | 200         | —      | Scale-back-to-1 on button `onPressOut` / `onPressIn` release. Reference: back button in `DetailCardView/index.tsx`.        |
| **snap**        | 100       | 300         | —      | Snap-to-grid or drag-release with no visible bounce. Reference:`components/DraggableFooter.tsx`.                           |

Use the `tab-slide` preset for any animated indicator that slides between fixed positions (segmented controls, underline indicators). Use `panel-entry` for anything that flies in from off-screen or reveals. Press-in/out are always paired. `snap` is for gesture-driven snapping only.

### Accent borders vs. visibility borders

Cards/chips that carry a colored left accent border (e.g. grade chips in `Prices.tsx`, the KPI card in `PriceSummaryBar.tsx`) also need a subtle full border for contrast against the dark background. Add `borderWidth: 1, borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4)` alongside the existing `borderLeftWidth`/`borderLeftColor` in the same style object — React Native applies per-edge border props independently, so the colored left accent stays visually distinct and isn't overridden by the general border.

## Web platform

The web build shares the same Expo Router tree as native. Key conventions:

- **`.web.tsx` overrides** — Metro resolves `foo.web.tsx` over `foo.tsx` on web. Use for platform-specific implementations.
- **Stubs** — `lib/stubs/react-native-skia.js` and `lib/stubs/react-native-worklets.js` are no-op stubs injected by the Metro resolver for web (Skia requires a WASM runtime unavailable on web; worklets requires a native TurboModule).
- **Dark mode** — `tailwind.config.js` uses `darkMode: 'class'`. `ThemeProvider` toggles the `dark` class on `<html>` directly; NativeWind reads it.
- **Web features** — `features/web/` contains web-only components: `WebNav`, `LandingPage`, `BrowserStorefront`, `WebCartPage`, `WebOffersPage`, `WebTransactionsPage`, `StorefrontCatalog`, `SellerSidebar`, etc.

## Features map

| Directory                 | Responsibility                   |
| ------------------------- | -------------------------------- |
| `features/splash`         | Login / sign-up gate             |
| `features/home`           | Home tab                         |
| `features/collection`     | User's card collection           |
| `features/marketplace`    | Browse/search listings           |
| `features/offers`         | Buying and selling offers        |
| `features/cart`           | Cart and checkout                |
| `features/transactions`   | Transaction history              |
| `features/profile`        | Profile view and edit            |
| `features/settings`       | App settings, theme, preferences |
| `features/onboarding`     | First-run onboarding wizard      |
| `features/users`          | Public user/storefront pages     |
| `features/tcg-card-views` | Card detail views                |
| `features/mainSearchbar`  | Global search bar                |
| `features/navigation`     | Navigation helpers               |
| `features/notifications`  | Notifications tab                |
| `features/web`            | Web-only layout components       |
