import { ProfileSetupWizard } from '@/features/onboarding/ProfileSetupWizard'
import { useUserStore } from '@/lib/store/useUserStore'

export function WebOnboardingGate() {
  const status = useUserStore((s) => s.status)
  const user = useUserStore((s) => s.user)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)

  if (status !== 'authenticated') return null

  // Anonymous sessions (auto-created after sign-out for public RLS) never need setup
  if (user?.is_anonymous) return null

  // null means profile hasn't loaded yet — don't flash the wizard prematurely
  if (profileSetupComplete === null) return null

  if (!profileSetupComplete) return <ProfileSetupWizard />

  // Spotlight tour is native-only for now
  return null
}
