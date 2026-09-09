import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  Text as RNText,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native'
import Animated, { type EntryOrExitLayoutType } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'

type FadeScrollViewProps = ScrollViewProps & {
  /** Pixel size of the fade zone at each edge. Default 28. */
  fadeSize?: number
  /** Style applied to the outer container View (controls layout/sizing). */
  style?: ViewStyle
  /** Render an Animated.ScrollView (react-native-reanimated) instead of a plain
   *  ScrollView — required for `entering`/`exiting` props, and for refs created
   *  via `useAnimatedRef` (e.g. Reanimated's `scrollTo`). Also switches the fade
   *  from a MaskedView alpha-mask to a solid-color gradient overlay — MaskedView's
   *  mask reliably fails to (re)composite when its masked content is an
   *  Animated.ScrollView driven by worklet `scrollTo` (a documented upstream
   *  incompatibility between @react-native-masked-view and Reanimated-driven
   *  scroll content), so this mode trades "works over any background" for
   *  "works over animated content" by blending into `fadeColor` instead. */
  animated?: boolean
  /** Only used when `animated` — the solid color the gradient overlay blends
   *  into. Should match the surface directly behind this scroll view. */
  fadeColor?: string
  entering?: EntryOrExitLayoutType
  exiting?: EntryOrExitLayoutType
  /** Force the start-edge fade to show regardless of the internally-tracked
   *  scroll offset. For use with an externally-driven scroll (e.g. a
   *  collapsible header that simulates scroll via `scrollTo` on the UI
   *  thread with `scrollEnabled={false}`), where JS `onScroll` events lag or
   *  never fire, so the offset-based edge check alone would trigger too
   *  late. Pass a condition that goes true as soon as the header begins
   *  collapsing (e.g. `expandProgress < 1`) to have the fade appear
   *  immediately instead of waiting for real scroll offset. */
  manualStart?: boolean
  /** Same as `manualStart`, but for the end edge. */
  manualEnd?: boolean
  /** Diagnostic-only — never enable outside active debugging. Console-logs every measurement
   *  (outer container onLayout, inner ScrollView onLayout, onContentSizeChange, onScroll) plus
   *  the atStart/atEnd computation, and renders a live on-screen overlay of the tracked numbers
   *  plus colored outlines (lime = outer container box FadeScrollView's own `style` sizes; cyan =
   *  the actual ScrollView box being measured for overflow) — for telling apart "the fade logic
   *  computed the wrong answer" from "the ScrollView never measured as overflowing at all". */
  debug?: boolean
}

/**
 * ScrollView that fades content at whichever edges are not fully scrolled.
 * Works for both horizontal and vertical scroll directions. Pass `animated`
 * to back it with `Animated.ScrollView` instead of the plain RN one.
 */
export const FadeScrollView = forwardRef<ScrollView | Animated.ScrollView, FadeScrollViewProps>(
  function FadeScrollView(
    {
      fadeSize = 28,
      horizontal,
      style,
      children,
      onScroll,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle,
      animated,
      fadeColor = Colors.$backgroundElevatedLight,
      manualStart,
      manualEnd,
      debug,
      ...props
    },
    ref
  ) {
    const scrollInfoRef = useRef({ offset: 0, contentSize: 0, viewSize: 0 })
    const [edgeState, setEdgeState] = useState({ start: true, end: true })
    // Render-visible (not debug-gated) — the single-gradient mask below needs the ScrollView's
    // actual pixel box size to convert `fadeSize` (px) into fractional gradient `locations`.
    const [viewSize, setViewSize] = useState(0)
    // Mirrors scrollInfoRef into render-visible state, debug-only — the ref alone doesn't
    // trigger a re-render, so the on-screen overlay below would only refresh whenever edgeState
    // happened to also flip, not on every raw measurement.
    const [debugInfo, setDebugInfo] = useState({ offset: 0, contentSize: 0, viewSize: 0 })

    const effectiveStart = edgeState.start && !manualStart
    const effectiveEnd = edgeState.end && !manualEnd
    // What the render below actually decides — as distinct from the raw offset/contentSize/
    // viewSize measurement checkEdges computes. edgeState can be correct while these are still
    // wrong (e.g. a stale `manualStart`/`manualEnd` override forcing effectiveStart/End true, or
    // `dims` never resolving so the mask never mounts at all) — logging this separately tells
    // "the overflow measurement is right but nothing renders" apart from "the measurement itself
    // is wrong" (the other debug logging already covers that half).
    const willRenderStartFade = !effectiveStart
    const willRenderEndFade = !effectiveEnd

    useEffect(() => {
      if (!debug) return
      console.log('[FadeScrollView] intended fade render state', {
        mode: animated ? 'animated (gradient overlay)' : 'default (MaskedView alpha mask)',
        fadeSize,
        edgeState,
        manualStart: !!manualStart,
        manualEnd: !!manualEnd,
        effectiveStart,
        effectiveEnd,
        willRenderStartFade,
        willRenderEndFade,
      })
    }, [
      debug,
      animated,
      fadeSize,
      edgeState,
      manualStart,
      manualEnd,
      effectiveStart,
      effectiveEnd,
      willRenderStartFade,
      willRenderEndFade,
    ])

    const checkEdges = useCallback(() => {
      const { offset, contentSize, viewSize } = scrollInfoRef.current
      const atStart = offset <= 2
      const atEnd = contentSize <= 0 || offset + viewSize >= contentSize - 2
      if (debug) {
        console.log('[FadeScrollView] checkEdges', {
          offset,
          contentSize,
          viewSize,
          overflowing: contentSize > viewSize,
          atStart,
          atEnd,
        })
        setDebugInfo({ offset, contentSize, viewSize })
      }
      setEdgeState((prev) =>
        prev.start === atStart && prev.end === atEnd ? prev : { start: atStart, end: atEnd }
      )
    }, [debug])

    const handleScroll = useCallback(
      (e: any) => {
        scrollInfoRef.current.offset = horizontal
          ? e.nativeEvent.contentOffset.x
          : e.nativeEvent.contentOffset.y
        checkEdges()
        onScroll?.(e)
      },
      [horizontal, checkEdges, onScroll]
    )

    const handleContentSizeChange = useCallback(
      (w: number, h: number) => {
        scrollInfoRef.current.contentSize = horizontal ? w : h
        if (debug)
          console.log('[FadeScrollView] onContentSizeChange (inner content size)', { w, h })
        checkEdges()
        onContentSizeChange?.(w, h)
      },
      [horizontal, checkEdges, onContentSizeChange, debug]
    )

    const handleScrollLayout = useCallback(
      (e: any) => {
        const { width, height } = e.nativeEvent.layout
        const size = horizontal ? width : height
        scrollInfoRef.current.viewSize = size
        setViewSize(size)
        if (debug)
          console.log('[FadeScrollView] ScrollView onLayout (inner box actually measured)', {
            width,
            height,
          })
        checkEdges()
        onLayout?.(e)
      },
      [horizontal, checkEdges, onLayout, debug]
    )

    const handleContainerLayout = useCallback(
      (e: any) => {
        if (!debug) return
        const { width, height } = e.nativeEvent.layout
        console.log('[FadeScrollView] outer container onLayout (style prop sizes this)', {
          width,
          height,
        })
      },
      [debug]
    )

    // Live numbers overlay, debug-only — lime border marks the OUTER container box (what
    // `style` actually sizes); cyan border (on ScrollComponent above) marks the INNER
    // ScrollView box actually used for the overflow check. If cyan hugs the content instead of
    // matching lime, the ScrollView isn't measuring as bounded by its container — the same class
    // of bug this component's inner `style` fix (see the comment on ScrollComponent) addressed.
    const debugOverlay = debug && (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          zIndex: 999,
          backgroundColor: 'rgba(0,0,0,0.75)',
          paddingHorizontal: 6,
          paddingVertical: 4,
          borderRadius: 4,
        }}
      >
        <RNText style={{ color: '#0f0', fontSize: 9, fontFamily: 'monospace' }}>
          {`view:${Math.round(debugInfo.viewSize)} content:${Math.round(debugInfo.contentSize)} offset:${Math.round(debugInfo.offset)}`}
          {'\n'}
          {`overflow:${debugInfo.contentSize > debugInfo.viewSize}`}
          {'\n'}
          {`mode:${animated ? 'gradient' : 'mask'} fadeSize:${fadeSize} manual:${!!manualStart}/${!!manualEnd}`}
          {'\n'}
          {`effective start:${effectiveStart} end:${effectiveEnd} → render start:${willRenderStartFade} end:${willRenderEndFade}`}
        </RNText>
      </View>
    )

    const ScrollComponent = animated ? Animated.ScrollView : ScrollView

    const scrollView = (
      <ScrollComponent
        ref={ref}
        // `style` (above) only ever sizes the OUTER container View/MaskedView — it's never
        // forwarded to the ScrollView itself via `props` (it's destructured off, precisely so
        // it doesn't also land on the outer container's sibling here as a duplicate). Without an
        // explicit fill style of its own, the ScrollView's scrollable box sizes to its CONTENT
        // instead of to the container, so it can never measure as "overflowing" — viewSize ends
        // up ~= contentSize, the start/end edge checks below always read "already at the edge",
        // and the fade gradients never render.
        style={[
          { flex: 1, alignSelf: 'stretch' },
          debug && { borderWidth: 2, borderColor: 'cyan' },
        ]}
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleScrollLayout}
        {...props}
      >
        {children}
      </ScrollComponent>
    )

    if (animated) {
      const alpha = (a: number) => Colors.rgba(fadeColor, a) ?? fadeColor

      const startGradient = !effectiveStart && (
        <LinearGradient
          pointerEvents="none"
          colors={[fadeColor, alpha(0.85), alpha(0.4), alpha(0)]}
          locations={[0, 0.35, 0.7, 1]}
          start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
          end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
          style={
            horizontal
              ? { position: 'absolute', top: 0, bottom: 0, left: 0, width: fadeSize }
              : { position: 'absolute', top: 0, left: 0, right: 0, height: fadeSize }
          }
        />
      )
      const endGradient = !effectiveEnd && (
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(0), alpha(0.4), alpha(0.85), fadeColor]}
          locations={[0, 0.3, 0.65, 1]}
          start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
          end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
          style={
            horizontal
              ? { position: 'absolute', top: 0, bottom: 0, right: 0, width: fadeSize }
              : { position: 'absolute', bottom: 0, left: 0, right: 0, height: fadeSize }
          }
        />
      )

      return (
        <View
          collapsable={false}
          style={[
            { position: 'relative' },
            style,
            debug && { borderWidth: 2, borderColor: 'lime' },
          ]}
        >
          {scrollView}
          {startGradient}
          {endGradient}
          {debugOverlay}
        </View>
      )
    }

    // Single gradient spanning the whole box, not a base fill + up to two separately
    // absolutely-positioned overlay gradients layered on top of it — the previous 3-view
    // composite maskElement is a plausible native-snapshot/flattening hazard of its own for
    // MaskedView specifically (independent of the remount race fixed above): some
    // @react-native-masked-view versions/platforms are known to be unreliable about capturing a
    // maskElement whose visible result depends on overlapping absolutely-positioned siblings,
    // as opposed to one single view's own rendered pixels. `locations` converts `fadeSize` (px)
    // into a fraction of the ScrollView's own measured box (`viewSize`) so the fade zone is the
    // same pixel size as before; each end collapses to a hard 'black' edge when that side is
    // already fully scrolled (effectiveStart/effectiveEnd), leaving black (fully visible)
    // in between.
    const fadeFraction = viewSize > 0 ? Math.min(Math.max(fadeSize / viewSize, 0.001), 0.49) : 0.15
    const maskElement = (
      <LinearGradient
        colors={[
          effectiveStart ? 'black' : 'transparent',
          'black',
          'black',
          effectiveEnd ? 'black' : 'transparent',
        ]}
        locations={[0, fadeFraction, 1 - fadeFraction, 1]}
        start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={{ flex: 1, width: '100%', height: '100%' }}
      />
    )

    return (
      <View
        style={[style, debug && { borderWidth: 2, borderColor: 'lime' }]}
        onLayout={handleContainerLayout}
      >
        {/* MaskedView mounts immediately, sized by ordinary flex like any other View — it used
            to wait for a measured pixel `dims` from onLayout before mounting at all, swapping
            the ScrollView from a plain child straight into a brand-new MaskedView the instant
            that first layout fired. That remount landed right as this component's own
            Reanimated-driven ancestors (an opacity fade, a slide-in entrance transition) were
            actively animating in — plausibly the exact trigger for MaskedView's mask failing to
            (re)composite, matching the documented Reanimated/MaskedView interop gap this file
            already calls out for `animated`'s Animated.ScrollView case, just via a remount
            colliding with an ancestor's UI-thread animation instead of `scrollTo`. Mounting once,
            up front, removes that race entirely. */}
        <MaskedView style={{ flex: 1, alignSelf: 'stretch' }} maskElement={maskElement}>
          {scrollView}
        </MaskedView>
        {debugOverlay}
      </View>
    )
  }
)
