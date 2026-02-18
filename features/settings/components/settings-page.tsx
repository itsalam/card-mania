import { Text } from '@/components/ui/text'
import { ChevronRight } from 'lucide-react-native'
import { View } from 'react-native'
import { SettingsDisplay } from '../types'

export function SettingsPageItem({ display }: { display: SettingsDisplay }) {
  const { type, Icon, label } = display

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
      <Text variant={'large'} style={{ fontSize: 18 }}>
        {label}
      </Text>
      <View
        style={{
          marginLeft: 'auto',
          marginRight: 12,
          alignSelf: 'flex-end',
        }}
      >
        <ChevronRight
          style={{
            marginLeft: 'auto',
            marginRight: 12,
            alignSelf: 'flex-end',
          }}
        />
      </View>
    </View>
  )
}
