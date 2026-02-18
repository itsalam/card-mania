import { Text } from '@/components/ui/text'
import { ReactNode } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { SettingKey } from '../registry'
import { SettingsDisplay } from '../types'
import { CustomAccessory } from './custom-registry'
import { ToggleAccessory } from './toggle-accessory'

export function SettingsItem({
  settingKey,
  display,
  children,
}: {
  display: SettingsDisplay
  settingKey: SettingKey
  children?: ReactNode
}) {
  const { type, Icon, label } = display

  const Layout = ({ children }: { children: ReactNode }) => {
    switch (type) {
      case 'toggle':
        return (
          <ToggleAccessory display={display} settingKey={settingKey}>
            {children}
          </ToggleAccessory>
        )
      case 'custom':
        return (
          <CustomAccessory display={display} settingKey={settingKey}>
            {children}
          </CustomAccessory>
        )
      default:
        return (
          <View
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'row',
              gap: 4,
              paddingVertical: 10,
            }}
          >
            {children}
          </View>
        )
    }
  }
  return (
    <Layout>
      <View
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'row',
          gap: 4,
        }}
      >
        <Icon size={26} color={Colors.$iconDefault} />
        <Text variant={'large'} style={{ fontSize: 18 }}>
          {label}
        </Text>
      </View>
    </Layout>
  )
}
