-- ITS-77: wire search filters end-to-end + marketplace (storefront) search scope.
--
-- 1. Add a `sealed` flag to cards (backs the sealed filter + Auctions-Sealed section).
-- 2. Extend search_cards_blended with genre/set/price/sealed predicates (catalog scope).
-- 3. Add search_storefront_items for the marketplace scope — storefront collection_items
--    joined to cards + seller, with grading/genre/set/price/sealed filters.

-- ============================================================
-- 1. sealed flag on cards
-- ============================================================
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS sealed boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. search_cards_blended — catalog scope with filters
--    (drop the 2-arg version so named-arg calls resolve to this one)
-- ============================================================
DROP FUNCTION IF EXISTS public.search_cards_blended(text, int);

CREATE OR REPLACE FUNCTION public.search_cards_blended(
  p_q         text,
  p_limit     int      DEFAULT 20,
  p_genre     text     DEFAULT NULL,
  p_sets      text[]   DEFAULT NULL,
  p_min_price numeric  DEFAULT NULL,
  p_max_price numeric  DEFAULT NULL,
  p_sealed    boolean  DEFAULT NULL
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
signals AS (
  SELECT
    c.id, c.name, c.set_name, c.latest_price,
    ts_rank_cd(c.search_vector, plainto_tsquery('simple', (SELECT qnorm FROM q)))         AS s_fts,
    greatest(similarity(c.name, (SELECT qnorm FROM q)), similarity(c.set_name, (SELECT qnorm FROM q))) AS s_trgm,
    0.0::numeric                                              AS s_vec,
    0.0::numeric                                              AS s_pop,
    ts_headline('simple', coalesce(c.name,'') || ' ' || coalesce(c.set_name,''),
                plainto_tsquery('simple', (SELECT qnorm FROM q)),
                format('StartSel=<b>,StopSel=</b>,MaxFragments=%s,MaxWords=%s,MinWords=%s',
                  (SELECT snippet_max_fragments FROM cfg),
                  (SELECT snippet_max_words FROM cfg),
                  (SELECT snippet_min_words FROM cfg))) AS snippet
  FROM public.cards c
  WHERE (p_genre     IS NULL OR c.genre = p_genre)
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

-- ============================================================
-- 3. search_storefront_items — marketplace scope
--    Only items in storefront collections, with a price. Public-readable by
--    design (SECURITY DEFINER so the marketplace can query without exposing
--    non-storefront collection_items through RLS).
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_storefront_items(
  p_q         text     DEFAULT '',
  p_limit     int      DEFAULT 20,
  p_genre     text     DEFAULT NULL,
  p_sets      text[]   DEFAULT NULL,
  p_grading   text[]   DEFAULT NULL,   -- grading-company slugs (psa/bgs/cgc/…) and/or 'raw'
  p_min_price numeric  DEFAULT NULL,
  p_max_price numeric  DEFAULT NULL,
  p_sealed    boolean  DEFAULT NULL
)
RETURNS TABLE (
  id uuid,               -- collection_item id (the listing)
  card_id uuid,
  name text,
  set_name text,
  price numeric,
  genre text,
  sealed boolean,
  seller_id uuid,
  seller_username text,
  grade_label text,
  grading_company text,
  score numeric,
  snippet text,
  reason jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH q AS (
  SELECT trim(regexp_replace(lower(coalesce(p_q,'')), '\s+', ' ', 'g')) AS qnorm
)
SELECT
  ci.id,
  c.id                                                                        AS card_id,
  c.name,
  c.set_name,
  c.latest_price                                                              AS price,
  c.genre,
  c.sealed,
  col.user_id                                                                 AS seller_id,
  up.username                                                                 AS seller_username,
  gc.label                                                                    AS grade_label,
  gco.slug                                                                    AS grading_company,
  CASE
    WHEN (SELECT qnorm FROM q) = '' THEN 1.0
    ELSE greatest(
      ts_rank_cd(c.search_vector, plainto_tsquery('simple', (SELECT qnorm FROM q))),
      similarity(c.name, (SELECT qnorm FROM q))
    )
  END                                                                         AS score,
  (coalesce(c.set_name,'') || ' • ' || coalesce(c.name,''))                   AS snippet,
  jsonb_build_object(
    'seller', up.username,
    'price', c.latest_price,
    'grading', gco.slug,
    'grade', gc.label
  )                                                                           AS reason
FROM public.collection_items ci
JOIN public.collections   col ON col.id = ci.collection_id
                              AND coalesce(col.is_storefront, false) = true
JOIN public.cards         c   ON c.id = ci.ref_id
LEFT JOIN public.user_profile     up  ON up.user_id = col.user_id
LEFT JOIN public.grade_conditions gc  ON gc.id = ci.grade_condition_id
LEFT JOIN public.grading_companies gco ON gco.id = gc.company_id
WHERE c.latest_price IS NOT NULL
  AND (
        (SELECT qnorm FROM q) = ''
        OR c.search_vector @@ plainto_tsquery('simple', (SELECT qnorm FROM q))
        OR similarity(c.name, (SELECT qnorm FROM q)) > 0.2
      )
  AND (p_genre     IS NULL OR c.genre = p_genre)
  AND (p_sets      IS NULL OR c.set_name = ANY(p_sets))
  AND (p_min_price IS NULL OR c.latest_price >= p_min_price)
  AND (p_max_price IS NULL OR c.latest_price <= p_max_price)
  AND (p_sealed    IS NULL OR c.sealed = p_sealed)
  AND (
        p_grading IS NULL
        OR gco.slug = ANY(p_grading)
        OR ('raw' = ANY(p_grading) AND ci.grade_condition_id IS NULL)
      )
ORDER BY score DESC, price DESC
LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_storefront_items(text, int, text, text[], text[], numeric, numeric, boolean)
  TO anon, authenticated;
