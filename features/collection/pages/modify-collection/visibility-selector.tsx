import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { VISIBILITY_OPTIONS } from '@/features/tcg-card-views/DetailCardView/components/ui'
import { useCreateNewCollections } from '@/features/tcg-card-views/DetailCardView/provider'
import { Eye } from 'lucide-react-native'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { SettingRow } from './components'

export function VisibilitySelector() {
  const visibility = useCreateNewCollections((s) => s.visibility)
  const setVisibility = useCreateNewCollections((s) => s.setVisibility)

  return (
    <View style={{ gap: 10 }}>
      <SettingRow icon={Eye} label="Visibility" description="Who can see this collection." />
      <Tabs value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
        <TabsList
          style={{
            alignSelf: 'stretch',
            backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.6),
          }}
        >
          {VISIBILITY_OPTIONS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon
                  size={12}
                  color={visibility === key ? Colors.$textDefault : Colors.$textNeutral}
                  strokeWidth={2.5}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: visibility === key ? '600' : '400',
                    color: visibility === key ? Colors.$textDefault : Colors.$textNeutral,
                  }}
                >
                  {label}
                </Text>
              </View>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </View>
  )
}
