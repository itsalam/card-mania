import { SplashPage } from '@/features/splash'
import { useUserStore } from '@/lib/store/useUserStore'
import { Redirect } from 'expo-router'

export default function SignUpRoute() {
  const user = useUserStore((s) => s.user)
  if (user && !user.is_anonymous) return <Redirect href="/(tabs)" />
  return <SplashPage initialSignUp />
}
