import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonText } from '@/components/ui/text'
import { Text } from '@/components/ui/text/base-text'
import React, { ComponentProps, ReactNode, useMemo, useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { UserDisplayInfo } from '../types'

const AnimAvatarFallback = Animated.createAnimatedComponent(AvatarFallback)

type UserContactVariant = 'default' | 'outline'

type UserContactProps = {
  user?: UserDisplayInfo
  children?: ReactNode
  variant?: UserContactVariant
} & Pick<ComponentProps<typeof Avatar>, 'size'>

export const UserContact = ({
  user,
  size = 'md',
  variant = 'default',
  children,
}: UserContactProps) => {
  const sizeToTextVar: Record<
    Exclude<typeof size, null>,
    ComponentProps<typeof Text>['variant']
  > = {
    xl: 'h3',
    '2xl': 'h2',
    lg: 'large',
    md: 'large',
    sm: 'default',
    xs: 'default',
  }

  const gapSizes: Record<Exclude<typeof size, null>, number> = {
    '2xl': 16,
    xl: 16,
    lg: 16,
    md: 8,
    sm: 8,
    xs: 8,
  }

  const textVariant = size ? sizeToTextVar[size] : 'default'

  if (variant === 'outline') {
    return (
      <View style={{ alignItems: 'center', gap: 8 }}>
        <UserAvatar user={user} size={size} variant="outline" />
        <View style={{ alignItems: 'center', gap: 1 }}>
          <SkeletonText
            variant={textVariant}
            style={{ color: Colors.$textDefault, textAlign: 'center' }}
            loading={!Boolean(user)}
          >
            {user?.name}
          </SkeletonText>
          <SkeletonText variant="muted" style={{ textAlign: 'center' }} loading={!Boolean(user)}>
            {user?.handle}
          </SkeletonText>
          {children}
        </View>
      </View>
    )
  }

  return (
    <View
      key={user?.handle ?? 'loading-user'}
      className="flex flex-row items-center"
      style={{
        gap: size ? gapSizes[size] : 0,
      }}
    >
      <UserAvatar user={user} size={size} />
      <View style={{ display: 'flex', gap: 0 }}>
        <SkeletonText
          variant={textVariant}
          style={{ color: Colors.$textDefault }}
          loading={!Boolean(user)}
        >
          {user?.name}
        </SkeletonText>
        <SkeletonText variant={'muted'} loading={!Boolean(user)}>
          {`${user?.handle}`}
        </SkeletonText>
        {children}
      </View>
    </View>
  )
}

export const UserAvatar = ({ user, size = 'md', variant = 'default' }: UserContactProps) => {
  const uri = useMemo(() => (user?.avatar ? user.avatar : undefined), [user?.avatar])
  const [imageLoaded, setImageLoaded] = useState(false)

  const avatarEl = (
    <Avatar size={size} alt={user?.name[0] ?? 'loading-avatar'}>
      {!imageLoaded &&
        (user ? (
          <AnimAvatarFallback exiting={FadeOut}>
            <AvatarFallbackText>{user?.name[0]}</AvatarFallbackText>
          </AnimAvatarFallback>
        ) : (
          <Skeleton style={{ width: '100%', height: '100%' }} />
        ))}
      <AvatarImage
        source={{ uri }}
        onError={(e) => e.nativeEvent.error && setImageLoaded(false)}
        onLoad={(e) => e.nativeEvent.source && user && setImageLoaded(true)}
      />
    </Avatar>
  )

  if (variant !== 'outline') return avatarEl

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 2,
        borderColor: Colors.$outlinePrimary,
        padding: 2,
      }}
    >
      {avatarEl}
    </View>
  )
}
