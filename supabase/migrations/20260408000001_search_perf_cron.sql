-- Scheduled jobs for search performance and cache warming.
--
-- Prerequisites (run once in Supabase dashboard or via psql):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url');
--   select vault.create_secret('<anon-key>', 'anon_key');
--
-- The anon key is sufficient because search-warmup and price-charting both
-- have verify_jwt = false; no service-role credentials are needed here.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ── Job 1: Update prefetch_enabled flag hourly ────────────────────────────────
-- Computes the p75 render latency from the last 24 h of client-reported samples
-- using native percentile_cont. Updates search_config only when there are enough
-- data points (≥ 5) to make a meaningful decision.
select cron.schedule(
  'search-prefetch-flag-update',
  '0 * * * *',
  $$
  UPDATE public.search_config sc
  SET    prefetch_enabled = (
           SELECT COUNT(*) >= 5
                  AND percentile_cont(0.75) WITHIN GROUP (ORDER BY s.render_ms)
                      > sc.prefetch_threshold_ms
           FROM   public.search_perf_samples s
           WHERE  s.created_at >= now() - interval '24 hours'
         )
  WHERE  sc.id = 1;
  $$
);

-- ── Job 2: Warm the price-charting cache hourly ───────────────────────────────
-- Calls the price-charting edge function directly so its blended-search cache
-- is warm before users open the search screen.
select cron.schedule(
  'search-cache-warmup',
  '0 * * * *',
  $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url')
               || '/functions/v1/price-charting'
               || '?q=baseball-cards-2025-topps&limit=8&commit_images=true',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-internal', '1'
    )
  ) as request_id;
  $$
);
