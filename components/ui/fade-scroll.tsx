import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native'

type FadeScrollViewProps = ScrollViewProps & {
  /** Pixel size of the fade zone at each edge. Default 28. */
  fadeSize?: number
  /** Style applied to the outer container View (controls layout/sizing). */
  style?: ViewStyle
}

/**
 * ScrollView that fades content at whichever edges are not fully scrolled.
 * Works for both horizontal and vertical scroll directions.
 */
export function FadeScrollView({
  fadeSize = 28,
  horizontal,
  style,
  children,
  onScroll,
  onContentSizeChange,
  onLayout,
  scrollEventThrottle,
  ...props
}: FadeScrollViewProps) {
  const scrollInfoRef = useRef({ offset: 0, contentSize: 0, viewSize: 0 })
  const [edgeState, setEdgeState] = useState({ start: true, end: true })
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

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

  const maskElement = (
    <View style={{ height: '100%', width: '100%' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }]} />
      {!edgeState.start && (
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
      {!edgeState.end && (
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

  const scrollView = (
    <ScrollView
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
    </ScrollView>
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
