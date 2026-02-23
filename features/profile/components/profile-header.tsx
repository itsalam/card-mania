import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppStandaloneHeader } from '@/components/ui/headers'
import { ExpandableText, Text } from '@/components/ui/text'
import { ProfilePageStat } from '@/features/profile/types'
import { UserContact } from '@/features/users/components/UserAvatars'
import { DUMMY_USERS } from '@/features/users/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { Ellipsis, LucideIcon, Share, Star, TrendingUp } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

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
  const { user } = useUserStore()

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
          height: 72,
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
      <UserContact size="xl" user={DUMMY_USERS[0]} />
    </View>
  )
}

export function SubHeader() {
  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 20,
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
        data={DUMMY_TAGS}
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
          marginVertical: 16,
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
                paddingVertical: 8,
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
    </View>
  )
}
