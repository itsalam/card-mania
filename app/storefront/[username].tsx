import { Text } from '@/components/ui/text/base-text'
import ProfilePageLayout from '@/features/profile'
import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export default function PublicStorefrontPage() {
  const { username } = useLocalSearchParams<{ username: string }>()

  const {
    data: userId,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['storefront-user-id', username],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('user_profile')
        .select('user_id')
        .eq('username', username)
        .single()
      if (error) throw error
      return data.user_id as string
    },
    enabled: Boolean(username),
    staleTime: 60 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.$iconDefault} />
      </View>
    )
  }

  if (isError || !userId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text variant="h2">Not found</Text>
        <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>
          No storefront found for @{username}
        </Text>
      </View>
    )
  }

  return <ProfilePageLayout userId={userId} />
}
