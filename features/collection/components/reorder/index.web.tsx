import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import {
  OrderRow,
  ReorderHeader,
  ReorderRowContent,
  ReorderSheetProps,
  ReorderStatus,
  styles,
  useReorderSheetState,
} from './shared'

// ITS-200: web Reorder sheet. Reanimated worklets are stubbed on web, so rows move with
// up / down buttons instead of dragging.
export function ReorderCollectionSheet(props: ReorderSheetProps) {
  const { visible, onClose } = props
  const { rows, setRows, isLoading, error, changed, done } = useReorderSheetState(props)

  const move = (from: number, to: number) =>
    setRows((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [row] = next.splice(from, 1)
      next.splice(to, 0, row)
      return next
    })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.7),
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '90%',
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
            backgroundColor: Colors.$backgroundDefault,
          }}
        >
          <ReorderHeader onCancel={onClose} onDone={done} changed={changed} />
          {isLoading || error || rows.length === 0 ? (
            <ReorderStatus isLoading={isLoading} error={error} empty={rows.length === 0} />
          ) : (
            <ScrollView>
              {rows.map((row: OrderRow, i) => (
                <ReorderRowContent
                  key={row.ref_id}
                  row={row}
                  trailing={
                    <View style={{ flexDirection: 'row' }}>
                      <MoveButton label="Move up" disabled={i === 0} onPress={() => move(i, i - 1)}>
                        <ChevronUp
                          size={18}
                          color={i === 0 ? Colors.$iconDisabled : Colors.$iconNeutral}
                        />
                      </MoveButton>
                      <MoveButton
                        label="Move down"
                        disabled={i === rows.length - 1}
                        onPress={() => move(i, i + 1)}
                      >
                        <ChevronDown
                          size={18}
                          color={i === rows.length - 1 ? Colors.$iconDisabled : Colors.$iconNeutral}
                        />
                      </MoveButton>
                    </View>
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

function MoveButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string
  disabled: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.handle}
    >
      {children}
    </Pressable>
  )
}
