-- 1️⃣ Drop old constraints and primary key (if needed)
ALTER TABLE
    public.collection_items DROP CONSTRAINT IF EXISTS collection_items_pkey,
    DROP CONSTRAINT IF EXISTS collection_items_collection_fk;

-- 2️⃣ Add a single reference to grade_conditions
ALTER TABLE
    public.collection_items
ADD
    COLUMN grade_condition_id uuid REFERENCES public.grade_conditions(id) ON DELETE
SET
    NULL;

-- 3️⃣ Drop the old text-based grade column
ALTER TABLE
    public.collection_items DROP COLUMN IF EXISTS grade;

-- 4️⃣ Add a UUID primary key if not present
ALTER TABLE
    public.collection_items
ADD
    COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- 5️⃣ Recreate the foreign key to collections
ALTER TABLE
    public.collection_items
ADD
    CONSTRAINT collection_items_collection_fk FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

-- 6️⃣ Optional: maintain logical uniqueness to prevent accidental duplicates
CREATE UNIQUE INDEX IF NOT EXISTS collection_items_unique_entry ON public.collection_items (
    collection_id,
    item_kind,
    ref_id,
    grade_condition_id,
    condition_key
);