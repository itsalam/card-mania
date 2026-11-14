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

| Role | Can |
| --- | --- |
| `owner` | Everything, including managing members |
| `editor` | Content: promo boxes, home feed sections (ITS-191/193/110) |
| `ops` | Dashboards, ops actions, audit log, `search_config` (ITS-117/57) |

Each person has one role, stored in `admin.members`. Every write RPC adds a row to `admin.audit_log`, which is append-only.

## RPCs (ITS-116)

| Function | Role | Purpose |
| --- | --- | --- |
| `has_role(variadic roles)` | any signed-in user | `true`/`false`; never raises. Use it to decide what to show. |
| `whoami()` | any member | `{user_id, email, role, member_since}`. Non-members get `42501`. |
| `list_members()` | owner | Members with emails and who granted them |
| `set_member_role(email, role)` | owner | Add a member or change their role. They need a Supabase account first. |
| `remove_member(user_id)` | owner | Remove a member. The last owner can't be removed or demoted. |
| `list_audit_log(limit, before_id, target_type)` | ops | Newest first, max 500 per page |

Errors: `42501` = not authorized, `22023` = bad input, `P0002` = not found.

## Setup

### 1. Expose the `admin` schema to the API

- **Local:** already in `supabase/config.toml` (`[api].schemas`).
- **Staging:** Dashboard → Project Settings → Data API → *Exposed schemas* → add `admin`. `supabase db push` and the staging deploy workflow do **not** change this setting, so do it once by hand after the ITS-116 migration lands.

Check that it worked. Without a token this should return `42501`, not `PGRST106` ("schema must be one of…"):

```sh
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/whoami" \
  -H "apikey: $ANON_KEY" -H "Content-Profile: admin" -H "Content-Type: application/json" -d '{}'
```

### 2. Seed the first owner (once per environment)

The person needs a Supabase Auth account first. They don't need to use the app:

- **Dashboard** → Authentication → Users → **Add user**. Either *Create new user* (email + password, tick **Auto Confirm User**) or *Send invitation* (they set their own password; use this for anyone other than yourself).
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

Retool offers two ways to build an app. The **classic** drag-and-drop editor (*Classic app*) needs no prompts and is the most predictable for forms and tables. The newer **AI builder** generates a React app from a chat prompt (3b). Both use the same data connection and the same requests.

#### 3a. Data connection (once)

**Resources → Create new → REST API**:

| Field | Value |
| --- | --- |
| Name | `card-mania-staging` |
| Base URL | `https://zijgqgpwmqrgnzcictcb.supabase.co` (staging) |
| Headers | `apikey`: the **publishable/anon** key (`EXPO_PUBLIC_SUPABASE_KEY` in `.env.preview`, or Dashboard → API Keys). `Content-Type`: `application/json`. |
| Authentication | None |

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
> 1. Sign-in screen: email and password, calling `auth/v1/token?grant_type=password` with JSON `{email, password}`. Store the response (`access_token`, `refresh_token`) in app state. Refresh it every 50 minutes with `auth/v1/token?grant_type=refresh_token` and `{refresh_token}`.
> 2. Every other call goes to `rest/v1/rpc/<name>` with headers `Authorization: Bearer <access_token>` and `Content-Profile: admin`, and a JSON body of named parameters.
> 3. After sign-in, call `whoami` (body `{}`) and show the email and role. If it fails, show only a "Not authorized" screen.
> 4. Members page: a table from `list_members`. A form calling `set_member_role` with `{p_email, p_role}`, where the role is one of owner, editor or ops. A remove button calling `remove_member` with `{p_user_id}`, with a confirmation step. Refresh the table after changes.
> 5. Audit log page: a table from `list_audit_log` with `{p_limit: 100}`.
> Show the API's `message` field when a call fails. Never use any key other than the resource's configured `apikey` header.

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
