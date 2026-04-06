import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text/base-text'
import { getUserStoreFront } from '@/features/profile/client'
import { StorefrontView } from '@/features/profile/components/storefront-view'
import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export default function PublicStorefrontPage() {
  const { username } = useLocalSearchParams<{ username: string }>()

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-storefront-profile', username],
    queryFn: async () => {
      if (!username) return null
      const { data } = await getSupabase()
        .from('user_profile')
        .select('user_id, username, display_name, avatar_url, bio')
        .eq('username', username)
        .single()
      return data ?? null
    },
    enabled: Boolean(username),
  })

  const { data: collections, isLoading: isLoadingCollections } = useQuery({
    queryKey: ['public-storefront-collections', profile?.user_id],
    queryFn: () => getUserStoreFront(profile?.user_id),
    enabled: Boolean(profile?.user_id),
  })

  const isLoading = isLoadingProfile || (Boolean(profile?.user_id) && isLoadingCollections)

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text variant="h2">Not found</Text>
        <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>
          No storefront found for @{username}
        </Text>
      </View>
    )
  }

  const initials = profile.display_name?.[0]?.toUpperCase() ?? '?'

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      {/* Profile header */}
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 32,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.$outlineNeutralLight,
          marginBottom: 24,
        }}
      >
        <Avatar size="2xl">
          {profile.avatar_url ? <AvatarImage source={{ uri: profile.avatar_url }} /> : null}
          <AvatarFallback>
            <AvatarFallbackText>{initials}</AvatarFallbackText>
          </AvatarFallback>
        </Avatar>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="h2">{profile.display_name ?? profile.username}</Text>
          <Text variant="muted">@{profile.username}</Text>
        </View>

        {profile.bio ? (
          <Text
            variant="default"
            style={{ textAlign: 'center', maxWidth: 360, color: Colors.$textNeutralHeavy }}
          >
            {profile.bio}
          </Text>
        ) : null}
      </View>

      {/* Storefront collections */}
      {!collections?.length ? (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Text variant="muted">No storefront collections yet.</Text>
        </View>
      ) : (
        collections.map((collection) => (
          <View key={collection.id} style={{ marginBottom: 28 }}>
            <Text variant="h3" style={{ marginBottom: 4 }}>
              {collection.name}
            </Text>
            {collection.description ? (
              <Text variant="muted" style={{ marginBottom: 10 }}>
                {collection.description}
              </Text>
            ) : null}
            <StorefrontView collectionId={collection.id} />
          </View>
        ))
      )}

      {/* Footer CTA */}
      <View
        style={{
          marginTop: 32,
          alignItems: 'center',
          padding: 20,
          borderRadius: 16,
          backgroundColor: Colors.$backgroundElevated,
          gap: 8,
        }}
      >
        <Text variant="large" style={{ fontWeight: '600' }}>
          CardMania
        </Text>
        <Text variant="muted" style={{ textAlign: 'center' }}>
          View and trade sports cards on the CardMania app
        </Text>
      </View>
    </ScrollView>
  )
}
