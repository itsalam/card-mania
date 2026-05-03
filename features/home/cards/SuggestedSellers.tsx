import { Text } from '@/components/ui/text/base-text'
import { useSellers } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { useRouter } from 'expo-router'
import React, { ComponentProps } from 'react'
import { Pressable, View } from 'react-native'

type Props = ComponentProps<typeof View>

function toDisplayInfo(s: {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}): UserDisplayInfo {
  return {
    name: s.display_name ?? s.username ?? 'Unknown',
    handle: s.username ?? '',
    avatar: s.avatar_url ?? '',
  }
}

export function SuggestedSellers(props: Props) {
  const { data: sellers = [], isLoading } = useSellers()
  const router = useRouter()

  const rows = isLoading
    ? Array.from({ length: 3 }, (_, i) => ({ id: `skeleton-${i}`, displayInfo: undefined }))
    : sellers.map((s) => ({ id: s.user_id, displayInfo: toDisplayInfo(s) }))

  if (!isLoading && rows.length === 0) return null

  return (
    <View className="w-full px-8" {...props}>
      <View className="h-auto w-full z-1 items-center justify-between flex flex-row">
        <Text className="font-bold">Suggested Sellers</Text>
      </View>
      <View className="w-full flex flex-col pt-4">
        {rows.map(({ id, displayInfo }) => (
          <Pressable
            key={id}
            disabled={id.startsWith('skeleton')}
            onPress={() => router.push(`/user/${id}` as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View className="flex flex-row items-center justify-between gap-4 p-4 py-2">
              <UserContact user={displayInfo} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
