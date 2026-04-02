-- Search improvements (Phase 1)
-- 1. Store tsvector as a generated column on cards for faster FTS
-- 2. Fix ILIKE → pg_trgm in collection_item_query, collection_item_query_grouped_slim, collection_item_query_grouped
-- 3. Add trgm + FTS indexes on collections.name/description
-- 4. Add set_name trgm index

-- ============================================================
-- 1. Stored tsvector column + index on cards
-- ============================================================

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(set_name, ''))
    ) STORED;

DROP INDEX IF EXISTS public.idx_cards_fts;
CREATE INDEX IF NOT EXISTS idx_cards_search_vector ON public.cards USING GIN (search_vector);

-- ============================================================
-- 2. Update search_cards_blended to use stored search_vector
-- ============================================================

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
signals AS (
  SELECT
    c.id, c.name, c.set_name, c.latest_price,
    ts_rank_cd(c.search_vector, plainto_tsquery('simple', (SELECT qnorm FROM q)))         AS s_fts,
    greatest(similarity(c.name, (SELECT qnorm FROM q)), similarity(c.set_name, (SELECT qnorm FROM q))) AS s_trgm,
    0.0::numeric                                              AS s_vec,   -- replace if you have pgvector
    0.0::numeric                                              AS s_pop,   -- replace if you track popularity
    ts_headline('simple', coalesce(c.name,'') || ' ' || coalesce(c.set_name,''),
                plainto_tsquery('simple', (SELECT qnorm FROM q)),
                format('StartSel=<b>,StopSel=</b>,MaxFragments=%s,MaxWords=%s,MinWords=%s',
                  (SELECT snippet_max_fragments FROM cfg),
                  (SELECT snippet_max_words FROM cfg),
                  (SELECT snippet_min_words FROM cfg))) AS snippet
  FROM public.cards c
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
-- 3. Fix ILIKE → pg_trgm in collection_item_query
-- ============================================================

CREATE OR REPLACE FUNCTION public.collection_item_query(
    p_collection_id uuid,
    p_page_param timestamptz DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_page_size int DEFAULT 20,
    p_group boolean DEFAULT false
) RETURNS TABLE (
    collection_item_id uuid,
    collection_id uuid,
    user_id uuid,
    item_kind public.item_kind,
    ref_id uuid,
    grade_condition_id uuid,
    grading_company text,
    "position" int,
    quantity int,
    variants text[],
    created_at timestamptz,
    updated_at timestamptz,
    id uuid,
    name text,
    set_name text,
    latest_price numeric,
    grades_prices jsonb,
    genre text,
    last_updated timestamptz,
    front_id text,
    back_id text,
    extras text[],
    price_key text,
    collection_item_value int
) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public AS $$
WITH base AS (
    SELECT
        ci.id AS collection_item_id,
        ci.collection_id,
        ci.user_id,
        ci.item_kind,
        ci.ref_id,
        ci.grade_condition_id,
        ci.grading_company,
        ci.position AS "position",
        ci.quantity,
        ci.variants,
        ci.created_at,
        ci.updated_at,
        c.id,
        c.name,
        c.set_name,
        c.latest_price,
        c.grades_prices,
        c.genre,
        c.last_updated,
        c.front_id,
        c.back_id,
        c.extras,
        coalesce(gc.slug || gcnd.grade_value::text, 'ungraded') AS price_key,
        max(ci.created_at) OVER (PARTITION BY ci.ref_id) AS ref_latest_created_at,
        row_number() OVER (
            PARTITION BY ci.ref_id
            ORDER BY ci.created_at DESC
        ) AS ref_rownum
    FROM
        public.collection_items ci
        LEFT JOIN public.cards c ON ci.item_kind = 'card'::public.item_kind
            AND ci.ref_id = c.id
        LEFT JOIN public.grade_conditions gcnd ON gcnd.id = ci.grade_condition_id
        LEFT JOIN public.grading_companies gc ON gc.id = gcnd.company_id
    WHERE
        ci.collection_id = p_collection_id
        AND (
            p_search IS NULL
            OR p_search = ''
            OR (
                ci.item_kind = 'card'::public.item_kind
                AND (
                    c.name % p_search
                    OR c.set_name % p_search
                    OR word_similarity(p_search, c.name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                    OR word_similarity(p_search, c.set_name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                )
            )
        )
),
ranked AS (
    SELECT
        *,
        dense_rank() OVER (
            ORDER BY ref_latest_created_at DESC, ref_id
        ) AS ref_rank
    FROM base
),
filtered AS (
    SELECT *
    FROM ranked
    WHERE
        (
            p_group = false
            AND (
                p_page_param IS NULL
                OR created_at < p_page_param
            )
        )
        OR (
            p_group = true
            AND ref_rownum = 1
            AND (
                p_page_param IS NULL
                OR ref_latest_created_at < p_page_param
            )
            AND ref_rank <= coalesce(p_page_size, 20)
        )
)
SELECT
    r.collection_item_id,
    r.collection_id,
    r.user_id,
    r.item_kind,
    r.ref_id,
    r.grade_condition_id,
    r.grading_company,
    r."position",
    r.quantity,
    r.variants,
    r.created_at,
    r.updated_at,
    r.id,
    r.name,
    r.set_name,
    r.latest_price,
    r.grades_prices,
    r.genre,
    r.last_updated,
    r.front_id,
    r.back_id,
    r.extras,
    r.price_key,
    coalesce((r.grades_prices ->> r.price_key)::int, 0) AS collection_item_value
FROM filtered r
ORDER BY
    CASE WHEN p_group THEN r.ref_latest_created_at ELSE r.created_at END DESC,
    r.collection_item_id
LIMIT
    CASE WHEN p_group THEN coalesce(p_page_size, 20) ELSE coalesce(p_page_size, 20) END;
$$;

GRANT EXECUTE ON FUNCTION public.collection_item_query(uuid, timestamptz, text, int, boolean) TO authenticated;

-- ============================================================
-- 4. Fix ILIKE → pg_trgm in collection_item_query_grouped_slim
-- ============================================================

CREATE OR REPLACE FUNCTION public.collection_item_query_grouped_slim(
    p_collection_id uuid,
    p_page_param timestamptz DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_page_size int DEFAULT 20
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public AS $$
WITH candidates AS (
    -- Find groups (ref_id) ordered by latest activity, optionally filtered by search.
    SELECT
        ci.ref_id,
        max(ci.created_at) AS ref_latest_created_at
    FROM
        public.collection_items ci
        LEFT JOIN public.cards c ON ci.item_kind = 'card'::public.item_kind
            AND ci.ref_id = c.id
    WHERE
        ci.collection_id = p_collection_id
        AND (
            p_search IS NULL
            OR p_search = ''
            OR (
                ci.item_kind = 'card'::public.item_kind
                AND (
                    c.name % p_search
                    OR c.set_name % p_search
                    OR word_similarity(p_search, c.name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                    OR word_similarity(p_search, c.set_name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                )
            )
        )
    GROUP BY ci.ref_id
),
page AS (
    SELECT ref_id, ref_latest_created_at
    FROM candidates
    WHERE
        p_page_param IS NULL
        OR ref_latest_created_at < p_page_param
    ORDER BY ref_latest_created_at DESC, ref_id
    LIMIT coalesce(p_page_size, 20)
),
card_meta AS (
    -- One row per ref_id with card fields (only for card kind)
    SELECT
        p.ref_id,
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'set_name', c.set_name,
            'latest_price', c.latest_price,
            'genre', c.genre,
            'last_updated', c.last_updated,
            'front_id', c.front_id,
            'back_id', c.back_id,
            'extras', c.extras
        ) AS card
    FROM page p
    LEFT JOIN public.cards c ON c.id = p.ref_id
),
items AS (
    SELECT
        ci.ref_id,
        jsonb_agg(
            jsonb_build_object(
                'id', ci.id,
                'collection_id', ci.collection_id,
                'user_id', ci.user_id,
                'item_kind', ci.item_kind,
                'grade_condition_id', ci.grade_condition_id,
                'grading_company', ci.grading_company,
                'position', ci.position,
                'quantity', ci.quantity,
                'variants', ci.variants,
                'created_at', ci.created_at,
                'updated_at', ci.updated_at,
                'price_key', coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'),
                'collection_item_value', coalesce(
                    (c.grades_prices ->> coalesce(gc.slug || gcnd.grade_value::text, 'ungraded'))::int,
                    0
                )
            )
            ORDER BY ci.created_at DESC, ci.id
        ) AS items
    FROM
        public.collection_items ci
        JOIN page p ON p.ref_id = ci.ref_id
        LEFT JOIN public.cards c ON ci.item_kind = 'card'::public.item_kind
            AND ci.ref_id = c.id
        LEFT JOIN public.grade_conditions gcnd ON gcnd.id = ci.grade_condition_id
        LEFT JOIN public.grading_companies gc ON gc.id = gcnd.company_id
    WHERE ci.collection_id = p_collection_id
    GROUP BY ci.ref_id
)
SELECT
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'ref_id', p.ref_id,
                'ref_latest_created_at', p.ref_latest_created_at,
                'card', cm.card,
                'items', it.items
            )
            ORDER BY p.ref_latest_created_at DESC, p.ref_id
        ),
        '[]'::jsonb
    )
FROM page p
LEFT JOIN card_meta cm ON cm.ref_id = p.ref_id
LEFT JOIN items it ON it.ref_id = p.ref_id;
$$;

GRANT EXECUTE ON FUNCTION public.collection_item_query_grouped_slim(uuid, timestamptz, text, int) TO authenticated;

-- ============================================================
-- 5. Fix ILIKE → pg_trgm in collection_item_query_grouped
-- ============================================================

CREATE OR REPLACE FUNCTION public.collection_item_query_grouped(
    p_collection_id uuid,
    p_page_param timestamptz DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_page_size int DEFAULT 20
) RETURNS TABLE (
    ref_id uuid,
    ref_latest_created_at timestamptz,
    items jsonb
) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public AS $$
WITH base AS (
    SELECT
        ci.id AS collection_item_id,
        ci.collection_id,
        ci.user_id,
        ci.item_kind,
        ci.ref_id,
        ci.grade_condition_id,
        ci.grading_company,
        ci.position AS "position",
        ci.quantity,
        ci.variants,
        ci.created_at,
        ci.updated_at,
        c.id,
        c.name,
        c.set_name,
        c.latest_price,
        c.grades_prices,
        c.genre,
        c.last_updated,
        c.front_id,
        c.back_id,
        c.extras,
        coalesce(gc.slug || gcnd.grade_value::text, 'ungraded') AS price_key
    FROM
        public.collection_items ci
        LEFT JOIN public.cards c ON ci.item_kind = 'card'::public.item_kind
            AND ci.ref_id = c.id
        LEFT JOIN public.grade_conditions gcnd ON gcnd.id = ci.grade_condition_id
        LEFT JOIN public.grading_companies gc ON gc.id = gcnd.company_id
    WHERE
        ci.collection_id = p_collection_id
        AND (
            p_search IS NULL
            OR p_search = ''
            OR (
                ci.item_kind = 'card'::public.item_kind
                AND (
                    c.name % p_search
                    OR c.set_name % p_search
                    OR word_similarity(p_search, c.name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                    OR word_similarity(p_search, c.set_name) > (SELECT trgm_word_similarity_threshold FROM public.search_config WHERE id = 1)
                )
            )
        )
),
grouped AS (
    SELECT
        ref_id,
        max(created_at) AS ref_latest_created_at,
        jsonb_agg(
            jsonb_build_object(
                'collection_item_id', collection_item_id,
                'collection_id', collection_id,
                'user_id', user_id,
                'item_kind', item_kind,
                'ref_id', ref_id,
                'grade_condition_id', grade_condition_id,
                'grading_company', grading_company,
                'position', "position",
                'quantity', quantity,
                'variants', variants,
                'created_at', created_at,
                'updated_at', updated_at,
                'id', id,
                'name', name,
                'set_name', set_name,
                'latest_price', latest_price,
                'grades_prices', grades_prices,
                'genre', genre,
                'last_updated', last_updated,
                'front_id', front_id,
                'back_id', back_id,
                'extras', extras,
                'price_key', price_key,
                'collection_item_value', coalesce((grades_prices ->> price_key)::int, 0)
            )
            ORDER BY created_at DESC, collection_item_id
        ) AS items
    FROM base
    GROUP BY ref_id
),
paged AS (
    SELECT *
    FROM grouped
    WHERE
        p_page_param IS NULL
        OR ref_latest_created_at < p_page_param
    ORDER BY ref_latest_created_at DESC, ref_id
    LIMIT coalesce(p_page_size, 20)
)
SELECT ref_id, ref_latest_created_at, items
FROM paged
ORDER BY ref_latest_created_at DESC, ref_id;
$$;

GRANT EXECUTE ON FUNCTION public.collection_item_query_grouped(uuid, timestamptz, text, int) TO authenticated;

-- ============================================================
-- 6. Add trgm + FTS indexes on collections
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_collections_name_trgm ON public.collections USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_collections_name_fts ON public.collections
  USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

-- ============================================================
-- 7. Add set_name trgm index (may already exist)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cards_set_name_trgm ON public.cards USING GIN (set_name gin_trgm_ops);
