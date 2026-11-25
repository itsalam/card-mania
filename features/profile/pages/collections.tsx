import { Text } from '@/components/ui/text/base-text'
import { useUserStore } from '@/lib/store/useUserStore'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useUserCollections } from '../client'
import { StorefrontView } from '../components/storefront-view'
import { useUserProfilePage } from '../providers'

// ITS-124: the profile Collections tab. Each collection renders like a storefront collection
// (info header + items) but read-only.
//
// Design refs (Mobbin): Cosmos profile, a Collections tab beside Profile that lists the
// owner's collections and marks private ones
// (https://mobbin.com/screens/e81d4470-fbac-422f-83a7-2a5452264a06); Mindtrip profile,
// another user's public collections under a Collections tab
// (https://mobbin.com/screens/841bbe34-837c-48bf-b169-3b63dcfc4eb6).
export function CollectionsPage() {
  const profile = useUserProfilePage((s) => s.user)
  const authUserId = useUserStore((s) => s.user?.id)
  const isOwnProfile = !!authUserId && authUserId === profile?.user_id
  const { data: collections, isPending } = useUserCollections(profile?.user_id, isOwnProfile)

  if (!isPending && !collections?.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 }}>
        <Text variant="h3" style={{ color: Colors.$textNeutral }}>
          No collections yet
        </Text>
        <Text variant="default" style={{ color: Colors.$textNeutralLight, textAlign: 'center' }}>
          {isOwnProfile
            ? 'Collections you create show up here. Set one to Public to share it on your profile.'
            : "This collector hasn't shared any collections."}
        </Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 16, padding: 8 }}>
      {(collections ?? []).map((c) => (
        <StorefrontView
          key={c.id}
          collectionId={c.id ?? undefined}
          isOwnProfile={isOwnProfile}
          variant="collection"
        />
      ))}
    </View>
  )
}
