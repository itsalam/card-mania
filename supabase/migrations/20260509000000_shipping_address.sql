-- Shipping address stored on the user profile (for pre-filling) and
-- confirmed per-transaction on the transactions row.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS buyer_shipping_address jsonb;
