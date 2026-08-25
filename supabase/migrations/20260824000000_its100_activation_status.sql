-- ITS-100: Track activation conditions (storefront/collection/offer) in onboarding_state
--
-- ITS-51's recorded activation decision: a user is "activated" once they have ANY of —
-- a listed storefront, a collection item (1+ card), or a sent/received offer. These
-- facts already exist in storefronts/collection_items/offers, so this reads them live
-- at call time rather than duplicating them into a new manually-maintained flag on
-- user_profile.onboarding_state, which could drift out of sync with the source tables.
--
-- SECURITY INVOKER (the default — no SECURITY DEFINER) is enough here: every table this
-- reads already grants a user SELECT on their own rows via existing RLS policies
-- (collection_items_owner_all, offers_select, storefronts_owner_all), so scoping to the
-- caller via auth.uid() needs no separate authorization logic.
CREATE OR REPLACE FUNCTION public.get_activation_status()
RETURNS TABLE (
  has_storefront boolean,
  has_collection_item boolean,
  has_offer boolean,
  activated boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    has_storefront,
    has_collection_item,
    has_offer,
    has_storefront OR has_collection_item OR has_offer AS activated
  FROM (
    SELECT
      EXISTS (
        SELECT 1 FROM public.storefronts s
        WHERE s.user_id = auth.uid() AND s.is_listed = true
      ) AS has_storefront,
      EXISTS (
        SELECT 1 FROM public.collection_items ci
        WHERE ci.user_id = auth.uid() AND ci.quantity > 0
      ) AS has_collection_item,
      EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.buyer_id = auth.uid() OR o.seller_id = auth.uid()
      ) AS has_offer
  ) conditions;
$$;

GRANT EXECUTE ON FUNCTION public.get_activation_status() TO authenticated;
