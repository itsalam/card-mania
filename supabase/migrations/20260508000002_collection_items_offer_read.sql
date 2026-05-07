-- Without this policy buyers see empty grading/condition on transaction and offer screens
-- because the existing RLS only allows the row owner (or storefront collections) to read
-- collection_items. Offer participants need read access to the items that are part of
-- their deal.

-- Index so the RLS EXISTS subquery stays fast.
CREATE INDEX IF NOT EXISTS offer_items_collection_item_id_idx
  ON public.offer_items(collection_item_id);

CREATE POLICY "collection_items_offer_participant_read"
  ON public.collection_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.offer_items oi
      JOIN public.offers o ON o.id = oi.offer_id
      WHERE oi.collection_item_id = collection_items.id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );
