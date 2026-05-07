-- offer_items.collection_item_id is a soft reference to the seller's inventory row.
-- The column must be nullable first so ON DELETE SET NULL can work.
ALTER TABLE public.offer_items
  ALTER COLUMN collection_item_id DROP NOT NULL;

ALTER TABLE public.offer_items
  DROP CONSTRAINT IF EXISTS offer_items_collection_item_id_fkey;

ALTER TABLE public.offer_items
  ADD CONSTRAINT offer_items_collection_item_id_fkey
  FOREIGN KEY (collection_item_id)
  REFERENCES public.collection_items(id)
  ON DELETE SET NULL;
