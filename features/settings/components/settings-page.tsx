import { Text } from '@/components/ui/text/base-text'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { SettingsDisplay } from '../types'

export function SettingsPageItem({ display }: { display: SettingsDisplay }) {
  const { type, Icon, label } = display
  const router = useRouter()
  const route = type === 'page' ? display.route : undefined

  return (
    <TouchableOpacity
      onPress={() => route && router.push(route as any)}
      disabled={!route}
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        gap: 4,
        paddingVertical: 10,
      }}
    >
      <Icon size={26} color={Colors.$iconDefault} />
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
          color={route ? Colors.$iconDefault : Colors.$iconDisabled}
        />
      </View>
    </TouchableOpacity>
  )
}
