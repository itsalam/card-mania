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

In the SQL editor, or `psql` as `postgres`. The person must have signed up in the app first.

```sql
insert into admin.members (user_id, role)
select id, 'owner' from auth.users where email = '<owner email>'
on conflict (user_id) do update set role = 'owner';
```

After that, manage members through `set_member_role` / `remove_member`, so changes are audited.

### 3. Retool workspace

1. **Resource:** a REST API named `supabase-admin`.
   - Base URL: `https://<project-ref>.supabase.co`
   - Headers: `apikey: <anon key>`, `Content-Type: application/json`, `Content-Profile: admin`, `Authorization: Bearer {{ admin_session.value.access_token }}`
2. **Sign-in:** an app-level login form plus a query `POST /auth/v1/token?grant_type=password` with `{email, password}` and only the `apikey` header (no `Authorization`). Store the response in a state variable `admin_session`. Refresh it on a timer, or when a call returns 401, with `grant_type=refresh_token`.
3. **Landing:** after sign-in, call `POST /rest/v1/rpc/whoami`. A `42501` response shows a "Not authorized" screen.
4. **Backups:** the Free plan has no Git sync, so export each app's JSON after significant changes.

### 4. Lock down the connection

Optionally, restrict access to the Supabase API to Retool's published egress IPs. Because only the anon key and short-lived user tokens leave Retool, this is defence in depth rather than a requirement.

## Adding a new admin RPC

1. Put it in the `admin` schema as `security definer` with `set search_path = ''`.
2. Start with `perform admin._require_role('<role>')`, or `v_actor uuid := admin._require_role(...)`.
3. Writes call `admin._audit('<thing>.<verb>', '<target_type>', <id>::text, <before>, <after>)`.
4. `grant execute on function admin.<fn>(<args>) to authenticated;`. New functions in `admin` aren't executable by anyone until granted.
5. Add pgTAP cases: a non-member is denied, the wrong role is denied, the right role succeeds and writes an audit row.
