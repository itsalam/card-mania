-- 1) Ensure image_search_cache.query_hash is unique (keyed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'image_search_cache_query_hash_key'
  ) THEN
    ALTER TABLE public.image_search_cache
      ADD CONSTRAINT image_search_cache_query_hash_key UNIQUE (query_hash);
  END IF;
END$$;

-- 2) Add query_hash to image_cache, and relate it to image_search_cache(query_hash)
ALTER TABLE public.image_cache
  ADD COLUMN IF NOT EXISTS query_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'image_cache_query_hash_fkey'
  ) THEN
    ALTER TABLE public.image_cache
      ADD CONSTRAINT image_cache_query_hash_fkey
      FOREIGN KEY (query_hash)
      REFERENCES public.image_search_cache(query_hash)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3) Index lookups by query_hash
CREATE INDEX IF NOT EXISTS image_cache_query_hash_idx
  ON public.image_cache(query_hash);

-- 4) (Optional but very handy) one “top” image per query_hash
ALTER TABLE public.image_cache
  ADD COLUMN IF NOT EXISTS is_top_for_query boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS image_cache_one_top_per_query_uniq
  ON public.image_cache(query_hash)
  WHERE is_top_for_query;

-- 5) (Optional) store the chosen top image on the search row itself
ALTER TABLE public.image_search_cache
  ADD COLUMN IF NOT EXISTS top_image_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'image_search_cache_top_image_fk'
  ) THEN
    ALTER TABLE public.image_search_cache
      ADD CONSTRAINT image_search_cache_top_image_fk
      FOREIGN KEY (top_image_id)
      REFERENCES public.image_cache(id)
      ON DELETE SET NULL;
  END IF;
END$$;
