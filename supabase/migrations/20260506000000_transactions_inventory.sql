-- Allow buyer and seller to update their transaction row
CREATE POLICY "transactions_update" ON public.transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Decrement collection_items.quantity for each offer_item when a transaction is created (offer accepted).
-- Uses GREATEST(0, ...) to floor at zero; the transactions.offer_id UNIQUE constraint prevents
-- a second insert for the same offer so double-decrement is impossible.
CREATE OR REPLACE FUNCTION public.decrement_inventory_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.collection_items ci
  SET quantity = GREATEST(0, ci.quantity - oi.quantity)
  FROM public.offer_items oi
  WHERE oi.offer_id = NEW.offer_id
    AND oi.collection_item_id = ci.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_after_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.decrement_inventory_on_transaction();
