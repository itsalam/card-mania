create
or replace function public .collection_item_query_grouped(
    p_collection_id uuid,
    p_page_param timestamptz default null,
    p_search text default null,
    p_page_size int default 20
) returns table (
    ref_id uuid,
    ref_latest_created_at timestamptz,
    items jsonb
) language sql stable security invoker
set
    search_path = public as $$ with base as (
        select
            ci.id as collection_item_id,
            ci.collection_id,
            ci.user_id,
            ci.item_kind,
            ci.ref_id,
            ci.grade_condition_id,
            ci.grading_company,
            ci.position as "position",
            ci.quantity,
            ci.variants,
            ci.created_at,
            ci.updated_at,
            c .id,
            c .name,
            c .set_name,
            c .latest_price,
            c .grades_prices,
            c .genre,
            c .last_updated,
            c .front_id,
            c .back_id,
            c .extras,
            coalesce(gc.slug || gcnd.grade_value :: text, 'ungraded') as price_key
        from
            public .collection_items ci
            left join public .cards c on ci.item_kind = 'card' :: public .item_kind
            and ci.ref_id = c .id
            left join public .grade_conditions gcnd on gcnd.id = ci.grade_condition_id
            left join public .grading_companies gc on gc.id = gcnd.company_id
        where
            ci.collection_id = p_collection_id
            and (
                p_search is null
                or p_search = ''
                or (
                    ci.item_kind = 'card' :: public .item_kind
                    and c .name ilike ('%' || p_search || '%')
                )
            )
    ),
    grouped as (
        select
            ref_id,
            max(created_at) as ref_latest_created_at,
            jsonb_agg(
                jsonb_build_object(
                    'collection_item_id',
                    collection_item_id,
                    'collection_id',
                    collection_id,
                    'user_id',
                    user_id,
                    'item_kind',
                    item_kind,
                    'ref_id',
                    ref_id,
                    'grade_condition_id',
                    grade_condition_id,
                    'grading_company',
                    grading_company,
                    'position',
                    "position",
                    'quantity',
                    quantity,
                    'variants',
                    variants,
                    'created_at',
                    created_at,
                    'updated_at',
                    updated_at,
                    'id',
                    id,
                    'name',
                    name,
                    'set_name',
                    set_name,
                    'latest_price',
                    latest_price,
                    'grades_prices',
                    grades_prices,
                    'genre',
                    genre,
                    'last_updated',
                    last_updated,
                    'front_id',
                    front_id,
                    'back_id',
                    back_id,
                    'extras',
                    extras,
                    'price_key',
                    price_key,
                    'collection_item_value',
                    coalesce((grades_prices ->> price_key) :: int, 0)
                )
                order by
                    created_at desc,
                    collection_item_id
            ) as items
        from
            base
        group by
            ref_id
    ),
    paged as (
        select
            *
        from
            grouped
        where
            p_page_param is null
            or ref_latest_created_at < p_page_param
        order by
            ref_latest_created_at desc,
            ref_id
        limit
            coalesce(p_page_size, 20)
    )
select
    ref_id,
    ref_latest_created_at,
    items
from
    paged
order by
    ref_latest_created_at desc,
    ref_id;

$$;

grant execute on function public .collection_item_query_grouped(uuid, timestamptz, text, int) to authenticated;