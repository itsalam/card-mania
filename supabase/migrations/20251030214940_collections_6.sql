drop function if exists public.add_to_collection(uuid, public.view_target, uuid, text);

drop function if exists public.add_to_collection(
    uuid,
    public.item_kind,
    uuid,
    text,
    text,
    integer
) cascade;

create
or replace function public.add_to_collection(
    p_collection_id uuid,
    p_item_kind public.item_kind,
    p_ref_id uuid,
    p_grade text default null,
    p_condition text default null,
    p_quantity integer default null,
    p_user uuid default auth.uid()
) returns void language sql security definer
set
    search_path = public as $$ with maxpos as (
        select
            coalesce(max(position), -1) + 1 as next_pos
        from
            public.collection_items
        where
            collection_id = p_collection_id
    )
insert into
    public.collection_items (
        collection_id,
        item_kind,
        ref_id,
        grade,
        condition,
        quantity,
        position,
        user_id
    )
select
    p_collection_id,
    p_item_kind,
    p_ref_id,
    p_grade,
    p_condition,
    p_quantity,
    next_pos,
    p_user
from
    maxpos on conflict (collection_id, item_kind, ref_id) do nothing;

$$;