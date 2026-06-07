import { useUserStore } from '@/lib/store/useUserStore'

export function useWebUser() {
  const user = useUserStore((s) => s.user)
  const profile = useUserStore((s) => s.profile)
  if (!user || user.is_anonymous) return null
  // Return profile if loaded; fall back to minimal user info so callers can tell
  // the user is authenticated even while loadProfile() is still in-flight.
  return (
    profile ?? {
      user_id: user.id,
      display_name: user.email ?? null,
      username: null,
      avatar_url: null,
    }
  )
}
