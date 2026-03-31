-- Search config (Phase 2)
-- Singleton table of tunable search constants so weights and thresholds can be
-- updated at runtime without redeploying functions.

CREATE TABLE IF NOT EXISTS public.search_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  -- Blended search weights (should sum to 1.0)
  weight_fts    numeric NOT NULL DEFAULT 0.6,
  weight_trgm   numeric NOT NULL DEFAULT 0.3,
  weight_vector numeric NOT NULL DEFAULT 0.1,
  weight_pop    numeric NOT NULL DEFAULT 0.05,
  -- Trigram similarity thresholds
  trgm_word_similarity_threshold numeric NOT NULL DEFAULT 0.2,
  -- ts_headline options
  snippet_max_words int NOT NULL DEFAULT 20,
  snippet_min_words int NOT NULL DEFAULT 5,
  snippet_max_fragments int NOT NULL DEFAULT 1,
  -- Score cutoff (results below this score are excluded)
  min_score numeric NOT NULL DEFAULT 0.0,
  updated_at timestamptz DEFAULT now()
);

-- Insert default row
INSERT INTO public.search_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Only service_role / admin can modify config
ALTER TABLE public.search_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_config_read" ON public.search_config FOR SELECT USING (true); -- anyone can read
CREATE POLICY "search_config_admin" ON public.search_config FOR ALL USING (auth.role() = 'service_role');
