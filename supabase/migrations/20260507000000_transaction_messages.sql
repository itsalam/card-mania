CREATE TABLE public.transaction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transaction_messages_transaction_id_created_at
  ON public.transaction_messages(transaction_id, created_at);

ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;

-- Only the buyer and seller of the associated transaction can read messages
CREATE POLICY "transaction_messages_select" ON public.transaction_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.offers o ON o.id = t.offer_id
      WHERE t.id = transaction_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Only the buyer and seller can send messages; sender_id must match the caller
CREATE POLICY "transaction_messages_insert" ON public.transaction_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.offers o ON o.id = t.offer_id
      WHERE t.id = transaction_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_messages;
