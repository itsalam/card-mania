-- Relax the quantity check on collection_items from > 0 to >= 0 so that
-- fully-sold items can reach zero. Storefront views already filter quantity > 0,
-- so zero-stock items are hidden from listings automatically.
ALTER TABLE public.collection_items
  DROP CONSTRAINT IF EXISTS collection_items_quantity_check;

ALTER TABLE public.collection_items
  ADD CONSTRAINT collection_items_quantity_check CHECK (quantity >= 0);

-- Retroactively create transaction rows for offers that were accepted before the
-- transactions_after_insert trigger existed. The trigger fires on each INSERT,
-- so inventory is decremented for each backfilled row automatically.
INSERT INTO public.transactions (offer_id)
SELECT o.id
FROM public.offers o
WHERE o.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.offer_id = o.id
  );
