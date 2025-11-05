-- 1️⃣  Add grading_company and variants fields
alter table
    public.collection_items
add
    column grading_company text,
add
    column variants text [] default '{}';

-- 2️⃣  Create card_variants table
-- This table links cards to possible variants (e.g., parallel, holo, promo, etc.)
-- Similar to how collections and collection_tags work.
create table if not exists public.card_variants (
    id uuid primary key default gen_random_uuid(),
    card_id uuid not null references public.cards(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    unique (card_id, name)
);

-- 3️⃣  Recreate primary key for collection_items
-- First, drop the old primary key constraint
alter table
    public.collection_items drop constraint collection_items_pkey;

-- Add a new self-referencing UUID primary key
alter table
    public.collection_items
add
    column id uuid primary key default gen_random_uuid();

-- Keep collection_id as a foreign key to collections
alter table
    public.collection_items
add
    constraint collection_items_collection_fk foreign key (collection_id) references public.collections(id) on delete cascade;

-- Optional: If you still want to prevent duplicates of identical (collection_id, item_kind, ref_id, grade, condition_key)
-- while allowing multiple “duplicate” entries with separate ids, use a partial unique index:
create unique index on public.collection_items (
    collection_id,
    item_kind,
    ref_id,
    grade,
    condition_key
)
where
    quantity > 0;