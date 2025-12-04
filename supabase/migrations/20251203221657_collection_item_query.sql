-- Cursor-friendly query for collection items with optional search + card join
create
or replace function public .collection_item_query(
    p_collection_id uuid,
    p_page_param timestamptz default null,
    p_search text default null,
    p_page_size int default 20
) returns table (
    id uuid,
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
    card_id uuid,
    card_name text,
    card_set_name text,
    card_latest_price numeric,
    card_grades_prices jsonb,
    card_genre text,
    card_last_updated timestamptz,
    card_front_id text,
    card_back_id text,
    card_extras text [ ]
) language sql stable security invoker
set
    search_path = public as $$
select
    ci.id,
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
    c .id as card_id,
    c .name as card_name,
    c .set_name as card_set_name,
    c .latest_price as card_latest_price,
    c .grades_prices as card_grades_prices,
    c .genre as card_genre,
    c .last_updated as card_last_updated,
    c .front_id as card_front_id,
    c .back_id as card_back_id,
    c .extras as card_extras
from
    public .collection_items ci
    left join public .cards c on ci.item_kind = 'card' :: public .item_kind
    and ci.ref_id = c .id
where
    ci.collection_id = p_collection_id
    and (
        p_page_param is null
        or ci.created_at < p_page_param
    )
    and (
        p_search is null
        or p_search = ''
        or (
            ci.item_kind = 'card' :: public .item_kind
            and c .name ilike ('%' || p_search || '%')
        )
    )
order by
    ci.created_at desc
limit
    coalesce(p_page_size, 20);

$$;

grant execute on function public .collection_item_query(uuid, timestamptz, text, int) to authenticated;