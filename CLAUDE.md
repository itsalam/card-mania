# Card Mania — Agent Context

## Repo

github.com/itsalam/card-mania

## Active work

- Branch: `vincentthanhlam/its-70-sign-up-flow`
- PR #11 — feat: Sign Up Flow (draft, linked to Linear ITS-70)
- Milestone: v0.1 — Demo Ready

## Stack

Expo (React Native), Supabase Auth, Zustand, TanStack Query, NativeWind

## Auth architecture

- `lib/store/useUserStore.ts` — Zustand store; holds session/user/profile
- `app/_providers.tsx` — subscribes to `onAuthStateChange`, drives store
- `features/splash/index.tsx` — exports `AuthGate` (gates app) + `SplashPage` (login/signup toggle)
- `features/splash/SignUpForm.tsx` — sign-up form component (new, this branch)
- `user_profile` table PK is `user_id` (not `id`)

## Routing

- Expo Router file-based; tabs live under `app/(tabs)/`
- Settings: `app/(tabs)/profile/settings.tsx` → `features/settings/pages/index.tsx`
- Home: `app/(tabs)/index.tsx` → `features/home/index.tsx`

## What was built this session (ITS-70)

1. `useUserStore` — added `signIn`, `signUp`; fixed `loadProfile` PK bug; fixed realtime sub
2. `features/splash/SignUpForm.tsx` — new sign-up form
3. `features/splash/index.tsx` — wired login form, toggle to sign-up
4. `supabase/migrations/20260429000000_provision_user_profile_on_signup.sql` — DB trigger
5. `features/home/index.tsx` — resolved TODO: BUILD USER, wired settings icon
6. `features/settings/components/profile-header.tsx` — real profile data + sign-out button

7. `useUserStore` — added `signIn`, `signUp`; fixed `loadProfile` PK bug; fixed realtime sub
8. `features/splash/SignUpForm.tsx` — new sign-up form
9. `features/splash/index.tsx` — wired login form, toggle to sign-up
10. `supabase/migrations/20260429000000_provision_user_profile_on_signup.sql` — DB trigger
11. `features/home/index.tsx` — resolved TODO: BUILD USER, wired settings icon
12. `features/settings/components/profile-header.tsx` — real profile data + sign-out button
