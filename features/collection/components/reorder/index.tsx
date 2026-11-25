import { GripVertical } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { ListRenderItemInfo, Modal, Pressable, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import ReorderableList, {
  ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

// ITS-200: native Reorder sheet. Rows move only from the handle (pressed in, no long-press
// wait), so the list still scrolls normally.
export function ReorderCollectionSheet(props: ReorderSheetProps) {
  const { visible, onClose } = props
  const insets = useSafeAreaInsets()
  const { rows, setRows, isLoading, error, changed, done } = useReorderSheetState(props)

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => setRows((prev) => reorderItems(prev, from, to)),
    [setRows]
  )
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<OrderRow>) => <DraggableRow row={item} />,
    []
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Modals render outside the app's root gesture view, so they need their own. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.$backgroundDefault }}>
        <ReorderHeader onCancel={onClose} onDone={done} changed={changed} />
        {isLoading || error || rows.length === 0 ? (
          <ReorderStatus isLoading={isLoading} error={error} empty={rows.length === 0} />
        ) : (
          <ReorderableList
            data={rows}
            onReorder={handleReorder}
            renderItem={renderItem}
            keyExtractor={(row) => row.ref_id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          />
        )}
      </GestureHandlerRootView>
    </Modal>
  )
}

const DraggableRow = memo(function DraggableRow({ row }: { row: OrderRow }) {
  const drag = useReorderableDrag()
  return (
    <ReorderRowContent
      row={row}
      trailing={
        <Pressable
          onPressIn={drag}
          hitSlop={8}
          style={styles.handle}
          accessibilityLabel={`Drag to move ${row.name ?? 'card'}`}
        >
          <View>
            <GripVertical size={20} color={Colors.$iconNeutral} />
          </View>
        </Pressable>
      }
    />
  )
})
