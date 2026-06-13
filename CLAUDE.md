# Card Mania — Agent Context

## Working on tasks

When starting work on any task, look up the corresponding Linear issue (e.g. ITS-83) for requirements, acceptance criteria, and design decisions before writing code. Use the `linear-cli` skill to fetch issue details.

## Repo

github.com/itsalam/card-mania

## Active work

- Branch: `vincentthanhlam/its-83-web-card-page-and-search`
- Milestone: v0.1 — Demo Ready

## Stack

| Layer         | Library                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| App framework | Expo 55, Expo Router 55, React Native 0.83                               |
| Styling       | NativeWind 4, Tailwind CSS (`darkMode: 'class'`)                         |
| UI components | `react-native-ui-lib`, `@gluestack-ui`                                   |
| Animations    | React Native Reanimated 4, `@shopify/react-native-skia` (stubbed on web) |
| State         | Zustand 5                                                                |
| Server state  | TanStack Query 5                                                         |
| Backend       | Supabase (Auth, Postgres, Realtime)                                      |
| Monitoring    | Sentry (`@sentry/react-native`)                                          |

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
