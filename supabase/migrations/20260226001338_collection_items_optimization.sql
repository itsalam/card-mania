create index if not exists collection_items_collection_ref_created_at_idx on public .collection_items (collection_id, ref_id, created_at desc);

create extension if not exists pg_trgm;

create index if not exists cards_name_trgm_idx on public .cards using gin (name gin_trgm_ops);

drop function if exists public .collection_item_query_grouped_slim(uuid, timestamptz, text, int);

create
or replace function public .collection_item_query_grouped_slim(
    p_collection_id uuid,
    p_page_param timestamptz default null,
    p_search text default null,
    p_page_size int default 20
) returns jsonb language sql stable security invoker
set
    search_path = public as $$ with candidates as (
        -- Find groups (ref_id) ordered by latest activity, optionally filtered by search.
        select
            ci.ref_id,
            max(ci.created_at) as ref_latest_created_at
        from
            public .collection_items ci
            left join public .cards c on ci.item_kind = 'card' :: public .item_kind
            and ci.ref_id = c .id
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
        group by
            ci.ref_id
    ),
    page as (
        select
            ref_id,
            ref_latest_created_at
        from
            candidates
        where
            p_page_param is null
            or ref_latest_created_at < p_page_param
        order by
            ref_latest_created_at desc,
            ref_id
        limit
            coalesce(p_page_size, 20)
    ),
    card_meta as (
        -- One row per ref_id with card fields (only for card kind)
        select
            p.ref_id,
            jsonb_build_object(
                'id',
                c .id,
                'name',
                c .name,
                'set_name',
                c .set_name,
                'latest_price',
                c .latest_price,
                'genre',
                c .genre,
                'last_updated',
                c .last_updated,
                'front_id',
                c .front_id,
                'back_id',
                c .back_id,
                'extras',
                c .extras
            ) as card
        from
            page p
            left join public .cards c on c .id = p.ref_id
    ),
    items as (
        select
            ci.ref_id,
            jsonb_agg(
                jsonb_build_object(
                    'id',
                    ci.id,
                    'collection_id',
                    ci.collection_id,
                    'user_id',
                    ci.user_id,
                    'item_kind',
                    ci.item_kind,
                    'grade_condition_id',
                    ci.grade_condition_id,
                    'grading_company',
                    ci.grading_company,
                    'position',
                    ci.position,
                    'quantity',
                    ci.quantity,
                    'variants',
                    ci.variants,
                    'created_at',
                    ci.created_at,
                    'updated_at',
                    ci.updated_at,
                    'price_key',
                    coalesce(gc.slug || gcnd.grade_value :: text, 'ungraded'),
                    'collection_item_value',
                    coalesce(
                        (
                            c .grades_prices ->> coalesce(gc.slug || gcnd.grade_value :: text, 'ungraded')
                        ) :: int,
                        0
                    )
                )
                order by
                    ci.created_at desc,
                    ci.id
            ) as items
        from
            public .collection_items ci
            join page p on p.ref_id = ci.ref_id
            left join public .cards c on ci.item_kind = 'card' :: public .item_kind
            and ci.ref_id = c .id
            left join public .grade_conditions gcnd on gcnd.id = ci.grade_condition_id
            left join public .grading_companies gc on gc.id = gcnd.company_id
        where
            ci.collection_id = p_collection_id
        group by
            ci.ref_id
    )
select
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'ref_id',
                p.ref_id,
                'ref_latest_created_at',
                p.ref_latest_created_at,
                'card',
                cm.card,
                'items',
                it.items
            )
            order by
                p.ref_latest_created_at desc,
                p.ref_id
        ),
        '[]' :: jsonb
    )
from
    page p
    left join card_meta cm on cm.ref_id = p.ref_id
    left join items it on it.ref_id = p.ref_id;

$$;

grant execute on function public .collection_item_query_grouped_slim(uuid, timestamptz, text, int) to authenticated;