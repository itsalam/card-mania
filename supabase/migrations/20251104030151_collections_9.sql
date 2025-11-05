-- Helpful index (if you don't already have it)
create index if not exists ci_collection_ref_kind on public.collection_items (collection_id, ref_id, item_kind);

-- RPC
create
or replace function public.collection_items_by_ref(
    p_collection_id uuid,
    p_ref_id uuid,
    p_item_kind public.item_kind default 'card'
) returns table (
    id uuid,
    collection_id uuid,
    item_kind public.item_kind,
    ref_id uuid,
    quantity int,
    grade_condition_id uuid,
    grade_label text,
    grade_value numeric(4, 1),
    grading_company_slug text,
    condition text,
    created_at timestamptz,
    updated_at timestamptz
) language sql -- keep as SECURITY INVOKER so your RLS still applies
-- (i.e., only rows the caller is allowed to see will be returned)
security invoker
set
    search_path = public as $$
select
    ci.id,
    ci.collection_id,
    ci.item_kind,
    ci.ref_id,
    ci.quantity,
    ci.grade_condition_id,
    gcnd.label as grade_label,
    gcnd.grade_value as grade_value,
    gcmp.slug as grading_company_slug,
    ci.condition,
    ci.created_at,
    ci.updated_at
from
    public.collection_items ci
    left join public.grade_conditions gcnd on gcnd.id = ci.grade_condition_id
    left join public.grading_companies gcmp on gcmp.id = gcnd.company_id
where
    ci.collection_id = p_collection_id
    and ci.ref_id = p_ref_id
    and ci.item_kind = p_item_kind
order by
    gcnd.grade_value desc nulls last,
    ci.created_at desc;

$$;