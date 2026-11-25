// ITS-200: the collection page's card column, with drag-to-reorder. Outside reorder mode it's a
// plain column. In reorder mode each row's accessories are dimmed by <SortableOverlay> (placed by
// the row, so it covers only that part) with a drag icon on top, and the
// whole row is the drag target: a short press picks it up (a quick swipe still scrolls the page),
// then its neighbours slide out of the way as it moves.
//
// Built by hand rather than with a list library because the page's scroll is simulated: the
// collapsing header's pan gesture drives the outer ScrollView with scrollTo (see
// useCollaspableHeader). Auto-scroll near the edges moves that same virtual offset.

import * as Haptics from 'expo-haptics'
import { MoveVertical } from 'lucide-react-native'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react'
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  AnimatedRef,
  clamp,
  measure,
  SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { OVERLAY_SPRING, SNAP_SPRING } from './shared'

export type SortableAutoScroll = {
  /** The page's virtual scroll offset (useCollaspableHeader's virtualOffset). */
  offset: SharedValue<number>
  /** Largest valid offset. */
  max: SharedValue<number>
  /** Where the page really is, in `offset`'s terms; `offset` is re-synced to it when a drag
   *  starts, in case the page moved without updating it. */
  current?: SharedValue<number>
  /** The scroll view, measured to find the visible area. */
  viewport: AnimatedRef<any>
  /** Height covered at the bottom of the viewport (the tab bar). */
  bottomInset?: number
}

export type SortableListProps<T> = {
  items: T[]
  keyOf: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  /** Shows the overlays and makes rows draggable. */
  reordering: boolean
  /** Lets rows drag; off until every card has loaded. */
  dragEnabled: boolean
  onMove: (from: number, to: number) => void
  gap?: number
  itemLabel?: (item: T) => string
  autoScroll?: SortableAutoScroll
  style?: StyleProp<ViewStyle>
  ListEmptyComponent?: ReactNode
}

// Auto-scroll: starts within EDGE px of the top or bottom, up to MAX_SPEED px/s at the edge.
const EDGE = 120
const MAX_SPEED = 1100

/** How long a row has to be held before it picks up. Moving sooner scrolls the page instead. */
const PICKUP_DELAY_MS = 100
/** Overlay strength in reorder mode: the accessories stay legible but read as disabled. */
const OVERLAY_ALPHA = 0.6

type DragState = {
  heights: SharedValue<Record<string, number>>
  /** Keys in display order, as of the drag's start. */
  order: SharedValue<string[]>
  activeKey: SharedValue<string | null>
  target: SharedValue<number>
  dragY: SharedValue<number>
  gap: number
}

/** How far (fraction of its height) the dragged row's leading edge must cover a neighbour
 *  before they swap. Lower swaps sooner; 0.5 would be the neighbour's midpoint. */
const SWAP_THRESHOLD = 0.25

/** Where the active row would land: moving down, its bottom edge has to reach SWAP_THRESHOLD
 *  into the row below; moving up, its top edge the same distance into the row above. */
function computeTarget(s: DragState) {
  'worklet'
  const order = s.order.value
  const from = order.indexOf(s.activeKey.value ?? '')
  if (from < 0) return -1
  let y = 0
  const tops: number[] = []
  const hs: number[] = []
  for (let i = 0; i < order.length; i++) {
    const h = s.heights.value[order[i]] ?? 0
    tops.push(y)
    hs.push(h)
    y += h + s.gap
  }
  const draggedTop = tops[from] + s.dragY.value
  const draggedBottom = draggedTop + hs[from]
  if (s.dragY.value >= 0) {
    let to = from
    for (let j = from + 1; j < order.length; j++) {
      if (draggedBottom > tops[j] + hs[j] * SWAP_THRESHOLD) to = j
      else break
    }
    return to
  }
  let to = from
  for (let j = from - 1; j >= 0; j--) {
    if (draggedTop < tops[j] + hs[j] * (1 - SWAP_THRESHOLD)) to = j
    else break
  }
  return to
}

/** The active row's translation once it sits in slot `to`. */
function restingOffset(s: DragState, from: number, to: number) {
  'worklet'
  const order = s.order.value
  let y = 0
  const tops: number[] = []
  for (let i = 0; i < order.length; i++) {
    tops.push(y)
    y += (s.heights.value[order[i]] ?? 0) + s.gap
  }
  const hFrom = s.heights.value[order[from]] ?? 0
  const top = to > from ? tops[to] + (s.heights.value[order[to]] ?? 0) - hFrom : tops[to]
  return top - tops[from]
}

export function SortableList<T>({
  items,
  keyOf,
  renderItem,
  reordering,
  dragEnabled,
  onMove,
  gap = 0,
  itemLabel,
  autoScroll,
  style,
  ListEmptyComponent,
}: SortableListProps<T>) {
  const keys = useMemo(() => items.map(keyOf), [items, keyOf])

  const heights = useSharedValue<Record<string, number>>({})
  const order = useSharedValue<string[]>(keys)
  const activeKey = useSharedValue<string | null>(null)
  const target = useSharedValue(-1)
  const dragY = useSharedValue(0)
  const touchY = useSharedValue(0)
  const translation = useSharedValue(0)
  const startOffset = useSharedValue(0)
  const state: DragState = useMemo(
    () => ({ heights, order, activeKey, target, dragY, gap }),
    [heights, order, activeKey, target, dragY, gap]
  )

  // The new order has rendered: drop the drag offsets in the same pass, so rows don't jump.
  useLayoutEffect(() => {
    order.value = keys
    activeKey.value = null
    target.value = -1
    dragY.value = 0
  }, [keys, order, activeKey, target, dragY])

  const commit = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) {
        activeKey.value = null
        target.value = -1
        dragY.value = 0
        return
      }
      onMove(from, to)
    },
    [onMove, activeKey, target, dragY]
  )

  const frame = useFrameCallback((info) => {
    if (!autoScroll || activeKey.value == null) return
    const m = measure(autoScroll.viewport)
    if (!m) return
    const top = m.pageY
    const bottom = m.pageY + m.height - (autoScroll.bottomInset ?? 0)
    const y = touchY.value
    let speed = 0
    if (y < top + EDGE) speed = -Math.min(1, (top + EDGE - y) / EDGE)
    else if (y > bottom - EDGE) speed = Math.min(1, (y - (bottom - EDGE)) / EDGE)
    if (speed === 0) return
    const dt = info.timeSincePreviousFrame ?? 16
    const v = autoScroll.offset.value
    const next = clamp(v + (speed * MAX_SPEED * dt) / 1000, 0, autoScroll.max.value)
    if (next === v) return
    autoScroll.offset.value = next
    dragY.value = translation.value + (next - startOffset.value)
    target.value = computeTarget(state)
  }, false)

  useEffect(() => {
    frame.setActive(reordering && !!autoScroll)
  }, [frame, reordering, autoScroll])

  if (items.length === 0 && ListEmptyComponent) return <>{ListEmptyComponent}</>

  return (
    <View style={[{ gap }, style]}>
      {items.map((item, index) => {
        const key = keys[index]
        return (
          <SortableRow
            key={key}
            rowKey={key}
            index={index}
            state={state}
            reordering={reordering}
            dragEnabled={dragEnabled}
            label={itemLabel?.(item)}
            touchY={touchY}
            translation={translation}
            startOffset={startOffset}
            scrollOffset={autoScroll?.offset}
            scrollCurrent={autoScroll?.current}
            commit={commit}
            onStep={(dir) => {
              const to = index + dir
              if (to >= 0 && to < items.length) onMove(index, to)
            }}
          >
            {renderItem(item, index)}
          </SortableRow>
        )
      })}
    </View>
  )
}

function SortableRow({
  rowKey,
  index,
  state,
  reordering,
  dragEnabled,
  label,
  touchY,
  translation,
  startOffset,
  scrollOffset,
  scrollCurrent,
  commit,
  onStep,
  children,
}: {
  rowKey: string
  index: number
  state: DragState
  reordering: boolean
  dragEnabled: boolean
  label?: string
  touchY: SharedValue<number>
  translation: SharedValue<number>
  startOffset: SharedValue<number>
  scrollOffset?: SharedValue<number>
  scrollCurrent?: SharedValue<number>
  commit: (from: number, to: number) => void
  /** Screen readers: move one place up (-1) or down (1). */
  onStep: (dir: -1 | 1) => void
  children: ReactNode
}) {
  const { heights, order, activeKey, target, dragY, gap } = state
  const fallbackOffset = useSharedValue(0)
  const offset = scrollOffset ?? fallbackOffset

  // The overlay and its drag icon fade in a few rows at a time down the list.
  const reveal = useSharedValue(reordering ? 1 : 0)
  useEffect(() => {
    reveal.value = withDelay(
      reordering ? Math.min(index, 10) * 18 : 0,
      withSpring(reordering ? 1 : 0, OVERLAY_SPRING)
    )
  }, [reordering, index, reveal])

  // 1 while this row is picked up (the drag icon grows a little).
  const lifted = useSharedValue(0)

  const rowContext = useMemo(() => ({ reveal, lifted, dragEnabled }), [reveal, lifted, dragEnabled])

  const rowStyle = useAnimatedStyle(() => {
    const ak = activeKey.value
    if (ak == null) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1 }
    if (ak === rowKey) {
      return {
        transform: [{ translateY: dragY.value }, { scale: withSpring(1.02, SNAP_SPRING) }],
        zIndex: 10,
        opacity: 1,
      }
    }
    const ord = order.value
    const from = ord.indexOf(ak)
    const me = ord.indexOf(rowKey)
    const to = target.value
    const h = (heights.value[ak] ?? 0) + gap
    let shift = 0
    if (from < to && me > from && me <= to) shift = -h
    else if (to < from && me >= to && me < from) shift = h
    return {
      transform: [{ translateY: withSpring(shift, SNAP_SPRING) }, { scale: 1 }],
      zIndex: 0,
      opacity: 1,
    }
  })

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      // modify runs on the UI thread, so rows laying out together can't overwrite each other.
      heights.modify(<V extends Record<string, number>>(prev: V) => {
        'worklet'
        ;(prev as Record<string, number>)[rowKey] = h
        return prev
      })
    },
    [heights, rowKey]
  )

  const pickupHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }, [])
  const selection = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
  }, [])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(reordering && dragEnabled)
        // Hold briefly to pick up. A finger that moves first fails this gesture, so the page's
        // scroll pan (which waits for 10px of travel) takes the swipe instead.
        .activateAfterLongPress(PICKUP_DELAY_MS)
        .onStart((e) => {
          if (activeKey.value != null) return
          activeKey.value = rowKey
          target.value = order.value.indexOf(rowKey)
          if (scrollCurrent && Math.abs(scrollCurrent.value - offset.value) > 1) {
            offset.value = scrollCurrent.value
          }
          startOffset.value = offset.value
          translation.value = 0
          dragY.value = 0
          touchY.value = e.absoluteY
          lifted.value = withSpring(1, SNAP_SPRING)
          scheduleOnRN(pickupHaptic)
        })
        .onUpdate((e) => {
          if (activeKey.value !== rowKey) return
          touchY.value = e.absoluteY
          translation.value = e.translationY
          dragY.value = e.translationY + (offset.value - startOffset.value)
          const next = computeTarget(state)
          if (next !== target.value) {
            target.value = next
            scheduleOnRN(selection)
          }
        })
        .onFinalize(() => {
          if (activeKey.value !== rowKey) return
          lifted.value = withSpring(0, SNAP_SPRING)
          const from = order.value.indexOf(rowKey)
          const to = target.value < 0 ? from : target.value
          dragY.value = withSpring(restingOffset(state, from, to), SNAP_SPRING, () => {
            scheduleOnRN(commit, from, to)
          })
        }),
    [
      reordering,
      dragEnabled,
      rowKey,
      activeKey,
      target,
      order,
      startOffset,
      offset,
      scrollCurrent,
      translation,
      dragY,
      touchY,
      lifted,
      state,
      pickupHaptic,
      selection,
      commit,
    ]
  )

  return (
    <Animated.View style={rowStyle} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <View
          accessible={reordering}
          accessibilityRole="adjustable"
          accessibilityLabel={`Hold and drag to move ${label ?? 'card'}`}
          accessibilityActions={[
            { name: 'decrement', label: 'Move up' },
            { name: 'increment', label: 'Move down' },
          ]}
          onAccessibilityAction={(e) => {
            if (!dragEnabled) return
            if (e.nativeEvent.actionName === 'decrement') onStep(-1)
            if (e.nativeEvent.actionName === 'increment') onStep(1)
          }}
        >
          {/* The row's own controls stay off while reordering; touches fall through to the
              row's drag gesture. */}
          <View pointerEvents={reordering ? 'none' : 'auto'}>
            <SortableRowContext.Provider value={rowContext}>{children}</SortableRowContext.Provider>
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

type SortableRowContextValue = {
  reveal: SharedValue<number>
  lifted: SharedValue<number>
  dragEnabled: boolean
}

const SortableRowContext = createContext<SortableRowContextValue | null>(null)

/**
 * The reorder-mode overlay: dims whatever it's placed over (fill a relatively positioned parent)
 * and shows the drag icon on top. Renders nothing outside a SortableList row. It doesn't take
 * touches; the whole row is the drag target.
 */
export function SortableOverlay({ style }: { style?: StyleProp<ViewStyle> }) {
  const ctx = useContext(SortableRowContext)
  const fallback = useSharedValue(0)
  const reveal = ctx?.reveal ?? fallback
  const lifted = ctx?.lifted ?? fallback

  const overlayStyle = useAnimatedStyle(() => ({
    // Stays at full strength while the row is dragged.
    opacity: clamp(reveal.value, 0, 1),
  }))
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + 0.4 * clamp(reveal.value, 0, 1) + lifted.value * 0.1 }],
  }))

  if (!ctx) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: Colors.rgba(Colors.$backgroundDefault, OVERLAY_ALPHA) },
        style,
        overlayStyle,
      ]}
    >
      <Animated.View
        style={[
          styles.icon,
          {
            backgroundColor: Colors.$backgroundElevated,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          },
          iconStyle,
        ]}
      >
        <MoveVertical
          size={20}
          color={ctx.dragEnabled ? Colors.$iconDefault : Colors.$iconDisabled}
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
