-- Returns true if a non-anonymous, non-deleted user exists for the given email.
-- Used by the client to route email entry to sign-in vs sign-up without side effects.
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE email = lower(trim(p_email))
      AND (is_anonymous IS NULL OR is_anonymous = false)
      AND deleted_at IS NULL
  )
$$;
