-- Returns sellers who have at least one storefront collection item with quantity > 0.
-- Excludes the calling user when exclude_user_id is provided.
CREATE OR REPLACE FUNCTION public.get_suggested_sellers(
  exclude_user_id uuid DEFAULT NULL,
  result_limit int DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_seller boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (up.user_id)
    up.user_id,
    up.username,
    up.display_name,
    up.avatar_url,
    up.is_seller
  FROM public.user_profile up
  JOIN public.collections c
    ON c.user_id = up.user_id
   AND c.is_storefront = true
  JOIN public.collection_items ci
    ON ci.collection_id = c.id
   AND ci.quantity > 0
  WHERE up.is_seller = true
    AND (exclude_user_id IS NULL OR up.user_id != exclude_user_id)
  ORDER BY up.user_id
  LIMIT result_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_suggested_sellers(uuid, int) TO authenticated, anon;
