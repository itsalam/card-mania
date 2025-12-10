-- Recreate collection_item_query with grade-aware price lookup
drop function if exists public .collection_item_query(uuid, timestamptz, text, int);

create
or replace function public .collection_item_query(
  p_collection_id uuid,
  p_page_param timestamptz default null,
  p_search text default null,
  p_page_size int default 20
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
  search_path = public as $$ with rows as (
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
      coalesce(p_page_size, 20)
  )
select
  r. *,
  coalesce((r.grades_prices ->> r.price_key) :: int, 0) as collection_item_value
from
  rows r;

$$;

grant execute on function public .collection_item_query(uuid, timestamptz, text, int) to authenticated;