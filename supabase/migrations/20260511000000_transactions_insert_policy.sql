-- Allow the seller of an offer to create the transaction row when accepting.
CREATE POLICY "transactions_insert" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND o.seller_id = auth.uid()
    )
  );
