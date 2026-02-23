import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text'
import React, { ComponentProps, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { UserDisplayInfo } from '../types'

const AnimAvatarFallback = Animated.createAnimatedComponent(AvatarFallback)

type UserContactProps = { user: UserDisplayInfo } & Pick<ComponentProps<typeof Avatar>, 'size'>

export const UserContact = ({ user, size = 'md' }: UserContactProps) => {
  const sizeToTextVar: Record<
    Exclude<typeof size, null>,
    ComponentProps<typeof Text>['variant']
  > = {
    xl: 'h4',
    '2xl': 'h3',
    lg: 'large',
    md: 'default',
    sm: 'small',
    xs: 'small',
  }

  const gapSizes: Record<Exclude<typeof size, null>, number> = {
    '2xl': 16,
    xl: 16,
    lg: 16,
    md: 16,
    sm: 8,
    xs: 8,
  }

  return (
    <View
      key={user.handle}
      className="flex flex-row items-center"
      style={{
        gap: size ? gapSizes[size] : 0,
      }}
    >
      <UserAvatar user={user} size={size} />
      <View style={{ display: 'flex', gap: 0 }}>
        <Text
          variant={size ? sizeToTextVar[size] : 'default'}
          style={{ color: Colors.$textDefault }}
        >
          {user.name}
        </Text>
        <Text variant={'large'} style={{ left: -2 }}>
          {user.handle}
        </Text>
      </View>
    </View>
  )
}

export const UserAvatar = ({ user, size = 'md' }: UserContactProps) => {
  const uri = useMemo(() => `https://picsum.photos/seed/${Math.random()}/200/200`, [])
  const [imageLoaded, setImageLoaded] = useState(false)
  return (
    <Avatar size={size} alt={user.name[0]}>
      {!imageLoaded && (
        <AnimAvatarFallback exiting={FadeOut}>
          <AvatarFallbackText>{user.name[0]}</AvatarFallbackText>
        </AnimAvatarFallback>
      )}
      <AvatarImage
        source={{
          uri,
        }}
        onError={(e) => e.nativeEvent.error && setImageLoaded(false)}
        onLoad={(e) => e.nativeEvent.source && setImageLoaded(true)}
      />
    </Avatar>
  )
}
