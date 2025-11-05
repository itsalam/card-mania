import { Text } from '@/components/ui/text'

import { CircleQuestionMark, Eye } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Button, Colors, Hint, SegmentedControl } from 'react-native-ui-lib'
import { HintPositions } from 'react-native-ui-lib/src/components/hint/types'
import { useCreateNewCollections, VISIBILITY_OPTIONS } from '../../provider'

export function VisibilitySelector() {
  const [toggleHint, setToggleHint] = useState(false)
  const visibility = useCreateNewCollections((s) => s.visibility);
  const setVisibility = useCreateNewCollections((s) => s.setVisibility);

  const HintMessage = (
    <View style={styles.HintMessageContainer}>
      {VISIBILITY_OPTIONS.map(({icon: Icon, label, description}) => <View style={styles.HintMessageEntry}>
        <Icon color={Colors.$iconDefaultLight} />
        <Text
          style={styles.HintIcon}
        > 
          {label}: {description}
        </Text>
      </View>)}
    </View>
  )

  return (
    <View
      style={{
        paddingTop: 16,
      }}
    >
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >

          <Pressable
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8}}
            onPress={() => {
              setToggleHint(!toggleHint)
            }}
          >
            <Eye color={Colors.$textNeutralLight} size={24} />
            <Text style={[{color: Colors.$textNeutralLight, fontSize: 20, lineHeight: 24, fontWeight: '500'}]}>Visibility</Text>
        <Hint visible={toggleHint} useModal message={HintMessage} position={HintPositions.TOP} onBackgroundPress={() => setToggleHint(false)}>
            <Button
              onPress={() => {
                setToggleHint(!toggleHint)
              }}
              size="large"
              iconSource={(style) => (
                <CircleQuestionMark style={style} color={Colors.$iconDefaultLight} />
              )}
            />
        </Hint>
          </Pressable>
      </View>
      <SegmentedControl
        style={{ width: '100%', marginTop: 8 }}
        segments={VISIBILITY_OPTIONS.map(({ label, iconSource }) => ({ label, iconSource }))}
        initialIndex={VISIBILITY_OPTIONS.findIndex((option) => option.key === visibility)}
        onChangeIndex={(index) => {
          setVisibility(VISIBILITY_OPTIONS[index].key);
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
  HintMessageEntry: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 20 },
  HintIcon: {
    color: Colors.$textDefaultLight,
    fontSize: 16,
  },
})
