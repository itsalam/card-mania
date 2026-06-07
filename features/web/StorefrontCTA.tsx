import { Text } from '@/components/ui/text/base-text'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { Link } from 'expo-router'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useSampleStorefronts } from './hooks/useSampleStorefronts'

export default function StorefrontCTA() {
  const { data: storefronts } = useSampleStorefronts()

  if (!storefronts?.length) return null

  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: Colors.$outlineNeutralLight,
        gap: 20,
      }}
    >
      <Text variant="h3" style={{ textAlign: 'center' }}>
        See a live storefront
      </Text>
      <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {storefronts.map(({ username, display_name, avatar_url }) => {
          const user: UserDisplayInfo = {
            name: display_name ?? username,
            handle: `@${username}`,
            avatar: avatar_url ?? '',
          }
          return (
            <Link key={username} href={`/${username}` as any}>
              <UserContact user={user} size="md" variant="outline" />
            </Link>
          )
        })}
      </View>
    </View>
  )
}
