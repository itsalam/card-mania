-- Add grouping support to collection_item_query via optional p_group flag
drop function if exists public .collection_item_query(uuid, timestamptz, text, int);

drop function if exists public .collection_item_query(uuid, timestamptz, text, int, boolean);

create
or replace function public .collection_item_query(
    p_collection_id uuid,
    p_page_param timestamptz default null,
    p_search text default null,
    p_page_size int default 20,
    p_group boolean default false
) returns table (
    collection_item_id uuid,
    collection_id uuid,
    user_id uuid,
    item_kind public .item_kind,
    ref_id uuid,
    grade_condition_id uuid,
    grading_company text,
    "position" int,
    quantity int,
    variants text [ ],
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
    extras text [ ],
    price_key text,
    collection_item_value int
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
            coalesce(gc.slug || gcnd.grade_value :: text, 'ungraded') as price_key,
            max(ci.created_at) over (partition by ci.ref_id) as ref_latest_created_at,
            row_number() over (
                partition by ci.ref_id
                order by
                    ci.created_at desc
            ) as ref_rownum
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
    ranked as (
        select
            *,
            dense_rank() over (
                order by
                    ref_latest_created_at desc,
                    ref_id
            ) as ref_rank
        from
            base
    ),
    filtered as (
        select
            *
        from
            ranked
        where
            (
                p_group = false
                and (
                    p_page_param is null
                    or created_at < p_page_param
                )
            )
            or (
                p_group = true
                and ref_rownum = 1
                and (
                    p_page_param is null
                    or ref_latest_created_at < p_page_param
                )
                and ref_rank <= coalesce(p_page_size, 20)
            )
    )
select
    r.collection_item_id,
    r.collection_id,
    r.user_id,
    r.item_kind,
    r.ref_id,
    r.grade_condition_id,
    r.grading_company,
    r. "position",
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
    coalesce((r.grades_prices ->> r.price_key) :: int, 0) as collection_item_value
from
    filtered r
order by
    case
        when p_group then r.ref_latest_created_at
        else r.created_at
    end desc,
    r.collection_item_id
limit
    case
        when p_group then coalesce(p_page_size, 20)
        else coalesce(p_page_size, 20)
    end;

$$;

grant execute on function public .collection_item_query(uuid, timestamptz, text, int, boolean) to authenticated;