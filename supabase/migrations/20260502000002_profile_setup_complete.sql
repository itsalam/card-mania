-- Add profile_setup_complete to user_settings.
-- Controls whether the post-verification profile wizard has been completed.
-- Backfill: existing users who finished the spotlight onboarding tour are
-- considered done (they set their profile via the old sign-up form).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS profile_setup_complete boolean NOT NULL DEFAULT false;

UPDATE user_settings
  SET profile_setup_complete = true
  WHERE onboarding_complete = true;

-- Keep the provisioning trigger explicit (column default covers it,
-- but spelling it out makes the intent clear).
CREATE OR REPLACE FUNCTION public.trg_user_profile_provision_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, onboarding_complete, profile_setup_complete)
  VALUES (NEW.user_id, false, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
