import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { ExpandableText, Text } from '@/components/ui/text'
import { useToast } from '@/components/Toast'
import { ProfilePageStat } from '@/features/profile/types'
import { UserContact } from '@/features/users/components/UserAvatars'
import { DUMMY_USERS } from '@/features/users/helpers'
import { Copy, Ellipsis, LucideIcon, Share, Star, TrendingUp } from 'lucide-react-native'
import React, { ReactNode, useMemo } from 'react'
import { FlatList, Platform, Share as RNShare, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useUserProfilePage } from '../providers'

const STOREFRONT_DOMAIN = 'cardmania.vercel.app'

const DUMMY_STATS: ProfilePageStat[] = [
  {
    label: 'Followers',
    value: 0,
  },
  {
    label: 'Following',
    value: 0,
  },
]

type Tag = {
  icon: LucideIcon
  label: string
  color?: string
  disabled?: boolean
  element?: ReactNode
}

const DUMMY_TAGS: Tag[] = [
  { label: 'Hobbyist', icon: Star },
  { label: 'Trader', icon: TrendingUp, disabled: true },
]

export function ProfileHeader() {
  return (
    <View
      style={{
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: '100%',
        }}
      >
        <AppStandaloneHeader
          onBack={() => {}}
          right={
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button size={'icon'}>
                <Share size={22} color={Colors.$iconDefault} />
              </Button>

              <TouchableOpacity>
                <Button size={'icon'}>
                  <Ellipsis size={22} color={Colors.$iconDefault} />
                </Button>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
      <UserContact size="lg" user={DUMMY_USERS[0]}></UserContact>
    </View>
  )
}

export function SubHeader() {
  const user = useUserProfilePage((s) => s.user)
  const { showToast } = useToast()

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
      { label: 'Hobbyist', icon: Star, disabled: Boolean(user?.is_hobbyiest) },
      { label: 'Trader', icon: TrendingUp, disabled: Boolean(user?.is_seller) },
    ]
    return tags
  }, [user])
  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 20,
        paddingTop: 28,
        paddingBottom: 0,
      }}
    >
      {
        //TODO: Add user bio
        //TODO add user tags
      }

      <FlatList
        contentContainerStyle={{
          justifyContent: 'center',
          alignItems: 'stretch',
          gap: 12,
        }}
        horizontal
        data={tags}
        renderItem={({ item }) => {
          const { label, element, icon, disabled } = item
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
                opacity: disabled ? 0.3 : 1.0,
              }}
            />
          )
        }}
      />
      <ExpandableText
        minNumLines={2}
        containerStyle={{
          marginVertical: 8,
        }}
        style={{
          color: Colors.$textNeutralHeavy,
        }}
      >
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua.
      </ExpandableText>
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {DUMMY_STATS.map((item) => {
          const { label, element, icon: Icon, value } = item
          return (
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
                style={{
                  ...(!Icon
                    ? { color: Colors.$iconDefault }
                    : Boolean(value)
                      ? { color: Colors.$iconPrimary }
                      : { color: Colors.rgba(Colors.$iconDefault, 0.4) }),
                }}
              >
                {label}
              </Text>
              {element ? (
                element
              ) : Icon ? (
                <Icon
                  size={20}
                  style={{ marginTop: 3 }}
                  {...(Boolean(value)
                    ? { color: Colors.$iconPrimary }
                    : { color: Colors.rgba(Colors.$iconDefault, 0.4) })}
                />
              ) : value !== undefined ? (
                <Text className="font-roboto" style={{ fontSize: 20, fontWeight: 700 }}>
                  {String('17,89') + String(value)}
                </Text>
              ) : null}
            </View>
          )
        })}
        <Button size={'lg'}>
          <Text variant={'large'}>Follow</Text>
        </Button>
      </View>

      {storefrontUrl ? (
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
