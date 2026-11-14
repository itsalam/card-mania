# Retool exports

Copies of the admin console's Retool apps, exported by hand and committed here so we have history and a way to rebuild. Retool's Free plan has no Git sync. If the workspace moves to Business, its Source Control replaces this process. Backend, roles and setup: [`docs/admin-console.md`](../docs/admin-console.md).

```
retool/
  apps/
    admin-console/   one folder per Retool app
```

These files are Retool's code, not ours. They're committed **verbatim** so they re-import cleanly, so ESLint, TypeScript and Prettier all skip `retool/`. Don't hand-edit them here. Change the app in Retool and export again.

## Export → commit

1. In Retool, export the app:
   - **AI builder (React) apps:** download the project from the app's **Code** tab or its menu, as a `.zip`. If there's no download option, copy the files from the Code tab into a local folder.
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

3. Review `git diff -- retool/apps/<name>` and commit. Commit after any meaningful change to the app.

## Restore or recreate

- **Classic app:** Retool → **Create new → Import from JSON**, and choose `retool/apps/<name>/app.json`.
- **AI builder app:** create a new app from the imported code (zip or GitHub import).

Either way, the workspace first needs the `card-mania-staging` REST resource (base URL + anon/publishable `apikey` header) set up as in `docs/admin-console.md` § 3a. Exports refer to the resource by name and never include its settings or keys.

## What must never be in an export

No database credentials and no secret or service keys. The app only ever uses the resource's anon key plus each admin's own Supabase session (see "Why per-user tokens" in `docs/admin-console.md`). If the import script refuses an export, fix the app in Retool, not the files here.
