import { CollectionPreview } from '@/features/collection/components/CollectionPreview'
import { View } from 'react-native'
import { useUserStorefront } from '../client'
import { useUserProfilePage } from '../providers'

export function StorefrontPage() {
  const profile = useUserProfilePage((s) => s.user)
  const { data: collections } = useUserStorefront(profile?.user_id)
  return (
    <View>
      {(collections ?? Array(3).fill(undefined)).map((collection, index) => (
        <CollectionPreview key={`${collection?.id ?? index}`} collectionId={collection?.id} />
      ))}
    </View>
  )
}
