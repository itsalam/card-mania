-- Migrate wishlist_toggle to use wishlist-backed collections/collection_items
drop function if exists public .wishlist_toggle(text, uuid, jsonb);

create
or replace function public .wishlist_toggle(
    p_kind text,
    p_ref_id uuid,
    p_metadata jsonb default '{}' :: jsonb
) returns table(is_wishlisted boolean) language plpgsql security definer
set
    search_path = public as $$
declare
    v_user uuid := auth.uid();

v_collection_id uuid;

v_item_id uuid;

v_variants text [ ];

v_meta jsonb := coalesce(p_metadata, '{}' :: jsonb);

begin
    if v_user is null then raise
    exception
        'Not authenticated';

end if;

-- Resolve wishlist collection for this user
select
    w.collection_id into v_collection_id
from
    public .wishlist w
where
    w.user_id = v_user;

if v_collection_id is null then raise
exception
    'Wishlist collection not found for user %',
    v_user;

end if;

-- Try delete first (acts as toggle off)
delete from
    public .collection_items
where
    collection_id = v_collection_id
    and user_id = v_user
    and item_kind = p_kind :: public .item_kind
    and ref_id = p_ref_id;

if found then return query
select
    false as is_wishlisted;

return;

end if;

-- Normalize metadata.grades -> variants array
select
    coalesce(
        array_agg(
            distinct g
            order by
                g
        ),
        '{}' :: text [ ]
    ) into v_variants
from
    jsonb_array_elements_text(coalesce(v_meta -> 'grades', '[]' :: jsonb)) as t(g);

-- Insert new wishlist row into collection_items
insert into
    public .collection_items (
        collection_id,
        user_id,
        item_kind,
        ref_id,
        variants,
        quantity,
        position
    )
values
    (
        v_collection_id,
        v_user,
        p_kind :: public .item_kind,
        p_ref_id,
        case
            when array_length(v_variants, 1) > 0 then v_variants
            else null
        end,
        1,
        0
    ) returning id into v_item_id;

return query
select
    true as is_wishlisted;

end;

$$;

grant execute on function public .wishlist_toggle(text, uuid, jsonb) to authenticated;