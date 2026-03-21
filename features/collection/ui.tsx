import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Gesture, GestureType } from 'react-native-gesture-handler'
import { BaseGesture } from 'react-native-gesture-handler/lib/typescript/handlers/gestures/gesture'
import Animated, {
  clamp,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated'

import { scheduleOnRN } from 'react-native-worklets'

export type AnimatedScrollRef = Animated.ScrollView

export function useCollaspableHeader(opts?: {
  disable?: boolean
  resetKeys?: unknown[]
  defaultHeight?: number
}) {
  const { disable = false, resetKeys, defaultHeight } = opts ?? {}
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const expandProgress = useSharedValue(0)
  const gestureRef = useRef<GestureType>(undefined)
  const scrollViewRef = useAnimatedRef<AnimatedScrollRef>()
  const scrollOffset = useSharedValue(0)
  const isScrollViewMounted = useSharedValue(false)
  const measuredHeaderHeight = useSharedValue(defaultHeight ?? 0)
  const contentHeight = useSharedValue(0)
  const containerHeight = useSharedValue(0)
  const virtualOffset = useSharedValue(0)
  const blockHeaderMeasurement = useSharedValue(false)

  const toggleHeader = (toggle: boolean) => {
    !disable && setHeaderExpanded(toggle)
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

    if (isScrollViewMounted.value) {
      scrollTo(scrollViewRef, 0, scroll, false)
    }
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

  useEffect(() => {
    // Reset header measurement/state when the page key changes so each tab can re-measure
    virtualOffset.value = 0
    measuredHeaderHeight.value = defaultHeight ?? 0
    blockHeaderMeasurement.value = false
    expandProgress.value = 0
    scrollOffset.value = 0
    isScrollViewMounted.value = false
  }, [...(resetKeys ?? [])])

  const THRESHOLD = 0.7 // > 0.5 → snap closed, < 0.5 → snap open
  const VELOCITY_TRIGGER = 100 // px/s-ish after being flipped (tweak!)

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
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
        }),
    []
  )

  const nativeGesture = Gesture.Native()

  // ✅ Pull blockers (empty if no provider)
  const blockers = useGestureBlockers()

  const composedGestures = useMemo(() => {
    let g = panGesture
    for (const b of blockers) {
      // b.blocksExternalGesture(g)
      // b.blocksExternalGesture(g)
    }

    const blockerGesture = Gesture.Simultaneous(...blockers)
    return Gesture.Simultaneous(nativeGesture, g)
  }, [blockers, nativeGesture, panGesture])

  const headerAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: 1 - expandProgress.value,
      height:
        measuredHeaderHeight.value > 0
          ? interpolate(expandProgress.value, [0, 1], [measuredHeaderHeight.value, 0])
          : 'auto',
      transform: [{ translateY: interpolate(expandProgress.value, [0, 1], [0, -12]) }],
      pointerEvents: expandProgress.value >= 0.99 ? 'none' : ('auto' as any),
    }),
    [measuredHeaderHeight]
  )

  return {
    tabsExpanded: headerExpanded,
    composedGestures,
    headerAnimatedStyle,
    onListLayout: React.useCallback(
      (e: any) => {
        isScrollViewMounted.value = true
        containerHeight.value = e.nativeEvent.layout.height
      },
      [containerHeight, isScrollViewMounted]
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
        if (
          expandProgress.value === 0 &&
          !blockHeaderMeasurement.value &&
          !Boolean(defaultHeight)
        ) {
          measuredHeaderHeight.set(e.nativeEvent.layout.height)
        }
      },
      [blockHeaderMeasurement, measuredHeaderHeight, expandProgress]
    ),
    gestureRef,
    scrollViewRef,
    blockHeaderMeasurement,
    measuredHeaderHeight,
    expandProgress,
  }
}

type AnyGesture = BaseGesture<any>

type BlockerAPI = {
  register: (g: AnyGesture) => () => void
  list: () => AnyGesture[]
  blockers: AnyGesture[]
}

const BlockerContext = createContext<BlockerAPI | null>(null)

export function GestureBlockerProvider({ children }: PropsWithChildren) {
  const [blockers, setBlockers] = useState<AnyGesture[]>([])

  const register = useCallback(
    (g: AnyGesture) => {
      if (!blockers.includes(g))
        setBlockers((prev) => {
          const regIdx = prev.findIndex(
            (gesture) => gesture.handlers.gestureId === g.handlers.gestureId
          )
          if (regIdx >= 0) {
            prev.splice(regIdx, 1).push(g)
            return prev // Avoid duplicate registrations
          }
          return [...prev, g]
        })

      return () => {
        // setBlockers((prev) => prev.filter((item) => item !== g))
      }
    },
    [blockers]
  )

  // 2. The API object now only changes if 'blockers' changes,
  // but 'register' itself is now a stable function reference.
  const api = useMemo(
    () => ({
      register,
      list: () => blockers, // This will always return the current state
      blockers,
    }),
    [register, blockers]
  )

  return <BlockerContext.Provider value={api}>{children}</BlockerContext.Provider>
}

export function useRegisterGestureBlocker(g: AnyGesture | null) {
  const ctx = useContext(BlockerContext)
  React.useEffect(() => {
    if (!ctx || !g) return
    return ctx.register(g)
  }, [])
}

export function useGestureBlockers() {
  const ctx = useContext(BlockerContext)
  return ctx?.blockers ?? []
}
