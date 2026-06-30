-- ITS-56: Wire s_pop to real popularity signal (wishlist + sale count)
--
-- Adds three new search_config columns (B/C signal weights + normalization):
--   pop_wishlist_weight  — share of s_pop driven by wishlist count (B)
--   pop_sale_weight      — share of s_pop driven by completed-sale count (C)
--   pop_log_divisor      — log10 normalization cap (~20 events → 1.0 at default 3.0)
--
-- s_pop formula:
--   s_pop = least(1.0,
--     (pop_wishlist_weight * log(1 + wishlist_cnt)
--    + pop_sale_weight    * log(1 + sale_cnt))
--    / pop_log_divisor)
--
-- Scale at defaults (divisor=3.0):
--   0 events → 0.00 | 1 → 0.23 | 5 → 0.60 | 20 → ~1.00

-- ── Extend search_config with B/C signal knobs ───────────────────────────────

ALTER TABLE public.search_config
  ADD COLUMN IF NOT EXISTS pop_wishlist_weight numeric NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS pop_sale_weight     numeric NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS pop_log_divisor     numeric NOT NULL DEFAULT 3.0;

-- ── Indexes to speed up wishlist + sale aggregations ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_collection_items_ref_card
  ON public.collection_items (ref_id)
  WHERE item_kind = 'card';

CREATE INDEX IF NOT EXISTS idx_collections_wishlist
  ON public.collections (id)
  WHERE is_wishlist = true;

CREATE INDEX IF NOT EXISTS idx_transactions_completed
  ON public.transactions (offer_id)
  WHERE status = 'completed';

-- ── Updated search_cards_blended ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_cards_blended(p_q text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  set_name text,
  latest_price numeric,
  snippet text,
  score numeric,
  reason jsonb
)
LANGUAGE sql STABLE AS $$
WITH
cfg AS (
  SELECT * FROM public.search_config WHERE id = 1
),
q AS (
  SELECT trim(regexp_replace(lower(p_q), '\s+', ' ', 'g')) AS qnorm
),
-- B signal: how many distinct wishlists contain this card
wishlist_counts AS (
  SELECT ci.ref_id AS card_id, count(*) AS cnt
  FROM public.collection_items ci
  JOIN public.collections col ON col.id = ci.collection_id
  WHERE ci.item_kind = 'card'
    AND col.is_wishlist = true
  GROUP BY ci.ref_id
),
-- C signal: how many completed transactions included this card
sale_counts AS (
  SELECT ci.ref_id AS card_id, count(*) AS cnt
  FROM public.transactions t
  JOIN public.offers o       ON o.id  = t.offer_id
  JOIN public.offer_items oi ON oi.offer_id = o.id
  JOIN public.collection_items ci ON ci.id = oi.collection_item_id
  WHERE t.status = 'completed'
  GROUP BY ci.ref_id
),
signals AS (
  SELECT
    c.id, c.name, c.set_name, c.latest_price,
    ts_rank_cd(c.search_vector, plainto_tsquery('simple', (SELECT qnorm FROM q)))             AS s_fts,
    greatest(similarity(c.name, (SELECT qnorm FROM q)), similarity(c.set_name, (SELECT qnorm FROM q))) AS s_trgm,
    0.0::numeric                                                                               AS s_vec,
    least(1.0,
      (  (SELECT pop_wishlist_weight FROM cfg) * log(1.0 + coalesce(wl.cnt, 0)::numeric)
       + (SELECT pop_sale_weight     FROM cfg) * log(1.0 + coalesce(sl.cnt, 0)::numeric)
      ) / (SELECT pop_log_divisor FROM cfg)
    )                                                                                          AS s_pop,
    ts_headline('simple', coalesce(c.name,'') || ' ' || coalesce(c.set_name,''),
                plainto_tsquery('simple', (SELECT qnorm FROM q)),
                format('StartSel=<b>,StopSel=</b>,MaxFragments=%s,MaxWords=%s,MinWords=%s',
                  (SELECT snippet_max_fragments FROM cfg),
                  (SELECT snippet_max_words FROM cfg),
                  (SELECT snippet_min_words FROM cfg))) AS snippet
  FROM public.cards c
  LEFT JOIN wishlist_counts wl ON wl.card_id = c.id
  LEFT JOIN sale_counts     sl ON sl.card_id = c.id
),
scored AS (
  SELECT
    id, name, set_name, latest_price, snippet,
    (  (SELECT weight_fts    FROM cfg) * s_fts
     + (SELECT weight_trgm   FROM cfg) * s_trgm
     + (SELECT weight_vector FROM cfg) * s_vec
     + (SELECT weight_pop    FROM cfg) * s_pop
    ) AS score,
    jsonb_build_object(
      'fts', s_fts, 'trgm', s_trgm, 'vector', s_vec, 'pop', s_pop,
      'w_fts',    (SELECT weight_fts    FROM cfg),
      'w_trgm',   (SELECT weight_trgm   FROM cfg),
      'w_vector', (SELECT weight_vector FROM cfg),
      'w_pop',    (SELECT weight_pop    FROM cfg)
    ) AS reason
  FROM signals
)
SELECT *
FROM scored
WHERE score > (SELECT min_score FROM cfg)
ORDER BY score DESC
LIMIT p_limit;
$$;
