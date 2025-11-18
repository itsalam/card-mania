-- 1) Drop the old uniqueness that referenced condition_key
DROP INDEX IF EXISTS public .collection_items_unique_entry;

-- 2) Remove generated column first (it depends on condition), then the source column
ALTER TABLE
    public .collection_items DROP COLUMN IF EXISTS condition_key,
    DROP COLUMN IF EXISTS condition;

-- 3) Ensure id is primary key (it already has DEFAULT gen_random_uuid())
-- (If your DB didn't have pgcrypto enabled earlier, ensure: CREATE EXTENSION IF NOT EXISTS pgcrypto;)
ALTER TABLE
    public .collection_items
ADD
    CONSTRAINT collection_items_pkey PRIMARY KEY (id);

-- 4) Add a composite index “based on the prior primary key”
--    but with user_id included instead of condition_key
CREATE INDEX IF NOT EXISTS ci_collection_item_ref_grade_user ON public .collection_items USING btree (
    collection_id,
    item_kind,
    ref_id,
    grade_condition_id,
    user_id
);

-- RPC
create
or replace function public .collection_items_by_ref(
    p_collection_id uuid,
    p_ref_id uuid,
    p_item_kind public .item_kind default 'card'
) returns setof public .collection_items language sql stable security invoker
set
    search_path = public as $$ with ci as (
        select
            *
        from
            public .collection_items
        where
            collection_id = p_collection_id
            and ref_id = p_ref_id
            and item_kind = p_item_kind
    ),
    gc as (
        -- only grade conditions actually referenced by the filtered rows
        select
            *
        from
            public .grade_conditions
        where
            id in (
                select
                    grade_condition_id
                from
                    ci
                where
                    grade_condition_id is not null
            )
    )
select
    ci. * -- keep original return type
from
    ci full
    join gc on ci.grade_condition_id = gc.id;

$$;