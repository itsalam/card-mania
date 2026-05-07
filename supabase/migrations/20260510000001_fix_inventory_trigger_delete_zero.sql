-- Fix: after decrementing inventory, delete rows whose quantity hit 0
-- rather than leaving them with quantity = 0.
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

  DELETE FROM public.collection_items ci
  USING public.offer_items oi
  WHERE oi.offer_id = NEW.offer_id
    AND oi.collection_item_id = ci.id
    AND ci.quantity = 0;

  RETURN NEW;
END;
$$;
