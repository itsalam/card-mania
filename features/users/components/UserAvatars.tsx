import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text'
import React, { ComponentProps, useMemo } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { UserDisplayInfo } from '../types'

export const UserAvatar = ({
  user,
  size = 'md',
}: { user: UserDisplayInfo } & Pick<ComponentProps<typeof Avatar>, 'size'>) => {
  const uri = useMemo(() => `https://picsum.photos/seed/${Math.random()}/200/200`, [])

  const sizeToTextSize = {
    md: 'default',
    sm: 'small',
  }

  const gapSizes = {
    md: 16,
    sm: 8,
  }

  return (
    <View
      key={user.handle}
      className="flex flex-row items-center"
      style={{
        gap: gapSizes[size] ?? 0,
      }}
    >
      <Avatar size={size}>
        <AvatarFallbackText>{user.name[0]}</AvatarFallbackText>
        <AvatarImage
          source={{
            uri,
          }}
        />
        {/* <AvatarBadge /> */}
      </Avatar>
      <View style={{ display: 'flex', gap: 4 }}>
        <Text variant={sizeToTextSize[size] ?? 'default'} style={{ color: Colors.$textDefault }}>
          {user.name}
        </Text>
        <Text
          variant={sizeToTextSize[size] ?? 'default'}
          style={{ color: Colors.$textNeutral, left: -2 }}
        >
          {user.handle}
        </Text>
      </View>
    </View>
  )
}
