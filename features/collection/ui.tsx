import React, { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Gesture, GestureType } from 'react-native-gesture-handler'
import Animated, {
  clamp,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated'

import { scheduleOnRN } from 'react-native-worklets'

type AnimatedScrollRef = Animated.FlatList

export function useCollaspableHeader(disable?: boolean, resetKeys?: unknown[]) {
  const [tabsExpanded, setTabsExpanded] = useState(false)
  const expandProgress = useSharedValue(0)
  const gestureRef = useRef<GestureType>(undefined)
  const scrollViewRef = useAnimatedRef<AnimatedScrollRef>()
  const headerContentRef = useAnimatedRef<View>()
  const scrollOffset = useScrollOffset(scrollViewRef)
  const measuredHeaderHeight = useSharedValue(0)
  const contentHeight = useSharedValue(0)
  const containerHeight = useSharedValue(0)

  const virtualOffset = useSharedValue(0)
  const blockHeaderMeasurement = useSharedValue(false)

  const toggleHeader = (toggle: boolean) => {
    !disable && setTabsExpanded(toggle)
  }

  const updateOffsets = () => {
    'worklet'
    const v = virtualOffset.value
    const H = measuredHeaderHeight.value || 1

    // How much of header is collapsed
    const expand = clamp(v / H, 0, 1)
    expandProgress.value = expand

    scheduleOnRN(toggleHeader, expand === 1)

    // Scroll begins after header is fully collapsed
    const scroll = Math.max(0, v - H)
    scrollOffset.value = scroll

    scrollTo(scrollViewRef, 0, scroll, false)
  }

  useAnimatedReaction(
    () => virtualOffset.value,
    () => {
      updateOffsets()
      if (expandProgress.value === 0 || expandProgress.value === 1) {
        blockHeaderMeasurement.value = false
      }
    },
    []
  )

  const nativeGesture = Gesture.Native()

  useEffect(() => {
    // Reset header measurement/state when the page key changes so each tab can re-measure
    virtualOffset.value = 0
    measuredHeaderHeight.value = 0
    blockHeaderMeasurement.value = false
    expandProgress.value = 0
    scrollOffset.value = 0
  }, [
    ...(resetKeys ?? []),
    virtualOffset,
    measuredHeaderHeight,
    blockHeaderMeasurement,
    expandProgress,
    scrollOffset,
  ])

  const THRESHOLD = 0.7 // > 0.5 → snap closed, < 0.5 → snap open
  const VELOCITY_TRIGGER = 100 // px/s-ish after being flipped (tweak!)

  const panGesture = Gesture.Pan()
    .withRef(gestureRef)
    .onBegin(() => {
      blockHeaderMeasurement.value = true
    })
    .onChange((e) => {
      if (measuredHeaderHeight.value <= 0) return

      const dy = e.changeY // delta; positive when dragging down
      const drag = -dy // scrolling content up when dragging up

      virtualOffset.value += drag // you can clamp later in withDecay
    })
    .onEnd((e) => {
      if (measuredHeaderHeight.value <= 0) return

      const H = measuredHeaderHeight.value || 1
      const v0 = -e.velocityY // drag up → positive scroll
      const v = virtualOffset.value

      // If header is already fully collapsed, we’re purely scrolling content.
      if (v >= H) {
        const scrollableContent = Math.max(0, contentHeight.value - containerHeight.value)
        const maxVirtualOffset = H + scrollableContent

        virtualOffset.value = withDecay({
          velocity: v0,
          clamp: [0, maxVirtualOffset],
        })

        return
      }

      // We're still inside the header region (0..H), so we snap instead of decaying.
      const progress = v / H // 0..1

      // Decide whether to collapse or open
      let snapToCollapsed: boolean

      const strongFling = Math.abs(v0) > VELOCITY_TRIGGER

      if (strongFling) {
        // Use direction for big flings: up → collapsed, down → open
        snapToCollapsed = v0 > 0 // positive v0 means fling up (scroll up)
      } else {
        // Use position threshold for softer releases
        snapToCollapsed = progress > THRESHOLD
      }

      const target = snapToCollapsed ? H : 0

      virtualOffset.value = withTiming(target, { duration: 160 })
    })

  const composedGestures = Gesture.Simultaneous(nativeGesture, panGesture)

  const headerAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: 1 - expandProgress.value,
      height:
        measuredHeaderHeight.value > 0
          ? interpolate(expandProgress.value, [0, 1], [measuredHeaderHeight.value, 0])
          : undefined,
      transform: [{ translateY: interpolate(expandProgress.value, [0, 1], [0, -24]) }],
      pointerEvents: expandProgress.value >= 0.99 ? 'none' : ('auto' as any),
    }),
    [measuredHeaderHeight]
  )

  return {
    tabsExpanded,
    composedGestures,
    headerAnimatedStyle,
    onListLayout: React.useCallback(
      (e: any) => {
        containerHeight.value = e.nativeEvent.layout.height
      },
      [containerHeight]
    ),
    onContentSizeChange: React.useCallback(
      (_: number, height: number) => {
        contentHeight.value = height
      },
      [contentHeight]
    ),
    onHeaderLayout: React.useCallback(
      (e: any) => {
        // Only capture height when header is fully expanded
        if (expandProgress.value === 0 && !blockHeaderMeasurement.value) {
          measuredHeaderHeight.value = e.nativeEvent.layout.height
        }
      },
      [blockHeaderMeasurement, measuredHeaderHeight, expandProgress]
    ),
    gestureRef,
    scrollViewRef,
    headerContentRef,
    blockHeaderMeasurement,
    measuredHeaderHeight,
  }
}
