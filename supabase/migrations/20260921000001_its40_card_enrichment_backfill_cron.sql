-- ITS-40: scheduled backfill of card images (CardHedge, then eBay) for cards
-- rows that predate/missed the live lazy-enrichment path.
--
-- Cadence: every 15 minutes, batch size ENRICHMENT_BATCH_SIZE (default 15,
-- edge function env var). At worst-case throughput (15 cards * 96 runs/day)
-- this uses at most ~1440 calls/day per vendor — eBay is only called when
-- CardHedge has no confident image match, so it stays well under eBay's
-- ~5000/day app-token quota, leaving headroom for live search-triggered eBay
-- fallback calls. Tune ENRICHMENT_BATCH_SIZE / this schedule as needed.
--
-- net.http_post uses pg_net's default 5s timeout, so net._http_response
-- records a timeout for most runs; the function keeps running to completion
-- regardless. Check run outcomes in the function's logs, not pg_net.
--
-- Uses the service key (not anon) because this function writes to
-- cards/card_images/provider_search_cache beyond anon RLS grants — mirrors
-- 20260519000002_cleanup_anon_users_cron.sql's pattern. The function only
-- accepts a bearer token that is one of the project's service keys
-- (_shared/service-auth.ts), so the 'edge_token' *Vault* secret (not an edge
-- function secret) must hold one: on staging, the sb_secret_… key, which is
-- what SUPABASE_SERVICE_ROLE_KEY contains after the new-API-keys migration.
-- Staging's vault originally held the local CLI's demo service key, so every
-- call 401'd while cron.job_run_details still reported 'succeeded' (ITS-40).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'card-enrichment-backfill',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/card-enrichment-backfill',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'x-internal',    '1'
    )
  ) as request_id;
  $$
);
