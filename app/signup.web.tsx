import { AuthModal } from '@/features/web/AuthModal'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

export default function SignUpWebRoute() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const isAuthenticated = !!user && !user.is_anonymous

  useEffect(() => {
    if (isAuthenticated) router.replace('/(tabs)' as any)
  }, [isAuthenticated])

  return (
    <View style={{ flex: 1 }}>
      <AuthModal onClose={() => router.replace('/')} showSmsConsent />
    </View>
  )
}
