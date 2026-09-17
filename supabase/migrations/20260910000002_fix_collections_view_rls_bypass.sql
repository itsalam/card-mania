-- SECURITY FIX: plain Postgres views run with the view owner's privileges for RLS purposes
-- unless `security_invoker = true` is set (available since Postgres 15). Neither of these
-- views ever set it, so both have been silently bypassing the RLS policies on the
-- `collections`/`collection_totals` tables they select from (`collections_owner_all`:
-- auth.uid() = user_id) — any authenticated user querying them directly (via PostgREST,
-- which exposes public-schema views by default) gets every user's rows, not just their own.
--
-- Confirmed exploitable locally: querying collections_with_tags as an ordinary authenticated
-- user returned all 490 rows across every account, not just the caller's — this is also why
-- `listMyCollections()` (features/home/cards/CollectionsPreview.tsx's data source) has been
-- silently broken/PGRST201-erroring rather than scoped, see the sibling fix in
-- lib/store/functions/collections.ts. This migration does not change that ambiguous-embed fix;
-- it fixes the actual data-exposure bug underneath it.
--
-- This same migration should be applied to the production project as soon as possible — it
-- was carrying the identical vulnerability before this fix (same view definitions, same
-- Postgres default).

alter view public.collections_with_tags set (security_invoker = true);
alter view public.collection_totals_with_flags set (security_invoker = true);
