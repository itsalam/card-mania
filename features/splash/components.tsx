import { Text } from '@/components/ui/text/base-text'
import { AtSign, Phone } from 'lucide-react-native'
import { TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

type TabMode = 'email' | 'phone'
export function PillToggle({
  value,
  onChange,
}: {
  value: TabMode
  onChange: (v: TabMode) => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: Colors.rgba(Colors.$backgroundDisabled, 0.4),
        borderRadius: 20,
        padding: 3,
        alignSelf: 'flex-start',
      }}
    >
      {(['phone', 'email'] as TabMode[]).map((tab) => {
        const active = value === tab
        const color = active ? Colors.$textDefault : Colors.$textNeutral
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingVertical: 5,
              paddingHorizontal: 14,
              borderRadius: 17,
              backgroundColor: active ? Colors.$backgroundElevated : 'transparent',
            }}
            accessibilityLabel={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {tab === 'email' ? (
              <AtSign size={12} color={color} />
            ) : (
              <Phone size={12} color={color} />
            )}
            <Text style={{ color, fontWeight: '600', fontSize: 12 }}>
              {tab === 'email' ? 'Email' : 'Phone'}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
