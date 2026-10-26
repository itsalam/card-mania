-- Scheduled tracked-price-refresh (CardHedger prices for wishlisted / collected cards).
--
-- Cadence: twice an hour at :07 and :37, offset from card-enrichment-backfill's */15 slots.
-- Defaults (edge function env vars) PRICE_REFRESH_BATCH_SIZE=25, PRICE_REFRESH_MAX_RESOLVES=5
-- cap usage at ~1200 all-prices-by-card + ~240 card-match calls/day. CardHedger documents no
-- quotas, so start here and tune from price_refresh_runs (status 'rate_limited' means back off).
--
-- net.http_post uses pg_net's default 5s timeout, so net._http_response records a timeout for
-- most runs and cron.job_run_details reports 'succeeded' even when the call 401s — check
-- price_refresh_runs / price_refresh_backlog instead.
--
-- The function only accepts a bearer token that is one of the project's service keys
-- (_shared/service-auth.ts), so the 'edge_token' *Vault* secret (not an edge function secret)
-- must hold one — on staging the sb_secret_… key. See
-- 20260921000001_its40_card_enrichment_backfill_cron.sql.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'tracked-price-refresh',
  '7,37 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/tracked-price-refresh',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'x-internal',    '1'
    )
  ) as request_id;
  $$
);
