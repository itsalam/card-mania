-- offers table
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES auth.users NOT NULL,
  seller_id uuid REFERENCES auth.users NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
  buyer_note text,
  total_amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- offer_items table (line items)
CREATE TABLE offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers ON DELETE CASCADE NOT NULL,
  collection_item_id uuid REFERENCES collection_items NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  offered_price_per_unit numeric(10,2) NOT NULL,
  card_snapshot jsonb -- { title, image_url, card_id } snapshot at offer time
);

-- transactions table (created when offer is accepted)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shipped', 'completed', 'disputed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- offers: buyers and sellers can read their own offers
CREATE POLICY "offers_select" ON offers FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
-- only buyers can create offers
CREATE POLICY "offers_insert" ON offers FOR INSERT WITH CHECK (buyer_id = auth.uid());
-- only sellers can update status (accept/decline), buyers can cancel
CREATE POLICY "offers_update" ON offers FOR UPDATE USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- offer_items: follow the offer's RLS
CREATE POLICY "offer_items_select" ON offer_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
CREATE POLICY "offer_items_insert" ON offer_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_id AND o.buyer_id = auth.uid())
);

-- transactions: buyers and sellers of the linked offer can read
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
