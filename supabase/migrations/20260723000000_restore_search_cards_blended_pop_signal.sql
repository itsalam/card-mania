-- ITS-87: search_cards_blended stopped ranking by popularity.
--
-- 20260630000000_s_pop_wishlist_signal.sql wired s_pop to real wishlist +
-- completed-sale counts. 20260711000000_its77_search_filters_storefront.sql
-- later added p_genre/p_sets/p_min_price/p_max_price/p_sealed filter params
-- via CREATE OR REPLACE, but branched off the pre-popularity function body —
-- silently reverting s_pop to a hardcoded 0.0::numeric. This restores the
-- wishlist/sale wiring on top of the current filter-params signature.

CREATE OR REPLACE FUNCTION public.search_cards_blended(
  p_q text,
  p_limit int DEFAULT 20,
  p_genre text DEFAULT NULL,
  p_sets text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_sealed boolean DEFAULT NULL
)
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
  WHERE (p_genre     IS NULL OR public.canonical_genre(c.genre) = p_genre)
    AND (p_sets      IS NULL OR c.set_name = ANY(p_sets))
    AND (p_min_price IS NULL OR c.latest_price >= p_min_price)
    AND (p_max_price IS NULL OR c.latest_price <= p_max_price)
    AND (p_sealed    IS NULL OR c.sealed = p_sealed)
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
