import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExpandableText, Text } from '@/components/ui/text'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { useUserStore } from '@/lib/store/useUserStore'
import { Copy, Ellipsis, LucideIcon, Star, TrendingUp } from 'lucide-react-native'
import React, { ReactNode, useMemo } from 'react'
import { FlatList, Platform, Share as RNShare, TouchableOpacity, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { useUserProfilePage } from '../providers'

const STOREFRONT_DOMAIN = 'cardmania.vercel.app'

type Tag = {
  icon: LucideIcon
  label: string
  color?: string
  disabled?: boolean
  element?: ReactNode
}

export function ProfileHeader() {
  const user = useUserProfilePage((s) => s.user)
  const { user: authUser } = useUserStore()
  const { showToast } = useToast()

  const isOwnProfile = !!authUser?.id && authUser.id === user?.user_id
  const storefrontUrl = user?.username
    ? `https://${STOREFRONT_DOMAIN}/storefront/${user.username}`
    : null

  const handleShareStorefront = async () => {
    if (!storefrontUrl) return
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(storefrontUrl)
      showToast({ message: 'Link copied to clipboard!' })
    } else {
      await RNShare.share({ url: storefrontUrl, message: storefrontUrl })
    }
  }

  const displayInfo: UserDisplayInfo | undefined = user
    ? {
        name: user.display_name ?? user.username ?? 'Unknown',
        handle: user.username ? `@${user.username}` : '',
        avatar: user.avatar_url ?? '',
      }
    : undefined

  return (
    <View
      style={{
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <View
        style={{
          width: '100%',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <UserContact size="xl" user={displayInfo} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Popover>
              <PopoverTrigger asChild>
                <TouchableOpacity>
                  <Button size={'icon'}>
                    <Ellipsis size={22} color={Colors.$iconDefault} />
                  </Button>
                </TouchableOpacity>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2">
                {isOwnProfile && storefrontUrl ? (
                  <TouchableOpacity
                    onPress={handleShareStorefront}
                    style={{ padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Copy size={16} color={Colors.$iconDefault} />
                    <Text>Share storefront</Text>
                  </TouchableOpacity>
                ) : null}
              </PopoverContent>
            </Popover>
          </View>
        </View>
      </View>
    </View>
  )
}

export function SubHeader() {
  const user = useUserProfilePage((s) => s.user)
  const { user: authUser } = useUserStore()
  const { showToast } = useToast()

  const isOwnProfile = !!authUser?.id && authUser.id === user?.user_id
  const storefrontUrl = user?.username
    ? `https://${STOREFRONT_DOMAIN}/storefront/${user.username}`
    : null

  const handleShareStorefront = async () => {
    if (!storefrontUrl) return
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(storefrontUrl)
      showToast({ message: 'Link copied to clipboard!' })
    } else {
      await RNShare.share({ url: storefrontUrl, message: storefrontUrl })
    }
  }

  const tags = useMemo(() => {
    const tags: Tag[] = [
      { label: 'Hobbyist', icon: Star, disabled: !user?.is_hobbyiest },
      { label: 'Trader', icon: TrendingUp, disabled: !user?.is_seller },
    ]
    return tags
  }, [user])

  const stats = [
    { label: 'Followers', value: 0 },
    { label: 'Following', value: 0 },
  ]

  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderColor: Colors.$outlineDefault,
          borderWidth: 1,
          padding: 12,
          paddingVertical: 4,
          borderRadius: BorderRadiuses.br30,
        }}
      >
        {stats.map(({ label, value }) => (
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingVertical: 4,
              gap: 4,
            }}
            key={label}
          >
            <Text
              className="font-roboto"
              variant={'default'}
              style={{ color: Colors.$iconDefault }}
            >
              {label}
            </Text>
            <Text className="font-roboto" style={{ fontSize: 20, fontWeight: 700 }}>
              {value}
            </Text>
          </View>
        ))}
        <Button size={'lg'}>
          <Text variant={'large'}>Follow</Text>
        </Button>
      </View>
      <FlatList
        contentContainerStyle={{
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: 8,
          paddingVertical: 12,
          marginLeft: 0,
        }}
        horizontal
        data={tags}
        renderItem={({ item }) => {
          const { label, element, icon, disabled } = item
          if (disabled) {
            return null
          }
          return (
            <Badge
              variant="square"
              label={label}
              icon={icon}
              leftElement={element}
              backgroundColor={Colors.$backgroundElevatedLight}
              containerStyle={{
                borderColor: Colors.$textNeutralLight,
                borderWidth: 1.5,
                opacity: 0.7,
                alignSelf: 'center',
              }}
            />
          )
        }}
      />
      {user?.bio ? (
        <ExpandableText
          minNumLines={2}
          style={{
            color: Colors.$textNeutralHeavy,
          }}
        >
          {user.bio}
        </ExpandableText>
      ) : null}

      {isOwnProfile && storefrontUrl ? (
        <TouchableOpacity
          onPress={handleShareStorefront}
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: Colors.$backgroundElevated,
            gap: 8,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="small" style={{ color: Colors.$textNeutralLight }}>
              Share your storefront
            </Text>
            <Text
              variant="small"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: Colors.$textNeutralHeavy }}
            >
              {storefrontUrl}
            </Text>
          </View>
          <Copy size={16} color={Colors.$iconDefault} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
