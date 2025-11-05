-- Helpful index (if you don't already have it)
create index if not exists ci_collection_ref_kind on public.collection_items (collection_id, ref_id, item_kind);

drop function if exists public.collection_items_by_ref(uuid, uuid, public.item_kind);

-- RPC
create
or replace function public.collection_items_by_ref(
    p_collection_id uuid,
    p_ref_id uuid,
    p_item_kind public.item_kind default 'card'
) returns setof public.collection_items language sql -- keep as SECURITY INVOKER so your RLS still applies
-- (i.e., only rows the caller is allowed to see will be returned)
stable security invoker
set
    search_path = public as $$
select
    ci.*
from
    public.collection_items ci
where
    ci.collection_id = p_collection_id
    and ci.ref_id = p_ref_id
    and ci.item_kind = p_item_kind;

$$;