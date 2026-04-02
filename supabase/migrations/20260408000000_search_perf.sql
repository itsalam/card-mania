-- Extend the search_config singleton with the adaptive prefetch flag.
-- The search-warmup cron writes prefetch_enabled based on rolling p75 latency.
ALTER TABLE public.search_config
  ADD COLUMN IF NOT EXISTS prefetch_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prefetch_threshold_ms integer NOT NULL DEFAULT 500;

-- Raw per-device render-time samples reported by clients.
-- Anon insert is intentional (no auth needed to contribute a measurement).
-- Only service_role can read (used by the cron job aggregate).
CREATE TABLE IF NOT EXISTS public.search_perf_samples (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  render_ms  integer     NOT NULL CHECK (render_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.search_perf_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_insert" ON public.search_perf_samples
  FOR INSERT WITH CHECK (true);

CREATE POLICY "perf_admin_read" ON public.search_perf_samples
  FOR SELECT USING (auth.role() = 'service_role');

-- Index for the 24-hour window query in search-warmup.
CREATE INDEX IF NOT EXISTS idx_search_perf_samples_created_at
  ON public.search_perf_samples (created_at DESC);
