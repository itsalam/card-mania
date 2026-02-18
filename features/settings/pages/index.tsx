import { Text } from '@/components/ui/text'
import { useUserStore } from '@/lib/store/useUserStore'
import { Star, TrendingUp } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { FlatList, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/ui/avatar'
import { Separator } from '@rn-primitives/dropdown-menu'
import { Colors } from 'react-native-ui-lib'
import { SettingsItem } from '../components/settings-item'
import { SettingsPageItem } from '../components/settings-page'
import { useEffectiveColorScheme } from '../hooks/effective-color-scheme'
import { ProfilePageStat } from '../types'
import { SETTINGS_SECTIONS } from './consts'

export default function ProfilePageLayout() {
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
    { label: 'Hobbyist', icon: Star, value: true },
    { label: 'Trader', icon: TrendingUp, value: false },
  ]

  return (
    <FlatList
      style={{
        height: '100%',
        width: '100%',
      }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      data={Object.entries(SETTINGS_SECTIONS)}
      keyExtractor={([key]) => key}
      renderItem={({ item: [path, section] }) => (
        <SettingsContainer label={section.label}>
          {Object.entries(section?.items).map(([key, setting]) =>
            setting.type === 'page' ? (
              <SettingsPageItem display={setting} />
            ) : (
              <SettingsItem settingKey={setting.key} display={setting} />
            )
          )}
        </SettingsContainer>
      )}
      ItemSeparatorComponent={() => (
        <Separator
          key={scheme}
          style={{
            marginBottom: 12,
            paddingVertical: 4,
            width: '100%',
            backgroundColor: Colors.$backgroundNeutral,
          }}
        />
      )}
      ListHeaderComponent={
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
          <Separator
            style={{
              marginTop: 12,
              paddingVertical: 4,
              width: '100%',
              backgroundColor: Colors.$backgroundNeutral,
            }}
          />
        </View>
      }
    />
  )
}

function SettingsContainer({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <View
      style={{
        paddingLeft: 20,
        paddingBottom: 20,
      }}
    >
      <View style={{ paddingVertical: 8, paddingBottom: 12 }}>
        <Text variant={'small'} style={{ fontSize: 16 }}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  )
}
