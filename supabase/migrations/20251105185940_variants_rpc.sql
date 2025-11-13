-- Enable once per DB
create extension if not exists pg_trgm;

-- Fast filter of items by card (ref_id); restrict to cards only, and only rows that actually have variants
create index if not exists ci_ref_id_card_variants on public .collection_items (ref_id)
where
    item_kind = 'card' :: public .item_kind
    and array_length(variants, 1) is not null;

-- You already have (card_id, name) unique; add trigram on name for fast ILIKE
create index if not exists card_variants_name_trgm on public .card_variants using gin (name gin_trgm_ops);

create
or replace view public .collection_item_variant_usage as
select
    ci.ref_id as card_id,
    lower(trim(v.variant)) as variant_lc,
    count(*) as usage_count,
    -- number of rows where this variant appears
    sum(ci.quantity) :: bigint as total_quantity -- quantity-weighted usage
from
    public .collection_items ci
    cross join lateral unnest(ci.variants) as v(variant)
where
    ci.item_kind = 'card' :: public .item_kind
group by
    ci.ref_id,
    lower(trim(v.variant));

create
or replace function public .most_used_variants(
    p_card_id uuid,
    p_query text default '',
    p_limit int default 20
) returns table (
    variant_id uuid,
    -- from card_variants if matched, else null
    variant_name text,
    -- canonical name when known, else the observed text
    usage_count bigint,
    -- how many collection_items rows had this variant
    total_quantity bigint -- sum of quantity for those rows
) language sql security definer
set
    search_path = public stable as $$ with usage as (
        select
            u.variant_lc,
            u.usage_count,
            u.total_quantity
        from
            public .collection_item_variant_usage u
        where
            u.card_id = p_card_id
    ),
    -- Canonical variants for this card (normalize to lowercase for join)
    cv as (
        select
            cv.id,
            cv.name,
            lower(trim(cv.name)) as variant_lc
        from
            public .card_variants cv
        where
            cv.card_id = p_card_id
    ),
    -- Join usage to canonical list when possible
    joined as (
        select
            cv.id as variant_id,
            coalesce(cv.name, u.variant_lc) as variant_name,
            u.usage_count,
            u.total_quantity
        from
            usage u
            left join cv on cv.variant_lc = u.variant_lc
    )
select
    j.variant_id,
    j.variant_name,
    j.usage_count,
    j.total_quantity
from
    joined j
where
    (
        p_query is null
        or p_query = ''
    )
    or j.variant_name ilike '%' || p_query || '%'
order by
    j.total_quantity desc,
    j.usage_count desc,
    j.variant_name asc
limit
    p_limit;

$$;