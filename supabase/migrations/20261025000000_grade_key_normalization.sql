-- Canonical grade price keys.
--
-- grades_prices / card_price_history keys are "<company slug><whole>[_<decimal>]" or
-- "ungraded" (psa10, bgs9_5, cgc10, ungraded) — what PriceCharting writes and what
-- 20260427000002 fixed _collection_* to produce. Several functions still built the key as
-- gc.slug || grade_value::text, and grade_value is numeric(4,1), so they looked up
-- "psa10.0" and every graded price resolved to 0 (marketplace market_value, wishlist
-- totals, collection_item_query price_key). CardHedge writers also emitted "psa_10" /
-- "psa_9.5". This migration:
--   1. adds key helpers (grade_key, grade_condition_price_key, normalize_grade_key,
--      normalize_grades_prices),
--   2. normalizes every write via BEFORE triggers on cards and card_price_history,
--   3. redefines the remaining key-building functions to use grade_key(),
--   4. normalizes existing data and recomputes wishlist totals.

-- 1. Helpers ------------------------------------------------------------------------------

-- grade_value is numeric(4,1): 10.0 → "10", 9.5 → "9_5". Null slug → null (callers coalesce
-- to 'ungraded', matching the old expression's null behaviour).
create or replace function public.grade_key(p_slug text, p_value numeric)
returns text language sql immutable parallel safe as $$
  select case
    when p_slug is null or p_value is null then null
    when p_value = trunc(p_value) then lower(p_slug) || trunc(p_value)::bigint::text
    else lower(p_slug) || replace(trim(trailing '0' from p_value::text), '.', '_')
  end
$$;

create or replace function public.grade_condition_price_key(p_grade_condition_id uuid)
returns text language sql stable parallel safe set search_path = public as $$
  select coalesce(
    (select public.grade_key(gc.slug, gcnd.grade_value)
       from public.grade_conditions gcnd
       left join public.grading_companies gc on gc.id = gcnd.company_id
      where gcnd.id = p_grade_condition_id),
    'ungraded')
$$;

-- Maps any known spelling to the canonical key; idempotent. "PSA 10", "psa_10", "psa10.0"
-- → psa10; "BGS 9.5", "bgs_9.5", "bgs9_5" → bgs9_5; "Raw" → ungraded. Unrecognised keys pass
-- through unchanged rather than being dropped.
create or replace function public.normalize_grade_key(p_key text)
returns text language plpgsql immutable parallel safe as $$
declare
  m text[];
  dec text;
begin
  if p_key is null then return null; end if;
  if lower(btrim(p_key)) in ('raw', 'ungraded') then return 'ungraded'; end if;
  m := regexp_match(lower(btrim(p_key)), '^([a-z]+)[\s_]*(\d+)(?:[._](\d+))?$');
  if m is null then return p_key; end if;
  dec := rtrim(coalesce(m[3], ''), '0');
  return m[1] || (m[2]::bigint)::text || case when dec = '' then '' else '_' || dec end;
end
$$;

-- Rebuilds an object with canonical keys and whole-cent values. On collision (e.g. both
-- "psa10" and "psa_10"), the value from the non-canonical spelling wins: those come from
-- CardHedge, which fetch-card already ranks above PriceCharting. Values are rounded because
-- readers cast with (grades_prices ->> key)::int, which throws on "1234.5" (cardhedge-search
-- wrote unrounded parseFloat(price) * 100).
create or replace function public.normalize_grades_prices(p jsonb)
returns jsonb language sql immutable parallel safe as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then p
    else coalesce(
      (select jsonb_object_agg(
                nk,
                case when jsonb_typeof(v) = 'number' then to_jsonb(round(v::numeric)::bigint) else v end
                order by (k <> nk))
         from (select k, v, public.normalize_grade_key(k) as nk from jsonb_each(p) e(k, v)) s),
      '{}'::jsonb)
  end
$$;

-- 2. Normalize on write ---------------------------------------------------------------------

create or replace function public._cards_normalize_grades_prices()
returns trigger language plpgsql as $$
begin
  new.grades_prices := public.normalize_grades_prices(new.grades_prices);
  return new;
end
$$;

drop trigger if exists trg_cards_normalize_grades_prices on public.cards;
create trigger trg_cards_normalize_grades_prices
  before insert or update of grades_prices on public.cards
  for each row execute function public._cards_normalize_grades_prices();

-- BEFORE INSERT runs ahead of ON CONFLICT arbitration, so upserts on
-- (card_id, grade, recorded_date) conflict on the canonical grade.
create or replace function public._card_price_history_normalize_grade()
returns trigger language plpgsql as $$
begin
  new.grade := public.normalize_grade_key(new.grade);
  return new;
end
$$;

drop trigger if exists trg_card_price_history_normalize_grade on public.card_price_history;
create trigger trg_card_price_history_normalize_grade
  before insert or update of grade on public.card_price_history
  for each row execute function public._card_price_history_normalize_grade();

-- 3. Key-building functions -----------------------------------------------------------------

-- _marketplace_base_listings: 2 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public._marketplace_base_listings()
 RETURNS TABLE(collection_item_id uuid, collection_id uuid, storefront_id uuid, seller_id uuid, seller_username text, seller_display_name text, seller_avatar_url text, item_kind item_kind, ref_id uuid, grade_condition_id uuid, grading_company text, quantity integer, variants text[], listed_at timestamp with time zone, name text, set_name text, latest_price numeric, grades_prices jsonb, genre text, front_id text, back_id text, price_key text, market_value integer, popularity_score numeric, sealed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  cfg as (
    select pop_wishlist_weight, pop_sale_weight, pop_log_divisor
    from public.search_config where id = 1
  ),
  wishlist_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.collection_items ci
    join public.collections col on col.id = ci.collection_id
    where ci.item_kind = 'card'
      and col.is_wishlist = true
    group by ci.ref_id
  ),
  sale_counts as (
    select ci.ref_id as card_id, count(*) as cnt
    from public.transactions t
    join public.offers o       on o.id  = t.offer_id
    join public.offer_items oi on oi.offer_id = o.id
    join public.collection_items ci on ci.id = oi.collection_item_id
    where t.status = 'completed'
    group by ci.ref_id
  )
  select
    ci.id                                                                  as collection_item_id,
    ci.collection_id,
    sf.id                                                                  as storefront_id,
    up.user_id                                                             as seller_id,
    up.username                                                            as seller_username,
    up.display_name                                                        as seller_display_name,
    up.avatar_url                                                          as seller_avatar_url,
    ci.item_kind,
    ci.ref_id,
    ci.grade_condition_id,
    ci.grading_company,
    ci.quantity,
    ci.variants,
    sf.listed_at,
    c.name,
    c.set_name,
    c.latest_price,
    c.grades_prices,
    c.genre,
    c.front_id,
    c.back_id,
    coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded')               as price_key,
    coalesce(
      (c.grades_prices ->> coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'))::int,
      0
    )                                                                      as market_value,
    least(1.0,
      (  (select pop_wishlist_weight from cfg) * log(1.0 + coalesce(wl.cnt, 0)::numeric)
       + (select pop_sale_weight     from cfg) * log(1.0 + coalesce(sl.cnt, 0)::numeric)
      ) / (select pop_log_divisor from cfg)
    )                                                                      as popularity_score,
    coalesce(c.sealed, false)                                             as sealed
  from public.storefronts sf
  join public.user_profile up
    on up.user_id = sf.user_id
  join public.collections col
    on col.id = any(sf.collection_ids)
   and coalesce(col.is_storefront, false) = true
  join public.collection_items ci
    on ci.collection_id = col.id
   and ci.quantity > 0
  left join public.cards c
    on ci.item_kind = 'card'::public.item_kind
   and c.id = ci.ref_id
  left join public.grade_conditions gcnd
    on gcnd.id = ci.grade_condition_id
  left join public.grading_companies gc
    on gc.id = gcnd.company_id
  left join wishlist_counts wl on wl.card_id = c.id
  left join sale_counts     sl on sl.card_id = c.id
  where sf.is_listed = true;
$function$;

-- _wishlist_row_cost_cents_from_collection_item: 1 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public._wishlist_row_cost_cents_from_collection_item(p_item_kind item_kind, p_ref_id uuid, p_grade_condition_id uuid, p_grading_company text)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  -- Only card rows carry price; others are 0
  select case
    when p_item_kind = 'card'::public.item_kind then (
      select coalesce(
        (c.grades_prices->>coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'))::int,
        0
      )
      from public.cards c
      left join public.grade_conditions gcnd on gcnd.id = p_grade_condition_id
      left join public.grading_companies gc on gc.id = gcnd.company_id
      where c.id = p_ref_id
    )
    else 0
  end;
$function$;

-- _wishlist_totals_bump_on_card_prices: 1 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public._wishlist_totals_bump_on_card_prices()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Only react when grades_prices changes
  if TG_OP = 'UPDATE' and (NEW.grades_prices is distinct from OLD.grades_prices) then
    with wishlist_rows as (
      select
        ci.user_id,
        ci.quantity,
        coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') as price_key
      from public.collection_items ci
      join public.collections c on c.id = ci.collection_id and c.is_wishlist = true
      left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
      left join public.grading_companies gc on gc.id = gcnd.company_id
      where ci.item_kind = 'card'::public.item_kind
        and ci.ref_id = NEW.id
    ),
    deltas as (
      select
        wr.user_id,
        sum(
          wr.quantity * (
            coalesce((NEW.grades_prices->>wr.price_key)::int, 0)
            - coalesce((OLD.grades_prices->>wr.price_key)::int, 0)
          )
        ) as delta_cents
      from wishlist_rows wr
      group by wr.user_id
      having sum(
        wr.quantity * (
          coalesce((NEW.grades_prices->>wr.price_key)::int, 0)
          - coalesce((OLD.grades_prices->>wr.price_key)::int, 0)
        )
      ) <> 0
    )
    insert into public.wishlist_totals (user_id, total_cents, computed_at)
    select d.user_id, d.delta_cents, now()
    from deltas d
    on conflict (user_id) do update
      set total_cents = public.wishlist_totals.total_cents + excluded.total_cents,
          computed_at = excluded.computed_at;
  end if;

  return NEW;
end;
$function$;

-- collection_item_query: 1 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public.collection_item_query(p_collection_id uuid, p_page_param timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_page_size integer DEFAULT 20, p_group boolean DEFAULT false)
 RETURNS TABLE(collection_item_id uuid, collection_id uuid, collection_ref uuid, user_id uuid, item_kind item_kind, ref_id uuid, grade_condition_id uuid, grading_company text, "position" integer, quantity integer, variants text[], created_at timestamp with time zone, updated_at timestamp with time zone, id uuid, name text, set_name text, latest_price numeric, grades_prices jsonb, genre text, last_updated timestamp with time zone, front_id text, back_id text, extras text[], price_key text, collection_item_value integer, primary_image_cache_id uuid, primary_image_storage_path text, primary_image_width integer, primary_image_height integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with base as (
    select
        ci.id              as collection_item_id,
        ci.collection_id,
        ci.collection_ref,
        ci.user_id,
        ci.item_kind,
        ci.ref_id,
        ci.grade_condition_id,
        ci.grading_company,
        ci.position        as "position",
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
        coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') as price_key,
        cii.image_cache_id as primary_image_cache_id,
        cii.storage_path   as primary_image_storage_path,
        cii.width          as primary_image_width,
        cii.height         as primary_image_height,
        max(ci.created_at) over (partition by ci.ref_id)        as ref_latest_created_at,
        row_number() over (
            partition by ci.ref_id
            order by ci.created_at desc
        )                                                        as ref_rownum
    from
        public.collection_items ci
        left join public.cards c
            on ci.item_kind = 'card'::public.item_kind and ci.ref_id = c.id
        left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
        left join public.grading_companies gc  on gc.id  = gcnd.company_id
        left join public.collection_item_images cii
            on cii.collection_item_id = ci.id and cii.is_primary
    where
        ci.collection_id = p_collection_id
        and (
            p_search is null
            or p_search = ''
            or (
                ci.item_kind = 'card'::public.item_kind
                and (
                    c.name % p_search
                    or c.set_name % p_search
                    or word_similarity(p_search, c.name)     > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                    or word_similarity(p_search, c.set_name) > (select trgm_word_similarity_threshold from public.search_config where id = 1)
                )
            )
        )
),
ranked as (
    select
        *,
        dense_rank() over (
            order by ref_latest_created_at desc, ref_id
        ) as ref_rank
    from base
),
filtered as (
    select *
    from ranked
    where
        (
            p_group = false
            and (p_page_param is null or created_at < p_page_param)
        )
        or (
            p_group = true
            and ref_rownum = 1
            and (p_page_param is null or ref_latest_created_at < p_page_param)
            and ref_rank <= coalesce(p_page_size, 20)
        )
)
select
    r.collection_item_id,
    r.collection_id,
    r.collection_ref,
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
    coalesce((r.grades_prices ->> r.price_key)::int, 0) as collection_item_value,
    r.primary_image_cache_id,
    r.primary_image_storage_path,
    r.primary_image_width,
    r.primary_image_height
from filtered r
order by
    case when p_group then r.ref_latest_created_at else r.created_at end desc,
    r.collection_item_id
limit coalesce(p_page_size, 20);
$function$;

-- collection_item_query_grouped: 1 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public.collection_item_query_grouped(p_collection_id uuid, p_page_param timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_page_size integer DEFAULT 20)
 RETURNS TABLE(ref_id uuid, ref_latest_created_at timestamp with time zone, items jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
        coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') AS price_key
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
$function$;

-- collection_item_query_grouped_slim: 2 key expression(s) → public.grade_key(...). Body otherwise verbatim from
-- pg_get_functiondef at 20260922000001.
CREATE OR REPLACE FUNCTION public.collection_item_query_grouped_slim(p_collection_id uuid, p_page_param timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
                'price_key', coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'),
                'collection_item_value', coalesce(
                    (c.grades_prices ->> coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded'))::int,
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
$function$;

-- _collection_totals_bump_on_card_prices (20260427000002) multiplied by ci.quantity outside
-- sum(), so it raised "ci.quantity must appear in the GROUP BY clause" — any grades_prices
-- update on a card held in a collection failed, including fetch-card price refreshes.
-- Rewritten with the per-row quantity inside the aggregate and grade_key() for the key.
create or replace function public._collection_totals_bump_on_card_prices()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and new.grades_prices is distinct from old.grades_prices then
    with item_rows as (
      select ci.collection_id,
             coalesce(ci.quantity, 1) as qty,
             coalesce(public.grade_key(gc.slug, gcnd.grade_value), 'ungraded') as k
        from public.collection_items ci
        left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
        left join public.grading_companies gc on gc.id = gcnd.company_id
       where ci.item_kind = 'card'::public.item_kind
         and ci.ref_id = new.id
    ),
    deltas as (
      select collection_id,
             sum(qty * (coalesce((new.grades_prices ->> k)::int, 0)
                      - coalesce((old.grades_prices ->> k)::int, 0))) as delta_cents
        from item_rows
       group by collection_id
    )
    insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
    select collection_id, delta_cents, 0, now() from deltas where delta_cents <> 0
    on conflict (collection_id) do update
       set total_cents = public.collection_totals.total_cents + excluded.total_cents,
           computed_at = excluded.computed_at;
  end if;
  return new;
end
$$;

-- 4. Data fix --------------------------------------------------------------------------------

-- Normalize stored keys without bumping last_updated (fetch-card's staleness clock) or
-- firing the per-row totals bumps; totals are recomputed from scratch below instead.
alter table public.cards disable trigger trg_cards_set_last_updated;
alter table public.cards disable trigger wishlist_totals_bump_card_prices_au;
alter table public.cards disable trigger collection_totals_bump_card_prices_au;

update public.cards c
   set grades_prices = public.normalize_grades_prices(c.grades_prices)
 where c.grades_prices is not null
   and c.grades_prices is distinct from public.normalize_grades_prices(c.grades_prices);

alter table public.cards enable trigger trg_cards_set_last_updated;
alter table public.cards enable trigger wishlist_totals_bump_card_prices_au;
alter table public.cards enable trigger collection_totals_bump_card_prices_au;

-- History: re-insert non-canonical rows under the canonical grade (keeping any canonical
-- row already recorded that day), then drop the originals.
insert into public.card_price_history (card_id, grade, price_cents, recorded_at)
select h.card_id, public.normalize_grade_key(h.grade), h.price_cents, h.recorded_at
  from public.card_price_history h
 where h.grade <> public.normalize_grade_key(h.grade)
on conflict (card_id, grade, recorded_date) do nothing;

delete from public.card_price_history h
 where h.grade <> public.normalize_grade_key(h.grade);

-- Wishlist totals were computed with the "psa10.0" key, so graded rows counted as 0.
insert into public.wishlist_totals (user_id, total_cents, computed_at)
select ci.user_id,
       coalesce(sum(public._wishlist_row_cost_cents_from_collection_item(
         ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.grading_company)), 0),
       now()
  from public.collection_items ci
  join public.collections col on col.id = ci.collection_id and col.is_wishlist
 group by ci.user_id
on conflict (user_id) do update
   set total_cents = excluded.total_cents,
       computed_at = excluded.computed_at;

-- Collection totals: the broken card-prices trigger above meant price changes never
-- reached collection_totals, so recompute them as 20260427000002 did.
insert into public.collection_totals (collection_id, total_cents, quantity_total, computed_at)
select ci.collection_id,
       coalesce(sum(public._collection_item_value_cents(ci.item_kind, ci.ref_id, ci.grade_condition_id, ci.quantity)), 0),
       coalesce(sum(coalesce(ci.quantity, 1)), 0),
       now()
  from public.collection_items ci
 where ci.quantity is null or ci.quantity > 0
 group by ci.collection_id
on conflict (collection_id) do update
   set total_cents = excluded.total_cents,
       quantity_total = excluded.quantity_total,
       computed_at = excluded.computed_at;
