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
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated'

import { scheduleOnRN } from 'react-native-worklets'

export type AnimatedScrollRef = Animated.ScrollView

// ─── Header events ──────────────────────────────────────────────────────────────────────────────
// Lets the header's content and useCollaspableHeader coordinate without prop drilling: the
// content says when its size is about to change (so the collapse distance is right before the
// layout settles) and whether one scroll should dismiss it entirely; the hook says when that
// dismiss has finished, so the content can close itself while it's off screen.

export type CollapsibleHeaderEvent =
  /** content → hook: the header STARTS changing height. `extra` is the absolute height the
   *  content currently adds on top of its base (e.g. an open section's height, 0 when closed),
   *  not a delta, so repeated or out-of-order events can't accumulate drift.
   *  The hook takes the expected height now and ignores layouts until 'resized', since layouts
   *  taken mid-change (or none at all, when the change is a UI-thread animation) are wrong. */
  | { type: 'resize'; extra?: number }
  /** content → hook: the size change has settled; the next layout is the real height. */
  | { type: 'resized' }
  /** content → hook: while true, the first scroll toward collapsing dismisses the whole header
   *  in one motion instead of following the finger. */
  | { type: 'dismissible'; value: boolean }
  /** hook → content: a dismiss-all finished; the header is fully collapsed. */
  | { type: 'dismissed' }

export type CollapsibleHeaderEvents = {
  emit: (event: CollapsibleHeaderEvent) => void
  subscribe: (listener: (event: CollapsibleHeaderEvent) => void) => () => void
}

function createHeaderEvents(): CollapsibleHeaderEvents {
  const listeners = new Set<(event: CollapsibleHeaderEvent) => void>()
  // 'dismissible' is state, not a one-off: replay the latest to late subscribers. Child effects
  // run before their parent's, so the header content announces it before the hook (in the
  // parent) has subscribed.
  let dismissible: CollapsibleHeaderEvent | null = null
  return {
    emit: (event) => {
      if (event.type === 'dismissible') dismissible = event
      listeners.forEach((l) => l(event))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (dismissible) listener(dismissible)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const CollapsibleHeaderEventsContext = createContext<CollapsibleHeaderEvents | null>(null)
export const CollapsibleHeaderEventsProvider = CollapsibleHeaderEventsContext.Provider

/** The header's event channel, or null outside a collapsing header. */
export function useCollapsibleHeaderEvents() {
  return useContext(CollapsibleHeaderEventsContext)
}

/** Subscribes for the component's lifetime; `listener` may change between renders. */
export function useCollapsibleHeaderEvent(listener: (event: CollapsibleHeaderEvent) => void) {
  const events = useCollapsibleHeaderEvents()
  const latest = useRef(listener)
  latest.current = listener
  useEffect(() => events?.subscribe((e) => latest.current(e)), [events])
}

// Momentum: how far ahead (seconds) a release velocity is projected when deciding whether the
// header snaps open or closed, and the bounds on how long that snap takes.
const SNAP_PROJECTION_S = 0.2
const SNAP_MIN_MS = 120
const SNAP_MAX_MS = 280
const DISMISS_MS = 240
// Below this release speed (px/s) a momentumScroll release just snaps the header.
const MOMENTUM_MIN_VELOCITY = 200

/** Snap duration that carries the release velocity: a hard fling finishes fast, a slow release
 *  eases in. */
function snapDuration(distance: number, velocity: number) {
  'worklet'
  const speed = Math.abs(velocity)
  if (speed < 1) return SNAP_MAX_MS
  return clamp((Math.abs(distance) / speed) * 1000 * 2, SNAP_MIN_MS, SNAP_MAX_MS)
}

export function useCollaspableHeader(opts?: {
  disable?: boolean
  resetKeys?: unknown[]
  defaultHeight?: number
  /** Expand the header on any upward scroll, not only once the content is back at its top:
   *  scrolling up first re-opens the header in place, then scrolls the content. Scrolling down
   *  still collapses the header before the content moves. */
  showOnUpscroll?: boolean
  /** On by default. A fling released with the header part way carries on with its momentum:
   *  it finishes the header and keeps scrolling the content, instead of stopping at the header's
   *  edge. Off: the release only snaps the header open or closed. */
  momentumScroll?: boolean
}) {
  const {
    disable = false,
    resetKeys,
    defaultHeight,
    showOnUpscroll = false,
    momentumScroll = true,
  } = opts ?? {}
  const [headerExpanded, setHeaderExpanded] = useState(false)
  // Flips true as soon as the header starts collapsing (expandProgress > 0),
  // rather than only once fully collapsed like `headerExpanded`. Lets JS-side
  // consumers (e.g. FadeScrollView's `manualStart`) react to the collapse
  // starting instead of waiting on the ScrollView's own onScroll offset,
  // which lags/never fires while scroll is being simulated via `scrollTo`.
  const [headerCollapsing, setHeaderCollapsing] = useState(false)
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
  // Between 'resize' and 'resized': layouts are ignored and the expected height stands.
  const resizing = useSharedValue(false)
  // The content's last reported `extra`; measuredHeaderHeight - headerExtra is the base height.
  const headerExtra = useSharedValue(0)
  // Set by 'resized': the next layouts are taken even mid-gesture or while collapsed.
  const pendingRemeasure = useSharedValue(false)
  // 'dismissible' from the content, and whether a dismiss-all is running.
  const dismissAll = useSharedValue(false)
  const dismissing = useSharedValue(false)
  // True while a fling's decay is running in the content region.
  const decaying = useSharedValue(false)

  // showOnUpscroll: the header's collapsed distance (0..H) is tracked on its own instead of
  // derived from virtualOffset, so it can re-open while the content stays scrolled. virtualOffset
  // is still the total (header collapsed + content scrolled), which decay, clamping and every
  // caller keep working in; lastVirtualOffset turns its changes into per-frame deltas.
  const upscroll = useSharedValue(showOnUpscroll)
  const headerOffset = useSharedValue(0)
  const lastVirtualOffset = useSharedValue(0)
  useEffect(() => {
    upscroll.value = showOnUpscroll
  }, [showOnUpscroll, upscroll])
  const momentum = useSharedValue(momentumScroll)
  useEffect(() => {
    momentum.value = momentumScroll
  }, [momentumScroll, momentum])

  const headerEvents = useMemo(createHeaderEvents, [])
  const emitDismissed = useCallback(() => headerEvents.emit({ type: 'dismissed' }), [headerEvents])

  /** New header height while collapsed: keep it collapsed and the content where it is. */
  const applyHeaderHeight = (next: number) => {
    'worklet'
    const collapsed = expandProgress.value >= 1
    const scroll = scrollOffset.value
    measuredHeaderHeight.value = next
    if (collapsed) {
      headerOffset.value = next
      // Set before virtualOffset so the reaction reads this as no movement, not a scroll.
      lastVirtualOffset.value = next + scroll
      virtualOffset.value = next + scroll
    } else {
      headerOffset.value = Math.min(headerOffset.value, next)
    }
  }

  useEffect(
    () =>
      headerEvents.subscribe((event) => {
        if (event.type === 'dismissible') {
          dismissAll.value = event.value
        } else if (event.type === 'resize') {
          resizing.value = true
          pendingRemeasure.value = false
          if (event.extra != null) {
            const base = measuredHeaderHeight.value - headerExtra.value
            headerExtra.value = event.extra
            if (measuredHeaderHeight.value > 0) applyHeaderHeight(Math.max(0, base + event.extra))
          }
        } else if (event.type === 'resized') {
          resizing.value = false
          blockHeaderMeasurement.value = false
          pendingRemeasure.value = true
        }
      }),
    // Shared values are stable; headerEvents is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headerEvents]
  )

  const PULL_THRESHOLD = 80
  const pullDistance = useSharedValue(0)
  const pullRefreshTrigger = useSharedValue(0)

  const toggleHeader = (toggle: boolean) => {
    !disable && setHeaderExpanded(toggle)
  }

  const toggleHeaderCollapsing = (toggle: boolean) => {
    !disable && setHeaderCollapsing(toggle)
  }

  const updateOffsets = () => {
    'worklet'
    const v = virtualOffset.value
    const H = measuredHeaderHeight.value || 1
    const dv = v - lastVirtualOffset.value
    lastVirtualOffset.value = v

    let h: number
    if (upscroll.value) {
      // Down: collapse the header first. Up: re-open it first, wherever the content is.
      // Either way the content only moves by what the header didn't take.
      h = clamp(headerOffset.value + dv, 0, H)
      h = Math.min(h, Math.max(v, 0)) // the content can't scroll above its top
    } else {
      // Header collapses over the first H of travel; the content scrolls after that.
      h = clamp(v, 0, H)
    }
    headerOffset.value = h

    // How much of header is collapsed
    const expand = clamp(h / H, 0, 1)
    expandProgress.value = expand

    scheduleOnRN(toggleHeader, expand === 1)
    scheduleOnRN(toggleHeaderCollapsing, expand > 0)

    const scroll = Math.max(0, v - h)
    scrollOffset.value = scroll

    // Only imperatively drive the scroll view when there's a real offset to
    // apply. When v <= 0 the header is fully open and we must NOT call scrollTo
    // so the native overscroll / RefreshControl gesture can accumulate
    // undisturbed — calling scrollTo(0) every frame is what caused jitter.
    if (isScrollViewMounted.value && v > 0) {
      scrollTo(scrollViewRef, 0, scroll, false)
    }
  }

  useAnimatedReaction(
    () => virtualOffset.value,
    (v, prev) => {
      updateOffsets()
      if (expandProgress.value === 0 || expandProgress.value === 1) {
        blockHeaderMeasurement.value = false
      }
      // A fling back toward the top that reaches the header carries on and opens it fully,
      // instead of the decay leaving it half open.
      // (With showOnUpscroll the header already re-opens as soon as the fling turns upward.)
      const H = measuredHeaderHeight.value
      if (!upscroll.value && decaying.value && prev != null && prev >= H && v < H && v < prev) {
        decaying.value = false
        virtualOffset.value = withTiming(0, {
          duration: SNAP_MIN_MS + 60,
          easing: Easing.out(Easing.cubic),
        })
      }
    },
    []
  )

  useEffect(() => {
    // Reset header measurement/state when the page key changes so each tab can re-measure
    virtualOffset.value = 0
    lastVirtualOffset.value = 0
    headerOffset.value = 0
    measuredHeaderHeight.value = defaultHeight ?? 0
    blockHeaderMeasurement.value = false
    expandProgress.value = 0
    scrollOffset.value = 0
    isScrollViewMounted.value = false
    setHeaderCollapsing(false)
  }, [...(resetKeys ?? [])])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .withRef(gestureRef)
        // Vertical-only: this gesture simulates the page's vertical scroll (it
        // only ever reads changeY/velocityY below). Without these bounds it has
        // no axis restriction and wins the gesture arena over any nested
        // horizontal scrollable (e.g. the collapsed CollectionSection's
        // FadeScrollView row), breaking horizontal drags there.
        .activeOffsetY([-10, 10])
        .failOffsetX([-10, 10])
        .onBegin(() => {
          blockHeaderMeasurement.value = true
          pendingRemeasure.value = false
          decaying.value = false
        })
        .onChange((e) => {
          if (measuredHeaderHeight.value <= 0 || dismissing.value) return

          const dy = e.changeY // delta; positive when dragging down
          const drag = -dy // scrolling content up when dragging up

          // Dismiss all: the content asked for the whole header to go in one motion (e.g. an
          // open breakdown). Collapse it fully, then tell the content so it can close itself.
          const H0 = measuredHeaderHeight.value
          if (dismissAll.value && drag > 0 && headerOffset.value < H0) {
            dismissing.value = true
            pullDistance.value = 0
            // Collapse whatever is still showing; the content stays where it is.
            virtualOffset.value = withTiming(
              virtualOffset.value + (H0 - headerOffset.value),
              { duration: DISMISS_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                dismissing.value = false
                if (finished) scheduleOnRN(emitDismissed)
              }
            )
            return
          }

          // At the top and pulling DOWN → accumulate pull indicator distance
          if (virtualOffset.value <= 0 && drag < 0) {
            pullDistance.value = Math.min(pullDistance.value + -drag, PULL_THRESHOLD * 1.5)
            return
          }
          // Dragging up while mid-pull → cancel pull
          if (drag > 0 && pullDistance.value > 0) {
            pullDistance.value = 0
          }

          virtualOffset.value = Math.max(0, virtualOffset.value + drag)
        })
        .onEnd((e) => {
          // Fire refresh if pulled far enough, then snap indicator back
          if (pullDistance.value >= PULL_THRESHOLD) {
            pullRefreshTrigger.value = pullRefreshTrigger.value + 1
          }
          pullDistance.value = withTiming(0, { duration: 200 })

          if (measuredHeaderHeight.value <= 0 || dismissing.value) return

          const H = measuredHeaderHeight.value || 1
          const v0 = -e.velocityY // drag up → positive scroll
          const v = virtualOffset.value
          const h = headerOffset.value
          const scrolled = v - h > 0

          /** Never rest half open: project the release velocity forward and snap the header to
           *  whichever end it lands nearer, moving only the header (the content stays put). The
           *  snap's duration follows the fling, so momentum carries through. */
          const snapHeader = (velocity: number) => {
            'worklet'
            const hNow = headerOffset.value
            const projected = hNow + velocity * SNAP_PROJECTION_S
            const toCollapsed = projected > H / 2
            const target = virtualOffset.value + (toCollapsed ? H - hNow : -hNow)
            virtualOffset.value = withTiming(target, {
              duration: snapDuration(target - virtualOffset.value, velocity),
              easing: Easing.out(Easing.cubic),
            })
          }

          // Header partly open, or open at the very top: settle the header. With momentumScroll
          // only a slow release does; a fling decays through the header into the content below.
          const settling = (h > 0 && h < H) || (!scrolled && h < H)
          if (settling && (!momentum.value || Math.abs(v0) < MOMENTUM_MIN_VELOCITY)) {
            snapHeader(v0)
            return
          }

          // Momentum-scroll the header and content together.
          const scrollableContent = Math.max(0, contentHeight.value - containerHeight.value)
          const maxVirtualOffset = H + scrollableContent

          decaying.value = true
          virtualOffset.value = withDecay(
            {
              velocity: v0,
              clamp: [0, maxVirtualOffset],
            },
            (finished) => {
              decaying.value = false
              // The fling ran out with the header part way (an upward fling re-opening it with
              // showOnUpscroll, or a momentum fling through it): finish in the direction it was
              // heading.
              const hEnd = headerOffset.value
              if (finished && (upscroll.value || momentum.value) && hEnd > 0 && hEnd < H) {
                snapHeader(v0)
              }
            }
          )
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
    headerCollapsing,
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
        if (defaultHeight) return
        const height = e.nativeEvent.layout.height
        // Mid-change: this layout is from before the change landed (see 'resize').
        if (resizing.value) return
        // After a 'resized' event: take it whatever state the header is in (the content lays
        // out at its natural height even while collapsed), keeping a collapsed header collapsed.
        if (pendingRemeasure.value) {
          applyHeaderHeight(height)
          return
        }
        // Otherwise only capture height when header is fully expanded
        if (expandProgress.value === 0 && !blockHeaderMeasurement.value) {
          measuredHeaderHeight.set(height)
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [blockHeaderMeasurement, measuredHeaderHeight, expandProgress, pendingRemeasure, resizing]
    ),
    gestureRef,
    scrollViewRef,
    /** Pass to CollapsibleHeaderEventsProvider around the header content. */
    headerEvents,
    blockHeaderMeasurement,
    measuredHeaderHeight,
    expandProgress,
    virtualOffset,
    pullDistance,
    pullRefreshTrigger,
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
