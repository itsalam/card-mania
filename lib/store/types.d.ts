// lib/types.ts

import { Database } from '@/lib/store/supabase'

export type AuthStatusType = 'idle' | 'loading' | 'authenticated' | 'signed_out' | 'error'

// Categorized onboarding completion flags, persisted as user_profile.onboarding_state.
//   profile_setup -> post-signup ProfileSetupWizard completion
//   tour          -> spotlight walkthrough (OnboardingProvider/OnboardingOverlay) completion
export type OnboardingStateFlags = {
  profile_setup?: boolean
  tour?: boolean
}

export type Profile = Omit<
  Database['public']['Tables']['user_profile']['Row'],
  'onboarding_state'
> & {
  onboarding_state: OnboardingStateFlags
}
export type DatabaseEnum = Database['public']['Enums']
