// ITS-200: web version of the collection page's card column. Drag gestures need the native
// worklet runtime (stubbed on web), so in reorder mode SortableOverlay holds up / down buttons
// instead of a drag icon.

import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { createContext, useContext } from 'react'
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import type { SortableListProps } from './SortableList'

export type { SortableAutoScroll, SortableListProps } from './SortableList'

type RowContext = {
  label: string
  dragEnabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  move: (dir: -1 | 1) => void
}

const SortableRowContext = createContext<RowContext | null>(null)

export function SortableList<T>({
  items,
  keyOf,
  renderItem,
  reordering,
  dragEnabled,
  onMove,
  gap = 0,
  itemLabel,
  style,
  ListEmptyComponent,
}: SortableListProps<T>) {
  if (items.length === 0 && ListEmptyComponent) return <>{ListEmptyComponent}</>

  return (
    <View style={[{ gap }, style]}>
      {items.map((item, index) => (
        <SortableRowContext.Provider
          key={keyOf(item, index)}
          value={
            reordering
              ? {
                  label: itemLabel?.(item) ?? 'card',
                  dragEnabled,
                  canMoveUp: index > 0,
                  canMoveDown: index < items.length - 1,
                  move: (dir) => onMove(index, index + dir),
                }
              : null
          }
        >
          {renderItem(item, index)}
        </SortableRowContext.Provider>
      ))}
    </View>
  )
}

/** Dims what it's placed over and shows up / down buttons, in reorder mode only. */
export function SortableOverlay({ style }: { style?: StyleProp<ViewStyle> }) {
  const ctx = useContext(SortableRowContext)
  if (!ctx) return null
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 8,
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.6),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        },
        style,
      ]}
    >
      <StepButton
        label={`Move ${ctx.label} up`}
        disabled={!ctx.dragEnabled || !ctx.canMoveUp}
        onPress={() => ctx.move(-1)}
        icon="up"
      />
      <StepButton
        label={`Move ${ctx.label} down`}
        disabled={!ctx.dragEnabled || !ctx.canMoveDown}
        onPress={() => ctx.move(1)}
        icon="down"
      />
    </View>
  )
}

function StepButton({
  label,
  disabled,
  onPress,
  icon,
}: {
  label: string
  disabled: boolean
  onPress: () => void
  icon: 'up' | 'down'
}) {
  const Icon = icon === 'up' ? ChevronUp : ChevronDown
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        backgroundColor: Colors.$backgroundElevated,
      }}
    >
      <Icon size={18} color={disabled ? Colors.$iconDisabled : Colors.$iconDefault} />
    </Pressable>
  )
}
