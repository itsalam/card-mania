-- The FK was changed to ON DELETE SET NULL in 20260510000000, but the
-- NOT NULL constraint was added after that migration was already applied.
-- This migration drops the constraint so the cascade can actually set NULL.
ALTER TABLE public.offer_items
  ALTER COLUMN collection_item_id DROP NOT NULL;
