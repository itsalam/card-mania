import { Text } from '@/components/ui/text'
import { useUserStore } from '@/lib/store/useUserStore'
import { LucideIcon, Star, TrendingUp } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { FlatList, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Separator } from '@rn-primitives/dropdown-menu'
import { Colors } from 'react-native-ui-lib'
import { ProfileHeader } from '../components/profile-header'
import { SettingsItem } from '../components/settings-item'
import { SettingsPageItem } from '../components/settings-page'
import { useEffectiveColorScheme } from '../hooks/effective-color-scheme'

import { SETTINGS_SECTIONS } from './consts'

export default function ProfilePageLayout() {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { user } = useUserStore()
  const scheme = useEffectiveColorScheme()

  const DUMMY_TAGS: { icon: LucideIcon; label: string; color?: string; disabled?: boolean }[] = [
    { label: 'Hobbyist', icon: Star },
    { label: 'Trader', icon: TrendingUp, disabled: false },
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
      key={scheme}
      renderItem={({ item: [path, section] }) => (
        <SettingsContainer label={section.label}>
          {Object.entries(section?.items).map(([key, setting]) =>
            setting.type === 'page' ? (
              <SettingsPageItem key={key} display={setting} />
            ) : (
              <SettingsItem key={key} settingKey={setting.key} display={setting} />
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
      ListHeaderComponent={<ProfileHeader />}
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
