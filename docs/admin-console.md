# Admin console

Internal console for content (promo boxes, home feed sections), tuning (`search_config`) and dashboards. Epic: ITS-114. Decisions and the build-vs-buy comparison: [scope doc](https://claude.ai/artifact/Ki3LGZiNejHL1g6oZimiA2).

- **UI:** Retool Cloud, Free plan (up to 5 users).
- **Backend:** the `admin` Postgres schema. All logic is in `admin.*` RPCs. Retool only calls them.
- **Identity:** each admin signs in with their own Supabase account. Every RPC checks `auth.uid()` against `admin.members`.

```
Retool ──Bearer <admin's access token>──▶ /rest/v1/rpc/<fn>   (header Content-Profile: admin)
       ──▶ admin.<fn>()   checks role ─▶ does the work ─▶ writes admin.audit_log
```

## Why per-user tokens

On Retool's Free and Team plans, every user can edit every query, so Retool can't be trusted to say who is acting. With each admin's own Supabase token, the database checks identity itself.

Retool therefore stores **no Postgres credential and no service key**, only the project URL and the anon key.

## Roles

| Role     | Can                                                                                       |
| -------- | ----------------------------------------------------------------------------------------- |
| `owner`  | Everything, including managing members                                                    |
| `editor` | Content: promo boxes and their results, home feed sections (ITS-191/193/194/110)          |
| `ops`    | Dashboards (promo results, ITS-194/117), ops actions, audit log, `search_config` (ITS-57) |

Each person has one role, stored in `admin.members`. Every write RPC adds a row to `admin.audit_log`, which is append-only.

## RPCs (ITS-116)

| Function                                        | Role               | Purpose                                                                |
| ----------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `has_role(variadic roles)`                      | any signed-in user | `true`/`false`; never raises. Use it to decide what to show.           |
| `whoami()`                                      | any member         | `{user_id, email, role, member_since}`. Non-members get `42501`.       |
| `list_members()`                                | owner              | Members with emails and who granted them                               |
| `set_member_role(email, role)`                  | owner              | Add a member or change their role. They need a Supabase account first. |
| `remove_member(user_id)`                        | owner              | Remove a member. The last owner can't be removed or demoted.           |
| `list_audit_log(limit, before_id, target_type)` | ops                | Newest first, max 500 per page                                         |

Errors: `42501` = not authorized, `22023` = bad input, `P0002` = not found, `40001` = someone else saved first (reload and retry).

## Promo boxes (ITS-191)

Admin-authored cards on the home feed, built from a template. Templates in the first release are `product_release` and `announcement`. Player spotlights wait for a players catalog.

**Which cards a promo covers** uses the ITS-97 feed vocabulary (`filter` + `order_by`), plus `pinned_ref_ids`, which are always included and shown first, and `excluded_ref_ids`. A published promo with card criteria gets a hidden `marketplace_section_meta` row, `promo_<id>` with `kind='custom'` and `show_in_marketplace=false`. The existing `marketplace-feed-refresh` job fills it within 5 minutes, and that cached feed is both the rail and "See all".

**Status** is what the editor chose: `draft`, `published` or `archived`. The **phase** shown in lists is worked out from the schedule: `scheduled` before `starts_at`, `live`, and `ended` after `ends_at`.

**Mode** is what the app renders:

| Mode           | When                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `announcement` | The promo covers no cards (an announcement without card criteria)                              |
| `coming_soon`  | `release_date` is still in the future, or fewer than `min_cards` (default 4) matching listings |
| `cards`        | Otherwise. `items` holds the section's listings.                                               |

| Function                                                           | Role                | Purpose                                                                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `upsert_promo(payload)`                                            | editor              | Create (no `id`) or update (`id`). Send `revision` from the loaded promo to catch conflicting saves. A product release needs a set (`filter.sets`) and a `release_date`. Every save stores a revision. |
| `preview_promo_matches(filter, order_by, pinned, excluded, limit)` | editor              | `{count, count_capped, sample}`: the listings the criteria match right now, in rail order                                                                                                              |
| `set_promo_status(id, status)`                                     | editor              | `draft` (unpublish), `published` (scheduled if `starts_at` is in the future), `archived`                                                                                                               |
| `list_promos(include_archived)`                                    | editor              | One row per promo, with phase                                                                                                                                                                          |
| `get_promo(id)`                                                    | editor              | Full promo plus its revision history                                                                                                                                                                   |
| `restore_promo_revision(revision_id)`                              | editor              | Saves an old revision's content as a new revision. Status is unchanged.                                                                                                                                |
| `issue_preview_token(promo_id, ttl_minutes)`                       | editor              | `{token, expires_at}` for the app's draft preview (default 24 h, max 7 days). Only a hash is stored.                                                                                                   |
| `public.get_active_promos(placement)`                              | anyone              | Live promos for `home_hero` / `home_rail` (or all), with `mode` and `items`                                                                                                                            |
| `public.get_promo_preview(token)`                                  | anyone with a token | The same shape for any status, with cards computed live                                                                                                                                                |
| `search_card_sets(query, limit)`                                   | editor              | Set picker: distinct `cards.set_name` with card count and latest year                                                                                                                                  |
| `search_cards(query, set_name, limit)`                             | editor              | Find a card to pin (2+ characters)                                                                                                                                                                     |
| `lookup_cards(ref_ids)`                                            | editor              | Names and thumbnails for pinned or excluded cards, in the order given                                                                                                                                  |

Field rules:

- `accent` is a palette key: violet, purple, blue, cyan, green, yellow, orange, red or grey, never hex.
- `badge` is `new`, `coming_soon` or `hot`.
- `cta` is `{label, kind, target}`, where `kind` is `see_all` (no target), `route` (an app path starting with `/`) or `url` (`https://` only).
- `hero_image_path` is an object path in the public **`promo-assets`** Storage bucket. Editors can upload with their own session; nobody else can write to the bucket.

**Images:**

- Card thumbnails come from the card's front `card_images` row, then `image_cache.storage_path` in the public `images` bucket, falling back to `source_url` while the image is still being fetched.
- Hero art goes through the **`promo-asset-upload`** edge function as JSON: `{content_type, data_base64, promo_id}`, using the editor's own token. Retool can't reliably send binary bodies.
  - The function checks the type, the magic bytes and the 5 MB limit.
  - It uploads with the caller's session, never the service key, so the bucket's editor-only policies decide who can write.
  - It returns `{path, public_url}`.

**The Retool editor (ITS-193)** is in `retool/apps/admin-console`: the Promo boxes tab, `pages/Promos.tsx` and `pages/PromoEditor.tsx`. Its phone frame is a mock-up until the app's `/preview/promo/[id]` route ships (ITS-192). After that, set `APP_PREVIEW_BASE_URL` in `frontend/config.ts` to show the real app in the frame.

### In the app (ITS-192)

- **Home:** the `promos` row in `home_feed_section_meta` places the boxes in the Home feed; it's above the other sections (`sort_order` −10) and shows up to `result_limit` (5) boxes, hero placements first. Disable the row to hide every promo without unpublishing.
- **Component:** `features/promos/ProductBox.tsx`, with a hero and a rail variant and the three modes. The accent maps to the `$accent<Hue>` theme tokens in `components/ui/theme`, so dark mode works.
- **"See all"** opens `/promo/[id]`, a grid of every card in the promo's feed (up to 50).
- **Preview:** `/preview/promo/[id]?token=…` renders any promo, draft included, when the token from `admin.issue_preview_token` is valid. `vercel.json` lets only Retool frame `/preview/*` (`frame-ancestors`); every other path stays `SAMEORIGIN`.
- **Tracking:** `public.record_promo_event(promo_id, 'impression' | 'tap', session_id, placement)`. Each is counted once per promo per app session (a random id per launch); drafts and ended promos are never counted. Events go to `admin.promo_events`, and an hourly cron job (`promo-events-rollup`) writes `admin.promo_event_daily` (sessions and signed-in users per promo, kind and UTC day) and deletes raw events after 90 days.
- **Notify me** (coming-soon boxes): `public.set_promo_interest(promo_id, on)` and `public.get_my_promo_interests()` store interest in `admin.promo_interest`, one row per user. Sending the release push is a later ticket (ITS-60/61/62); `notified_at` is there so it's sent once.

### Promo results (ITS-194)

The **Promo results** tab (`pages/PromoResults.tsx`) is for editors, ops and owners. It has a date range (7, 30 or 90 days, or custom), a KPI row, a daily impressions/taps chart for the selected promo and a sortable table per promo. Days are UTC.

| RPC                                       | Role         | Does                                                                                       |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `promo_results(from, to)`                 | editor / ops | One row per promo: impressions, taps, tap rate, signed-in viewers/tappers, and conversions |
| `promo_results_daily(promo_id, from, to)` | editor / ops | Impressions and taps per day, zero-filled                                                  |

Both default to the last 30 days and allow up to a year.

- **Impressions and taps** are app sessions, read from the hourly rollup `admin.promo_event_daily`. Today can be up to an hour behind.
- **Viewers, tappers and conversions** need user ids, so they read the raw `admin.promo_events`, which are kept 90 days. Anonymous sessions count as impressions and taps but can't convert.
- **A conversion** is something a signed-in user did within 7 days of their first tap in the range, on a card the promo covers (its section's current listings plus its pinned cards): a wishlist add, a card or listing view, or an offer. A user counts once in `converted_users` however many they did.
- **Limits:** "covered" is the promo's section as it is now, not as it was when the user tapped. Views are a lower bound, since `recent_views` keeps only each user's latest view of an item.

## Home sections (ITS-110)

The **Home sections** tab (`pages/HomeSections.tsx`) edits `public.home_feed_section_meta`, the sections of the app's Home feed: their order, title, icon, on/off state, item count and rail layout. Editors and owners can use it. The app reads the table through `get_home_feed_sections()` with a one-minute cache, so changes show up on the next Home refresh.

| RPC                               | Role   | Does                                                                                                                                                                 |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_home_sections()`            | editor | Every section, on or off, in display order                                                                                                                           |
| `update_home_section(key, patch)` | editor | Any of `title`, `icon`, `enabled`, `result_limit`, `layout` (replaced whole). Send `expected_updated_at` from the loaded row to refuse a conflicting save (`40001`). |
| `reorder_home_sections(keys)`     | editor | New display order; `keys` must name every section once                                                                                                               |

- **Sections can't be added or removed here.** Each key maps to a reviewed query in the app (`features/home/FeedPage.tsx`), so a new section needs an app release.
- **Icons** are limited to the names the app can draw (`features/home/sectionIcons.ts`). Add a new icon to both that file and `admin._home_section_icons()`.
- **Layout** keys: `itemWidth`, `collapsedWidth` (40–400), `expandedHeight` (60–800), `expandable` (boolean). Leave one out to use the app's default. `collapsedHeight` is legacy: the app ignores it, but it's still accepted so older rows save.
- Every edit and reorder writes an `audit_log` row (`home_section.update` / `home_section.reorder`) with the before and after.

## Ops dashboards (ITS-117)

For the `ops` role (and owners): scheduled jobs, pipelines (price refresh, enrichment, notifications) and client errors. Vendor usage waits for ITS-113's CardHedger call log.

### Scheduled jobs

The **Scheduled jobs** tab lists every `cron.job`. Each one is flagged failing, healthy or paused. Click a job for its recent runs and edge-function responses; **Pause** / **Resume** call `cron.alter_job` and are audited (`cron_job.pause` / `cron_job.resume`).

| RPC                                | Role | Does                                                                                                     |
| ---------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `list_cron_jobs()`                 | ops  | Schedule, on/off, last run, runs and failures in 24 h, and for edge-function jobs the latest HTTP status |
| `cron_job_history(jobname, limit)` | ops  | `{runs, requests}`: recent `cron.job_run_details` rows and tracked edge-function responses               |
| `set_cron_job_active(jobname, on)` | ops  | Pause or resume                                                                                          |

**Why HTTP status matters:** `cron.job_run_details` says `succeeded` as soon as `net.http_post()` queues the request, even if the edge function then answers 401 (for example a wrong Vault `edge_token`). A job that calls an edge function is only healthy if its latest answered request was a 2xx, so that failure shows up within one run.

**How it's tracked:** pg_net deletes the queued request (and its URL) once it's sent, so nothing links a response back to its job. A trigger on `net.http_request_queue` (`admin_track_http_request`) records each edge-function request's id and function name in `admin.cron_http_requests` (pruned after a day by `cron-http-requests-prune`). A job is matched to its function by the `/functions/v1/<name>` in its command. Responses come from `net._http_response`, which pg_net keeps about 6 hours, so HTTP counts cover that window. Other database code calling the same function would also count toward that job.

If the migration can't create the trigger (it needs `TRIGGER` on the extension's table), it skips it with a notice. The page then says responses aren't tracked, and only cron's own status is shown.

### Pipelines

The **Pipelines** tab has one view each for the price refresh, the image enrichment backfill and notifications. The price refresh and enrichment views wrap the existing monitoring views (`price_refresh_backlog`, `price_refresh_outcomes`, `enrichment_backlog`, `enrichment_vendor_outcomes`), so their numbers match what those views report.

| RPC                                 | Role | Does                                                                                                                                                                   |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `price_refresh_overview()`          | ops  | `{backlog, outcomes, runs, low_confidence}`: the backlog, outcome mix (7 d), the last 20 runs, and the 25 weakest fuzzy matches                                        |
| `queue_card_price_refresh(card_id)` | ops  | Makes one tracked card due on the next run. Audited (`card.queue_price_refresh`).                                                                                      |
| `enrichment_overview()`             | ops  | `{backlog, vendor_outcomes, runs, low_score_hits}`: the 25 lowest-scoring image hits are the likeliest wrong pictures                                                  |
| `notification_overview(hours)`      | ops  | Volume by type and category with read/dismissed counts, wishlist hits split into individual and summary, and the size of the `wishlist_hit_notifications` dedupe table |

**Queueing a refresh** sets the card's `price_refresh_attempted_at` to `-infinity`, so the next `tracked-price-refresh` run (:07 and :37) can claim it. It doesn't jump the queue: runs still take wishlisted cards first, then the least recently refreshed, so with a large backlog it can take a few runs. Only cards in someone's collection are refreshed at all; the RPC refuses others. `prices_refreshed_at` is left alone because other code reads it as "server prices are authoritative".

### Client errors

The **Client errors** tab groups `public.client_errors` by `context` over 24 hours, 7 days or 30 days, with error and user counts. Click a group for its latest 100 errors, and an error for its metadata and the user's email.

| RPC                                         | Role | Does                                                                |
| ------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `client_error_groups(hours)`                | ops  | One row per context: errors, users, first/last seen, latest message |
| `list_client_errors(context, hours, limit)` | ops  | The errors themselves, newest first, with the user's email          |

## Setup

### 1. Expose the `admin` schema to the API

- **Local:** already in `supabase/config.toml` (`[api].schemas`).
- **Staging:** Dashboard → Project Settings → Data API → _Exposed schemas_ → add `admin`. `supabase db push` and the staging deploy workflow do **not** change this setting, so do it once by hand after the ITS-116 migration lands.

Check that it worked. Without a token this should return `42501`, not `PGRST106` ("schema must be one of…"):

```sh
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/whoami" \
  -H "apikey: $ANON_KEY" -H "Content-Profile: admin" -H "Content-Type: application/json" -d '{}'
```

### 2. Seed the first owner (once per environment)

The person needs a Supabase Auth account first. They don't need to use the app:

- **Dashboard** → Authentication → Users → **Add user**. Either _Create new user_ (email + password, tick **Auto Confirm User**) or _Send invitation_ (they set their own password; use this for anyone other than yourself).
- **Auth admin API**, from your terminal only (it needs the secret key): `POST /auth/v1/admin/users` with `{"email", "password", "email_confirm": true}`, or `POST /auth/v1/invite` with `{"email"}`.
- Don't insert into `auth.users` with SQL. That skips password hashing and the linked identity record, so the account can't sign in.

Any new account also gets a `user_profile` row from the signup trigger (`20260429000000_provision_user_profile_on_signup.sql`), so it could sign in to the app as an ordinary user. That's harmless. `cleanup-anon-users` only removes anonymous accounts.

Then, in the SQL editor (or `psql` as `postgres`), paste the **whole** query with the email in single quotes:

```sql
insert into admin.members (user_id, role)
select id, 'owner' from auth.users where email = '<owner email>'
on conflict (user_id) do update set role = 'owner';
```

Check it worked:

```sql
select m.role, u.email from admin.members m join auth.users u on u.id = m.user_id;
```

`INSERT 0 0` means no account with that email exists in this environment yet.

After that, manage members through `set_member_role` / `remove_member`, so changes are audited.

### 3. Retool workspace

Sign up at retool.com on the Free plan. The console lives at `https://<subdomain>.retool.com`.

Retool offers two ways to build an app. The **classic** drag-and-drop editor (_Classic app_) needs no prompts and is the most predictable for forms and tables. The newer **AI builder** generates a React app from a chat prompt (3b). Both use the same data connection and the same requests.

#### 3a. Data connection (once)

**Resources → Create new → REST API**:

| Field          | Value                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name           | `card-mania-staging`                                                                                                                                |
| Base URL       | `https://zijgqgpwmqrgnzcictcb.supabase.co` (staging)                                                                                                |
| Headers        | `apikey`: the **publishable/anon** key (`EXPO_PUBLIC_SUPABASE_KEY` in `.env.preview`, or Dashboard → API Keys). `Content-Type`: `application/json`. |
| Authentication | None                                                                                                                                                |

**Never put the secret/service key in Retool.** The signed-in admin's token is added per query.

Every call to an `admin` function needs two extra headers:

```
Authorization: Bearer {{ session.value.access_token }}
Content-Profile: admin
```

Without `Content-Profile`, PostgREST looks in `public`. You then get "Could not find the function public.whoami".

#### 3b. Option A: classic app

Create an app called **Admin Console**.

**Sign-in**

1. Add a variable `session`, with no default value.
2. Add a Form with a text input `email`, a password input `password`, and a **Sign in** button.
3. Add a query `signIn` on `card-mania-staging`:
   - `POST auth/v1/token?grant_type=password`
   - body `{ "email": {{ email.value }}, "password": {{ password.value }} }`
   - no `Authorization` header
   - on success: set `session` to `{{ signIn.data }}`, then trigger `whoami`
   - wire the button's click to `signIn`

**Identity check**

4. Add a query `whoami`: `POST rest/v1/rpc/whoami`, with the two headers above and body `{}`.
5. Add a text label: `{{ whoami.data.email }} · {{ whoami.data.role }}`.
6. Add a "Not authorized" container, hidden when `{{ !whoami.error }}`. Hide the main content when `{{ !whoami.data }}`.

**Token refresh** (access tokens expire after about 1 hour)

7. Add a query `refresh`:
   - `POST auth/v1/token?grant_type=refresh_token`
   - body `{ "refresh_token": {{ session.value.refresh_token }} }`
   - on success: set `session` to `{{ refresh.data }}`
   - under Advanced, run periodically every `3000000` ms (50 minutes)

**Members page** (owner)

8. Add a query `listMembers`: `POST rest/v1/rpc/list_members`, body `{}`. Bind a Table to `{{ listMembers.data }}`.
9. Add a query `setMemberRole`: `POST rest/v1/rpc/set_member_role`, body `{ "p_email": {{ newEmail.value }}, "p_role": {{ newRole.value }} }`.
   - inputs: a text input `newEmail` and a Select `newRole` with options `owner` / `editor` / `ops`
   - on success: trigger `listMembers`
10. Add a query `removeMember`: `POST rest/v1/rpc/remove_member`, body `{ "p_user_id": {{ table1.selectedRow.user_id }} }`.
    - wire it to a Remove button with a confirmation dialog
    - on success: trigger `listMembers`

**Audit log** (owner or ops)

11. Add a query `auditLog`: `POST rest/v1/rpc/list_audit_log`, body `{ "p_limit": 100 }`. Bind a Table to it. To page back, pass `p_before_id` = the smallest `id` shown.

**Optional:** to survive page reloads, also save the session to Retool `localStorage` in the success handlers, and use it as `session`'s default value.

#### 3c. Option B: AI builder

Paste this into the builder's chat:

> Build an internal admin console using the existing **@card-mania-staging** REST resource. All data calls are POST requests to Supabase.
>
> 1. Sign-in screen: email and password, calling `auth/v1/token?grant_type=password` with JSON `{email, password}`. Store the response (`access_token`, `refresh_token`) in app state. Refresh it every 50 minutes with `auth/v1/token?grant_type=refresh_token` and `{refresh_token}`.
> 2. Every other call goes to `rest/v1/rpc/<name>` with headers `Authorization: Bearer <access_token>` and `Content-Profile: admin`, and a JSON body of named parameters.
> 3. After sign-in, call `whoami` (body `{}`) and show the email and role. If it fails, show only a "Not authorized" screen.
> 4. Members page: a table from `list_members`. A form calling `set_member_role` with `{p_email, p_role}`, where the role is one of owner, editor or ops. A remove button calling `remove_member` with `{p_user_id}`, with a confirmation step. Refresh the table after changes.
> 5. Audit log page: a table from `list_audit_log` with `{p_limit: 100}`.
>    Show the API's `message` field when a call fails. Never use any key other than the resource's configured `apikey` header.

Without an OpenAPI spec, the builder uses `rawRequest` and asks to run probe requests first. It's safe to approve these:

- a sign-in with dummy credentials (expect 400 "Invalid login credentials")
- `rpc/whoami` without a token (expect 401 "permission denied for schema admin")

While reviewing what it generates:

- **Never type real passwords into the AI chat.** Enter them only in the generated app's sign-in form.
- **Reject any step that adds another key** or changes the resource's `apikey` header.
- **Check every `admin` call** carries both headers above, and that the 50-minute token refresh exists.

#### 3d. Verify

1. Sign in as the seeded owner. You should see your email and `owner`.
2. Sign in as an account with no membership. You should see "Not authorized".
3. Add a second account as `editor`. It should appear in the Audit log with your email as the actor.

#### 3e. Backups

The Free plan has no Git sync. After significant changes, export the app (download the code, or for a classic app **Export to JSON**), then run `scripts/retool-import.sh <export>` and commit. The script copies the export into `retool/apps/<name>/` and refuses anything containing credentials. Details and restore steps: [`retool/README.md`](../retool/README.md).

### 4. Lock down the connection

Optionally, restrict access to the Supabase API to Retool's published egress IPs. Because only the anon key and short-lived user tokens leave Retool, this is defence in depth rather than a requirement.

## Adding a new admin RPC

1. Put it in the `admin` schema as `security definer` with `set search_path = ''`.
2. Start with `perform admin._require_role('<role>')`, or `v_actor uuid := admin._require_role(...)`.
3. Writes call `admin._audit('<thing>.<verb>', '<target_type>', <id>::text, <before>, <after>)`.
4. `grant execute on function admin.<fn>(<args>) to authenticated;`. New functions in `admin` aren't executable by anyone until granted.
5. Add pgTAP cases: a non-member is denied, the wrong role is denied, the right role succeeds and writes an audit row.
