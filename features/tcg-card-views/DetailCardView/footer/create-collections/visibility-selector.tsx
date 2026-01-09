import { Text } from '@/components/ui/text'

import { Eye } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors, SegmentedControl } from 'react-native-ui-lib'
import { useCreateNewCollections } from '../../provider'
import { VISIBILITY_OPTIONS } from '../../ui'
import { OptionLabel } from './components'

export function VisibilitySelector() {
  const [toggleHint, setToggleHint] = useState(false)
  const visibility = useCreateNewCollections((s) => s.visibility)
  const setVisibility = useCreateNewCollections((s) => s.setVisibility)

  const HintMessage = (
    <View style={styles.HintMessageContainer}>
      {VISIBILITY_OPTIONS.map(({ icon: Icon, label, description }) => (
        <View style={styles.HintMessageEntry}>
          <Icon color={Colors.$iconDefaultLight} />
          <Text style={styles.HintIcon}>
            {label}: {description}
          </Text>
        </View>
      ))}
    </View>
  )

  return (
    <View>
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <OptionLabel icon={Eye} label={'Visibility'} hintProps={{ message: HintMessage }} />
      </View>
      <SegmentedControl
        style={{ width: '100%', marginTop: 8 }}
        segments={VISIBILITY_OPTIONS.map(({ label, iconSource }) => ({ label, iconSource }))}
        initialIndex={VISIBILITY_OPTIONS.findIndex((option) => option.key === visibility)}
        onChangeIndex={(index) => {
          setVisibility(VISIBILITY_OPTIONS[index].key)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  HintMessageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 8,
  },
  HintMessageEntry: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 20,
  },
  HintIcon: {
    color: Colors.$textDefaultLight,
    fontSize: 16,
  },
})
