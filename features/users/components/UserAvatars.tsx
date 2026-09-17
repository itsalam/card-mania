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

/**
 * The shape returned by the various profile lookups across the app (public
 * profile RPCs, user_profile rows, etc.) — always a subset of these three
 * nullable fields. UserContact/UserAvatar normalize this into UserDisplayInfo
 * internally, so callers pass the raw profile straight through instead of
 * each re-deriving name/handle/avatar by hand.
 */
export type RawUserProfile =
  | {
      display_name?: string | null
      username?: string | null
      avatar_url?: string | null
    }
  | null
  | undefined

/**
 * `fallbackId` (typically the user's id) backstops name/handle when the
 * profile has no display_name/username — e.g. `id.slice(0, 8)` — matching the
 * convention used throughout the app before this was centralized.
 */
function toUserDisplayInfo(user: RawUserProfile, fallbackId?: string): UserDisplayInfo | undefined {
  if (!user) return undefined
  const shortId = fallbackId ? fallbackId.slice(0, 8) : undefined
  return {
    name: user.display_name ?? user.username ?? shortId ?? 'Unknown',
    handle: user.username ? `@${user.username}` : shortId ? `@${shortId}` : '',
    avatar: user.avatar_url ?? '',
  }
}

type UserContactVariant = 'default' | 'outline'

type UserContactProps = {
  user?: RawUserProfile
  /** Backstops name/handle (e.g. an id-slice) when `user` has no display_name/username. */
  fallbackId?: string
  children?: ReactNode
  variant?: UserContactVariant
  /** Caps name/handle line count. Per-variant default when omitted: 1 for `default` (unchanged
   *  prior behavior), uncapped for `outline` (unchanged prior behavior) — pass explicitly to
   *  override either. */
  numberOfLines?: number
} & Pick<ComponentProps<typeof Avatar>, 'size'>

export const UserContact = ({
  user,
  fallbackId,
  size = 'md',
  variant = 'default',
  numberOfLines,
  children,
}: UserContactProps) => {
  const displayInfo = toUserDisplayInfo(user, fallbackId)

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
        <UserAvatar user={user} fallbackId={fallbackId} size={size} variant="outline" />
        <View style={{ alignItems: 'center', gap: 1 }}>
          <SkeletonText
            variant={textVariant}
            style={{ color: Colors.$textDefault, textAlign: 'center' }}
            loading={!Boolean(displayInfo)}
            numberOfLines={numberOfLines}
          >
            {displayInfo?.name}
          </SkeletonText>
          <SkeletonText
            variant="muted"
            style={{ textAlign: 'center' }}
            loading={!Boolean(displayInfo)}
            numberOfLines={numberOfLines}
          >
            {displayInfo?.handle}
          </SkeletonText>
          {children}
        </View>
      </View>
    )
  }

  return (
    <View
      key={displayInfo?.handle ?? 'loading-user'}
      className="flex flex-row items-center"
      style={{
        gap: size ? gapSizes[size] : 0,
      }}
    >
      <UserAvatar user={user} fallbackId={fallbackId} size={size} />
      <View style={{ display: 'flex', gap: 0, flexShrink: 1, minWidth: 0 }}>
        <SkeletonText
          variant={textVariant}
          style={{ color: Colors.$textDefault }}
          loading={!Boolean(displayInfo)}
          numberOfLines={numberOfLines ?? 1}
        >
          {displayInfo?.name}
        </SkeletonText>
        <SkeletonText
          variant={'muted'}
          loading={!Boolean(displayInfo)}
          numberOfLines={numberOfLines ?? 1}
        >
          {`${displayInfo?.handle}`}
        </SkeletonText>
        {children}
      </View>
    </View>
  )
}

export const UserAvatar = ({
  user,
  fallbackId,
  size = 'md',
  variant = 'default',
}: UserContactProps) => {
  const displayInfo = toUserDisplayInfo(user, fallbackId)
  const uri = useMemo(
    () => (displayInfo?.avatar ? displayInfo.avatar : undefined),
    [displayInfo?.avatar]
  )
  const [imageLoaded, setImageLoaded] = useState(false)

  const avatarEl = (
    <Avatar size={size} alt={displayInfo?.name[0] ?? 'loading-avatar'}>
      {!imageLoaded &&
        (displayInfo ? (
          <AnimAvatarFallback exiting={FadeOut}>
            <AvatarFallbackText>{displayInfo?.name[0]}</AvatarFallbackText>
          </AnimAvatarFallback>
        ) : (
          <Skeleton style={{ width: '100%', height: '100%' }} />
        ))}
      <AvatarImage
        source={{ uri }}
        onError={(e) => e.nativeEvent.error && setImageLoaded(false)}
        onLoad={(e) => e.nativeEvent.source && displayInfo && setImageLoaded(true)}
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
