import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import { ProfilePageStat } from '@/features/profile/types'
import { useUserStore } from '@/lib/store/useUserStore'
import { LucideIcon, Star, TrendingUp } from 'lucide-react-native'
import React from 'react'
import { FlatList, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { useEffectiveColorScheme } from '../hooks/effective-color-scheme'

export function ProfileHeader() {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { user } = useUserStore()
  const scheme = useEffectiveColorScheme()

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

  const DUMMY_TAGS: { icon: LucideIcon; label: string; color?: string; disabled?: boolean }[] = [
    { label: 'Hobbyist', icon: Star },
    { label: 'Trader', icon: TrendingUp, disabled: false },
  ]
  return (
    <View
      style={{
        paddingTop: Math.round(height * 0.15),
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
      }}
    >
      <Avatar size="2xl" />
      <View
        style={{
          paddingTop: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text variant={'h4'}>PROFILE NAME</Text>
        <Text variant={'large'}>@{user?.email ?? 'profile.handle'}</Text>
      </View>
      <FlatList
        contentContainerStyle={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
        horizontal
        data={DUMMY_STATS}
        renderItem={({ item }) => {
          const { label, element, icon: Icon, value } = item
          return (
            <View
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text
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
                <Text variant={'large'}>{String(value)}</Text>
              ) : null}
            </View>
          )
        }}
        ItemSeparatorComponent={(props) => <Separator orientation="vertical" {...props} />}
      />

      <Button style={{ marginVertical: 12 }}>
        <Text variant={'large'}>View Profile</Text>
      </Button>
      <Separator
        style={{
          paddingVertical: 4,
          width: '100%',
          backgroundColor: Colors.$backgroundNeutral,
        }}
      />
    </View>
  )
}
