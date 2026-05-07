-- Trigger function: inserts notifications for transaction status transitions.
-- Buyer-initiated transitions (completed) notify the seller.
-- Seller-initiated transitions (shipped) notify the buyer.
-- Disputes notify both parties since either can initiate.
CREATE OR REPLACE FUNCTION public.notify_transaction_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id  uuid;
  v_seller_id uuid;
BEGIN
  -- No-op if status didn't actually change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT buyer_id, seller_id
    INTO v_buyer_id, v_seller_id
    FROM public.offers
   WHERE id = NEW.offer_id;

  CASE NEW.status
    WHEN 'shipped' THEN
      -- Seller ships → notify buyer
      INSERT INTO public.notifications
        (user_id, type, category, priority, title, body, action_url, payload)
      VALUES (
        v_buyer_id,
        'transaction_shipped',
        'transaction',
        'high',
        'Order Shipped!',
        'The seller has shipped your order.',
        '/transactions/' || NEW.offer_id,
        jsonb_build_object('offer_id', NEW.offer_id, 'transaction_id', NEW.id)
      );

    WHEN 'completed' THEN
      -- Buyer confirms receipt → notify seller
      INSERT INTO public.notifications
        (user_id, type, category, priority, title, body, action_url, payload)
      VALUES (
        v_seller_id,
        'transaction_completed',
        'transaction',
        'high',
        'Deal Complete!',
        'The buyer confirmed receipt. The deal is done.',
        '/transactions/' || NEW.offer_id,
        jsonb_build_object('offer_id', NEW.offer_id, 'transaction_id', NEW.id)
      );

    WHEN 'disputed' THEN
      -- Either party can open a dispute — notify both
      INSERT INTO public.notifications
        (user_id, type, category, priority, title, body, action_url, payload)
      VALUES
        (
          v_buyer_id,
          'transaction_disputed',
          'transaction',
          'urgent',
          'Dispute Opened',
          'A dispute has been opened on this transaction.',
          '/transactions/' || NEW.offer_id,
          jsonb_build_object('offer_id', NEW.offer_id, 'transaction_id', NEW.id)
        ),
        (
          v_seller_id,
          'transaction_disputed',
          'transaction',
          'urgent',
          'Dispute Opened',
          'A dispute has been opened on this transaction.',
          '/transactions/' || NEW.offer_id,
          jsonb_build_object('offer_id', NEW.offer_id, 'transaction_id', NEW.id)
        );

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_notify
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_transaction_parties();
