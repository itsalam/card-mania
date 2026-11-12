# Card Mania

Trading-card collection and marketplace app — native (iOS/Android) and web from one Expo Router tree, backed by Supabase.

| Where                | Link                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Code                 | [github.com/itsalam/card-mania](https://github.com/itsalam/card-mania)                            |
| Issues               | Linear, team `ITS` (`linear issue view ITS-123`)                                                  |
| Client communication | [ShabowBX Basecamp](https://app.basecamp.com/6309308/projects/49386814)                           |
| Staging Supabase     | [Dashboard](https://supabase.com/dashboard/project/zijgqgpwmqrgnzcictcb) (`zijgqgpwmqrgnzcictcb`) |

Architecture, conventions and the design system are documented in [`CLAUDE.md`](CLAUDE.md) — read it before contributing.

---

## Operations & reminders

### Weekly

- [ ] **Monday** — the weekly status draft lands at 8:30 (macOS notification). Review it, fill the `_TODO_` sections, and post: `npm run status:edit` → `npm run status:send`. See [Weekly status post](#weekly-status-post).
- [ ] **Monday** — glance at `npm run hours` for last week. Log anything the tracker can't see (device testing, calls, offline work) with `npm run hours -- add …`.
- [ ] **End of week** — make sure feature branches are merged into `staging` or have an open PR; the status draft only counts PRs merged into `staging`.

### Recurring

- [ ] **Biweekly** — client call with Tony + Pelle (ITS-67). Agenda and recap go in Basecamp.
- [ ] **When invoicing** — `npm run hours -- report --since <last invoice date> --daily` for the period, then record the payment once received: `npm run hours -- paid <date> <amount> "e-transfer"`.
- [ ] **Monthly** — check scope usage at the bottom of `npm run hours`. Once past the initial scope, new commercial terms need defining (ITS-65).
- [ ] **After each merge into `staging`** — check the _Deploy staging_ Action run summary; it commits regenerated DB types back to `staging`, so `git pull` before the next branch.
- [ ] **Promote** `staging` → `main` once a batch is verified on staging.

### Keep in mind

- **Ops items are internal.** ITS-63 and its sub-issues (invoicing, hours, cadence) never go into client-facing posts or channels.
- **Staging is not production.** It's the only hosted Supabase project, used to test live vendor APIs. There is no production project yet.
- **Running the app without `.env.local` hits staging**, and the app signs in anonymously on load — that creates real rows there.
- **Known security gaps:** `image-proxy` has no rate limiting or JWT check yet; `e2e/` Maestro flows contain a hardcoded test login that should move to env vars.

---

## Getting started

```sh
npm install
supabase start              # local API :54321, DB :54322, Studio :54323
npm run db:reset            # apply migrations + supabase/seed.sql
```

Create `.env.local` (gitignored) so the app talks to the local stack instead of staging:

```sh
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<publishable key from `supabase status`>
SENTRY_DISABLE_AUTO_UPLOAD=true   # required for local iOS builds
```

Then `npm run ios`, `npm run android`, or `npm run web`.

## Environments

| Environment | Supabase                        | App config                                                                            | Deploys                        |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| Local       | `supabase start` on `127.0.0.1` | `.env.local`                                                                          | —                              |
| Staging     | `zijgqgpwmqrgnzcictcb` (hosted) | `.env.preview` / `.env.beta` / `.env.production`, and the fallback in `app.config.js` | Automatic on push to `staging` |

Branch flow: `feature branch` → PR into **`staging`** (auto-deploys) → promote `staging` → `main`.

---

## Useful commands

### App

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm start`                       | Expo dev server (uses `.env.local` if present)                   |
| `npm run start:staging`           | Dev server against staging (`.env.preview`)                      |
| `npm run ios` / `android` / `web` | Start on a platform                                              |
| `npx expo run:ios`                | Local native iOS build (see [iOS local build](#ios-local-build)) |
| `npm run storybook:web`           | Web Storybook on :6006                                           |
| `npm run lint` · `npm run format` | Lint · Prettier                                                  |
| `npm test`                        | Jest                                                             |

### Database & edge functions

| Command                                                             | What it does                                       |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| `npm run db:new <name>`                                             | New empty migration                                |
| `npm run db:diff <name>`                                            | Migration from local schema changes                |
| `npm run db:reset`                                                  | Rebuild local DB from migrations + seed            |
| `supabase test db`                                                  | pgTAP tests (`supabase/tests/`)                    |
| `deno test --no-lock $(find supabase/functions -name '*.test.ts')`  | Edge function tests                                |
| `supabase functions serve --env-file supabase/functions/.env.local` | Run functions locally with vendor keys             |
| `npm run db:types`                                                  | Regenerate DB types from staging (app + functions) |

### Deploy

| Command                                               | What it does                                 |
| ----------------------------------------------------- | -------------------------------------------- |
| `npm run deploy:staging -- --dry-run`                 | Preflight + plan, changes nothing            |
| `npm run deploy:staging`                              | Migrations → changed functions → types → tag |
| `npm run deploy:staging -- --functions a,b --skip-db` | Deploy specific functions only               |
| `eas build --profile preview --platform ios`          | Store-distribution build against staging     |

Never deploy functions with `--prune` — staging has functions with no local source.

### Ops (internal)

| Command                                          | What it does                                           |
| ------------------------------------------------ | ------------------------------------------------------ |
| `npm run ops:install`                            | One-time: config, Claude Code hook, Monday launchd job |
| `npm run hours`                                  | Weekly hours report + scope/payments summary           |
| `npm run hours -- report --since <date> --daily` | Daily breakdown for an invoice period                  |
| `npm run hours -- start "<note>"` / `stop`       | Manual timer                                           |
| `npm run hours -- add today 1.5 "<note>"`        | Add untracked time to a day                            |
| `npm run hours -- set <date> 4 "<note>"`         | Replace a day's tracked time                           |
| `npm run hours -- paid <date> <amount>`          | Record a payment                                       |
| `npm run status:draft [-- --ai --force]`         | Build the weekly status draft                          |
| `npm run status:edit` · `status:send`            | Edit, then preview + post to Basecamp                  |

Details: [`scripts/ops/README.md`](scripts/ops/README.md).

---

## Playbooks

### Ship a feature

1. Read the Linear issue (`linear issue view ITS-123`) for requirements and decisions.
2. Branch off `staging`: `git checkout staging && git pull && git checkout -b <you>/its-123-short-name`.
3. For UI work, cite Mobbin/Refero references in the PR (see `CLAUDE.md`).
4. Open a PR into **`staging`** titled `ITS-123: …` — the ID in the title is how the weekly status links PRs to issues.
5. Merge → the _Deploy staging_ Action tests, deploys, and commits regenerated types. Pull `staging` afterwards.

### Add a database change

1. `npm run db:new <name>` and write the SQL (or change locally and `npm run db:diff <name>`).
2. `npm run db:reset` — proves the migration applies from scratch, as CI does.
3. Add/extend pgTAP coverage in `supabase/tests/` and run `supabase test db`.
4. Merge into `staging` — migrations are pushed before functions, so keep them additive.

### Add or change an edge function

1. Code in `supabase/functions/<name>/`, shared helpers in `_shared/`. Changing `_shared/` or the import map redeploys every function.
2. Put vendor keys in `supabase/functions/.env.local` (gitignored — not `.env`) and run `supabase functions serve --env-file supabase/functions/.env.local`.
3. Cron-only functions must check `isServiceRequest` (`_shared/service-auth.ts`).
4. New secrets: `supabase secrets set NAME=value --project-ref zijgqgpwmqrgnzcictcb` **before** merging.

### Manual staging deploy

1. `npm run deploy:staging -- --dry-run` and read the plan.
2. `npm run deploy:staging` (prompts for confirmation; DB password from `SUPABASE_DB_PASSWORD` or prompted).
3. Commit the regenerated `lib/store/supabase.d.ts` and `supabase/functions/_shared/supabase.ts` if they changed.

### Debug a pg_cron job

- Jobs read `project_url` and `edge_token` from the **Postgres Vault**, not function secrets — update them with `vault.update_secret` or Dashboard → Integrations → Vault. `edge_token` is the `sb_secret_…` key.
- `cron.job_run_details` says `succeeded` even when the HTTP call 401s. Check `net._http_response` or the function's own ledger table instead.
- List jobs: `select jobname, schedule, active from cron.job order by jobname;`

### iOS local build

Requires Xcode 26+ (Swift 6.2) on macOS 26+. After installing or upgrading Xcode:

```sh
sudo xcodebuild -runFirstLaunch
xcodebuild -downloadPlatform iOS
```

Keep `SENTRY_DISABLE_AUTO_UPLOAD=true` in `.env.local`, then `npx expo run:ios`. `expo` is pinned to an exact version on purpose — don't add a caret.

### Weekly status post

1. Monday 8:30, launchd runs `status:draft --ai --notify`: merged PRs into `staging`, Linear issues completed/in progress (ITS-63 excluded), and hours for last Mon–Sun, rewritten for the client.
2. `npm run status:edit` — fill in `_TODO_`, cut anything internal or too technical.
3. `npm run status:send` — preview, confirm `y`, posts to the ShabowBX message board as a Heartbeat.
4. Missed Monday? The draft still runs on wake; or run `npm run status:draft -- --ai` by hand. For an older week: `--week-of <date>`.
5. If a send reports failure, check Basecamp before retrying — it may have posted. Logs: `~/.card-mania-ops/logs/weekly-status.log`.

### Invoice the client

1. `npm run hours -- report --since <last invoice date> --daily` — sanity-check each day; fix gaps with `add`/`set`.
2. Send the invoice for that period.
3. When the e-transfer arrives: `npm run hours -- paid <date> <amount> "invoice #N"`.

### New machine

1. Clone, `npm install`, install the Supabase CLI, Deno, `gh`, the Linear CLI (`linear auth login`), and EAS CLI.
2. Create `.env.local` (above) and `supabase/functions/.env.local` with vendor keys.
3. Copy `~/.card-mania-ops/` from the old machine (hours log, payments, drafts), then `npm run ops:install`.
4. Connect the Basecamp MCP in Claude Code for this repo (`status:send` posts through it).

---

## Repo map

| Path                   | What's there                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `app/`                 | Expo Router routes (native tabs, web-only routes, storefronts)    |
| `features/`            | Feature modules — see the features map in `CLAUDE.md`             |
| `components/`, `lib/`  | Shared UI, stores (Zustand), Supabase types, stubs for web        |
| `client/`              | TanStack Query hooks per domain                                   |
| `supabase/migrations/` | SQL migrations (incl. pg_cron schedules)                          |
| `supabase/functions/`  | Deno edge functions; `_shared/` helpers                           |
| `supabase/tests/`      | pgTAP tests                                                       |
| `scripts/`             | Deploy script, data cloning utilities, `ops/` tooling             |
| `e2e/`                 | Maestro flows                                                     |
| `.github/workflows/`   | CI (lint + web export on PRs), staging deploy, Claude review bots |
