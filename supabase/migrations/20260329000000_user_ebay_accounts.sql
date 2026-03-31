-- Stores eBay seller account connections per user.
-- Used to surface a user's own active eBay listings in search results.
-- OAuth tokens (if stored) should be encrypted via Supabase Vault in production.

CREATE TABLE IF NOT EXISTS public.user_ebay_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebay_username    TEXT        NOT NULL,
  marketplace_id   TEXT        NOT NULL DEFAULT 'EBAY_US',
  -- OAuth tokens for user-level eBay API operations (seller inventory, etc.)
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[]      NOT NULL DEFAULT '{}',
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_ebay_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ebay_accounts_select_own"
  ON public.user_ebay_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_ebay_accounts_insert_own"
  ON public.user_ebay_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_ebay_accounts_update_own"
  ON public.user_ebay_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_ebay_accounts_delete_own"
  ON public.user_ebay_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_user_ebay_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_ebay_accounts_updated_at
  BEFORE UPDATE ON public.user_ebay_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_user_ebay_accounts_updated_at();
