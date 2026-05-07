-- Fix offer notification bodies: total_amount is stored in cents,
-- so divide by 100 and format with 2 decimal places before embedding in text.

CREATE OR REPLACE FUNCTION public.notify_offer_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fmt_amount text;
BEGIN
  fmt_amount := '$' || to_char(NEW.total_amount / 100.0, 'FM999999990.00');

  -- INSERT: notify seller of new offer received
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications
      (user_id, type, category, priority, title, body, action_url, payload)
    VALUES (
      NEW.seller_id,
      'offer_received',
      'offer',
      'high',
      'New Offer Received',
      'You received a new offer for ' || fmt_amount,
      '/offers?view=inbox',
      jsonb_build_object(
        'offer_id',     NEW.id,
        'buyer_id',     NEW.buyer_id,
        'total_amount', NEW.total_amount
      )
    );

  -- UPDATE: notify relevant party when status changes
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'accepted' THEN
        INSERT INTO public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        VALUES (
          NEW.buyer_id,
          'offer_accepted',
          'offer',
          'high',
          'Offer Accepted!',
          'Your offer of ' || fmt_amount || ' was accepted.',
          '/offers?view=my-offers',
          jsonb_build_object(
            'offer_id',     NEW.id,
            'seller_id',    NEW.seller_id,
            'total_amount', NEW.total_amount
          )
        );
      WHEN 'declined' THEN
        INSERT INTO public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        VALUES (
          NEW.buyer_id,
          'offer_declined',
          'offer',
          'normal',
          'Offer Declined',
          'Your offer of ' || fmt_amount || ' was declined.',
          '/offers?view=my-offers',
          jsonb_build_object(
            'offer_id',     NEW.id,
            'seller_id',    NEW.seller_id,
            'total_amount', NEW.total_amount
          )
        );
      WHEN 'cancelled' THEN
        INSERT INTO public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        VALUES (
          NEW.seller_id,
          'offer_cancelled',
          'offer',
          'normal',
          'Offer Cancelled',
          'A buyer cancelled their offer of ' || fmt_amount || '.',
          '/offers?view=inbox',
          jsonb_build_object(
            'offer_id',     NEW.id,
            'buyer_id',     NEW.buyer_id,
            'total_amount', NEW.total_amount
          )
        );
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;
