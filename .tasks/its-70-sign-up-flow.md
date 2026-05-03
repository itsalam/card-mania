# ITS-70 — Sign Up Flow

## Implementation summary

### Files changed

| File                                                                      | Change                                                                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/store/useUserStore.ts`                                               | Added `signIn` + `signUp` actions; fixed `loadProfile` PK bug (`.eq('id')` → `.eq('user_id')`); fixed realtime subscription table + filter column |
| `features/splash/index.tsx`                                               | Wired up email/password login form; toggle between login and sign-up views                                                                        |
| `features/splash/SignUpForm.tsx`                                          | New component: email, display name, password, confirm password; friendly error messages; email-confirmation holding state                         |
| `supabase/migrations/20260429000000_provision_user_profile_on_signup.sql` | DB trigger: auto-provisions `user_profile` row on every `auth.users` INSERT                                                                       |

### Flow

1. User taps **Sign up** on the splash screen → `SplashPage` switches to `SignUpForm`
2. User fills in email, (optional) display name, password × 2 → taps **Create account**
3. Client validates: non-empty email, ≥ 6 char password, passwords match
4. `signUp()` calls `supabase.auth.signUp()` — errors thrown for duplicate email / weak password
5. On success, `upsert` into `user_profile` (client-side; DB trigger fires independently)
6. If email confirmation is **disabled** (demo mode): session is live → `setAuth()` → `AuthGate` renders the app
7. If email confirmation is **required**: success screen shown → user clicks email link → session resumes via `onAuthStateChange`

### Bugs fixed

- `loadProfile` was querying `.eq('id', userId)` — `user_profile` PK is `user_id`, so the profile never loaded
- Realtime subscription pointed at wrong table (`profiles` instead of `user_profile`) and wrong filter column

## Acceptance criteria checklist

- [ ] A brand-new user can sign up and reach the home screen without manual intervention
- [ ] Duplicate email shows a clear error message, not a crash
- [ ] `user_profile` row exists in DB after sign up
- [ ] Works on iOS simulator and Expo web
