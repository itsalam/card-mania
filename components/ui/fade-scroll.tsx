import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import React, { forwardRef, useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native'
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
      ...props
    },
    ref
  ) {
    const scrollInfoRef = useRef({ offset: 0, contentSize: 0, viewSize: 0 })
    const [edgeState, setEdgeState] = useState({ start: true, end: true })
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

    const effectiveStart = edgeState.start && !manualStart
    const effectiveEnd = edgeState.end && !manualEnd

    const checkEdges = useCallback(() => {
      const { offset, contentSize, viewSize } = scrollInfoRef.current
      const atStart = offset <= 2
      const atEnd = contentSize <= 0 || offset + viewSize >= contentSize - 2
      setEdgeState((prev) =>
        prev.start === atStart && prev.end === atEnd ? prev : { start: atStart, end: atEnd }
      )
    }, [])

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
        checkEdges()
        onContentSizeChange?.(w, h)
      },
      [horizontal, checkEdges, onContentSizeChange]
    )

    const handleScrollLayout = useCallback(
      (e: any) => {
        const { width, height } = e.nativeEvent.layout
        scrollInfoRef.current.viewSize = horizontal ? width : height
        checkEdges()
        onLayout?.(e)
      },
      [horizontal, checkEdges, onLayout]
    )

    const handleContainerLayout = useCallback((e: any) => {
      const { width, height } = e.nativeEvent.layout
      setDims({ w: width, h: height })
    }, [])

    const ScrollComponent = animated ? Animated.ScrollView : ScrollView

    const scrollView = (
      <ScrollComponent
        ref={ref}
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
        <View collapsable={false} style={[{ position: 'relative' }, style]}>
          {scrollView}
          {startGradient}
          {endGradient}
        </View>
      )
    }

    const maskElement = (
      <View style={{ height: '100%', width: '100%' }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }]} />
        {!effectiveStart && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)', 'black']}
            locations={[0, 0.3, 0.65, 1]}
            start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
            end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
            style={
              horizontal
                ? { position: 'absolute', top: 0, bottom: 0, left: 0, width: fadeSize }
                : { position: 'absolute', top: 0, left: 0, right: 0, height: fadeSize }
            }
          />
        )}
        {!effectiveEnd && (
          <LinearGradient
            colors={['black', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'transparent']}
            locations={[0, 0.35, 0.7, 1]}
            start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
            end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
            style={
              horizontal
                ? { position: 'absolute', top: 0, bottom: 0, right: 0, width: fadeSize }
                : { position: 'absolute', bottom: 0, left: 0, right: 0, height: fadeSize }
            }
          />
        )}
      </View>
    )

    return (
      <View style={style} onLayout={handleContainerLayout}>
        {dims ? (
          <MaskedView style={{ width: dims.w, height: dims.h }} maskElement={maskElement}>
            {scrollView}
          </MaskedView>
        ) : (
          scrollView
        )}
      </View>
    )
  }
)
