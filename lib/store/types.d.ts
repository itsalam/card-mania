// lib/types.ts

import { Database } from '@/lib/store/supabase'

export type AuthStatusType = 'idle' | 'loading' | 'authenticated' | 'signed_out' | 'error'

// Categorized onboarding completion flags, persisted as user_profile.onboarding_state.
//   profile_setup   -> post-signup ProfileSetupWizard completion
//   tour            -> main spotlight walkthrough (OnboardingProvider/OnboardingOverlay) completion
//   collection_tour -> Collections-tab spotlight walkthrough (see features/onboarding's
//                      COLLECTION_TOUR_STEPS) completion
//   add_card_tour   -> Add-to-collection search screen's spotlight walkthrough (see
//                      features/onboarding's ADD_CARD_TOUR_STEPS) completion — its own flag,
//                      isolated from collection_tour
//   offer_tour      -> "Send your first offer" spotlight walkthrough (see features/onboarding's
//                      OFFERS_TOUR_STEPS) completion — its own flag, isolated from the others
export type OnboardingStateFlags = {
  profile_setup?: boolean
  tour?: boolean
  collection_tour?: boolean
  add_card_tour?: boolean
  offer_tour?: boolean
}

export type Profile = Omit<
  Database['public']['Tables']['user_profile']['Row'],
  'onboarding_state'
> & {
  onboarding_state: OnboardingStateFlags
}
export type DatabaseEnum = Database['public']['Enums']
