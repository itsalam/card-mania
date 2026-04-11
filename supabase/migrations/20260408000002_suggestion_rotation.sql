-- Rotating sports card suggestion queries for the search screen.
--
-- Adds a curated list of queries and a rotation index to search_config.
-- The pg_cron warmup job advances the index hourly and pre-warms the
-- price-charting cache using the suggested=true flag so the server always
-- resolves the active query without any hardcoded value in the cron SQL.

ALTER TABLE public.search_config
  ADD COLUMN IF NOT EXISTS suggestion_queries text[] NOT NULL DEFAULT ARRAY[
    '2024 topps chrome baseball rookies',
    'patrick mahomes',
    'lebron james prizm rookie',
    'shohei ohtani topps',
    'luka doncic prizm rookie',
    'ken griffey jr upper deck',
    'tom brady rookie card',
    'mike trout rookie',
    'kobe bryant rookie',
    'aaron judge'
  ],
  ADD COLUMN IF NOT EXISTS suggestion_query_idx int NOT NULL DEFAULT 0;

-- Replace the static cache-warmup job with a rotating version.
-- The cron advances the index first, then warms the newly active query
-- via the suggested=true flag (server resolves the query from search_config).
SELECT cron.unschedule('search-cache-warmup');

SELECT cron.schedule(
  'search-cache-warmup',
  '0 * * * *',
  $$
  -- Advance index (wraps around list length)
  UPDATE public.search_config
  SET    suggestion_query_idx =
           (suggestion_query_idx + 1) % array_length(suggestion_queries, 1)
  WHERE  id = 1;

  -- Warm cache for the newly active query
  SELECT net.http_get(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
               || '/functions/v1/price-charting?limit=8&commit_images=true&suggested=true',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key'),
      'x-internal', '1'
    )
  ) AS request_id;
  $$
);
