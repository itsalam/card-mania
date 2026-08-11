-- Track onboarding progress as a categorized JSON blob on user_profile instead
-- of the two separate booleans on user_settings (profile_setup_complete,
-- onboarding_complete). Shape: { profile_setup?: boolean, tour?: boolean }.
--   profile_setup -> post-signup ProfileSetupWizard completion
--   tour          -> spotlight walkthrough (OnboardingProvider/OnboardingOverlay) completion

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.user_profile up
SET onboarding_state = jsonb_build_object(
  'profile_setup', COALESCE(us.profile_setup_complete, false),
  'tour', COALESCE(us.onboarding_complete, false)
)
FROM public.user_settings us
WHERE us.user_id = up.user_id;
