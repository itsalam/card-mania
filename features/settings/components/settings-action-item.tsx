import { Text } from '@/components/ui/text/base-text'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { SettingsDisplay } from '../types'

type ActionDisplay = Extract<SettingsDisplay, { type: 'action' }>

export function SettingsActionItem({ display }: { display: ActionDisplay }) {
  const { Icon, label, onPress } = display

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
        <Icon size={26} color={Colors.$iconDefault} />
        <Text variant={'large'} style={{ fontSize: 18 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
