-- Generalized notification system
-- - notifications table with typed envelope (category + type + priority + payload jsonb)
-- - RLS: users only see their own rows
-- - Indexes for inbox query, unread badge count, category filter, payload GIN
-- - Postgres trigger on offers table to write offer_* notifications atomically
-- - Retention: run periodically via pg_cron:
--     DELETE FROM public.notifications WHERE created_at < now() - interval '90 days' AND priority != 'urgent';

CREATE TABLE public.notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type          text        NOT NULL,
  category      text        NOT NULL,  -- 'offer' | 'social' | 'price' | 'system'
  priority      text        NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  title         text        NOT NULL,
  body          text        NOT NULL,
  image_url     text,
  action_url    text,
  payload       jsonb       NOT NULL DEFAULT '{}',
  read_at       timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_created  ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread   ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_category ON public.notifications (user_id, category, created_at DESC);
CREATE INDEX idx_notifications_payload_gin   ON public.notifications USING GIN (payload jsonb_path_ops);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Trigger function writes notifications atomically on offer changes.
-- SECURITY DEFINER so it runs as DB owner and can insert for any user_id.
CREATE OR REPLACE FUNCTION public.notify_offer_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
      'You received a new offer for $' || NEW.total_amount::text,
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
          'Your offer of $' || NEW.total_amount::text || ' was accepted.',
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
          'Your offer of $' || NEW.total_amount::text || ' was declined.',
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
          'A buyer cancelled their offer of $' || NEW.total_amount::text || '.',
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

CREATE TRIGGER offers_notify
  AFTER INSERT OR UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.notify_offer_parties();
