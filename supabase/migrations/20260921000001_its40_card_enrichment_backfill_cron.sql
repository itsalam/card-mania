-- ITS-40: scheduled backfill of eBay enrichment + images for cards rows
-- that predate/missed the live lazy-enrichment path.
--
-- Cadence: every 15 minutes, batch size ENRICHMENT_BATCH_SIZE (default 15,
-- edge function env var). At worst-case throughput (15 cards * 96 runs/day)
-- this uses ~1440 eBay Browse API calls/day, well under the ~5000/day
-- app-token quota, leaving headroom for live search-triggered eBay fallback
-- calls. Tune ENRICHMENT_BATCH_SIZE / this schedule as needed post-deploy.
--
-- Uses the service-role key (not anon) because this function writes to
-- cards/card_images/provider_search_cache beyond anon RLS grants — mirrors
-- 20260519000002_cleanup_anon_users_cron.sql's pattern, whose function
-- guard compares the Authorization header against SUPABASE_SERVICE_ROLE_KEY
-- directly, confirming the 'edge_token' vaulted secret holds that key.
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
