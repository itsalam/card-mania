# Retool apps

Source for the admin console's Retool apps. Changes go from the repo to Retool through Retool's MCP server, and edits made in Retool come back as exports. Retool's Free plan has no Git sync. If the workspace moves to Business, its Source Control replaces this process. Backend, roles and setup: [`docs/admin-console.md`](../docs/admin-console.md).

```
retool/
  apps/
    admin-console/   one folder per Retool app
```

The repo copy is the **source of truth** for code changes. Retool's AI chat is still fine for quick changes, but export them back here before anyone pushes from the repo, or the next push overwrites them. ESLint, TypeScript and Prettier skip `retool/`.

Retool generates some files itself and they aren't exported: the UI kit (`frontend/lib/shadcn/*`), the typed hooks for each backend function (`frontend/hooks/backend/*`) and the entry point. The backend functions call the `card-mania-staging` resource as the global `cardManiaStaging`.

## Repo → Retool (Retool MCP server)

Works on the Free plan. One-time setup, per developer:

```sh
claude mcp add --transport http retool https://itsalam.retool.com/mcp
# new Claude Code session → /mcp → retool → authorize (read, write, admin)
```

1. Change the code under `retool/apps/admin-console/` in a branch and open a PR as usual.
2. Ask Claude Code to push it to the existing app (Admin Console, `93de96ba-dfe6-11f1-9de7-5bba9be80374`). Use `targetAppId`, or the push creates a new app.
3. The change lands on an unpublished branch in Retool. Open the app, test it in preview, then **Publish**. Retool asks you to approve any backend function that changes data before it runs live.

## Retool → repo (after edits in Retool)

1. In Retool, export the app:
   - **AI builder (React) apps:** download the project from the app's **Code** tab or its menu, as a `.zip`.
   - **Classic apps:** App menu (`…`) → **Export to JSON**.
2. Import it into the repo:

   ```sh
   scripts/retool-import.sh ~/Downloads/<export>.zip            # or .json, or a folder
   scripts/retool-import.sh ~/Downloads/<export>.json members    # another app → retool/apps/members
   ```

   The script:

   - replaces `retool/apps/<name>/` with the export (the default name is `admin-console`)
   - strips `node_modules`, `dist` and `.env*`
   - pretty-prints JSON exports so diffs are readable
   - **refuses** to copy anything that contains a credential: a Supabase secret key, a `service_role` reference or JWT, a Postgres connection string with a password, a private key, or a hard-coded bearer token

3. Commit it. It's a backup, so there's no need to review the diff line by line.

## Restore or recreate

- **Classic app:** Retool → **Create new → Import from JSON**, and choose `retool/apps/<name>/app.json`.
- **AI builder app:** create a new app from the imported code (zip or GitHub import).

Either way, the workspace first needs the `card-mania-staging` REST resource (base URL + anon/publishable `apikey` header) set up as in `docs/admin-console.md` § 3a. Exports refer to the resource by name and never include its settings or keys.

## What must never be in an export

No database credentials and no secret or service keys. The app only ever uses the resource's anon key plus each admin's own Supabase session (see "Why per-user tokens" in `docs/admin-console.md`). If the import script refuses an export, remove the credential in Retool and export again.
