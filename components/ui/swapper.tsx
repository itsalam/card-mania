// Swapper.tsx
import React, { useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  LinearTransition,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated'

type KeyLike = string | number

type SwapperProps<T extends KeyLike> = {
  /** unique id for what's currently shown (e.g., page index, tab key, item id) */
  currentKey: T
  /** render the view for the current key */
  render: (key: T) => React.ReactNode
  /**
   * Optional: decide direction based on previous vs current.
   * Return +1 to slide in from right (forward),
   * -1 to slide in from left (back),
   *  0 to disable animation.
   */
  compareKeys?: (prev: T, next: T) => -1 | 0 | 1
  /** animation ms */
  duration?: number
  /** style for the outer container */
  style?: any
}

type Direction = -1 | 0 | 1

export function Swapper<T extends KeyLike>({
  currentKey,
  render,
  compareKeys,
  duration = 280,
  style,
}: SwapperProps<T>) {
  const prevKeyRef = useRef<T | null>(null)

  const dir: Direction = useMemo(() => {
    const prev = prevKeyRef.current
    prevKeyRef.current = currentKey
    if (prev == null || prev === currentKey) return 0
    if (compareKeys) return compareKeys(prev, currentKey)
    // Default heuristic for numeric keys: bigger = forward
    if (typeof prev === 'number' && typeof currentKey === 'number') {
      return currentKey > prev ? 1 : -1
    }
    // Otherwise animate always as “forward”
    return 1
  }, [currentKey, compareKeys])

  const entering =
    dir === 1
      ? SlideInRight.duration(duration)
      : dir === -1
      ? SlideInLeft.duration(duration)
      : undefined

  const exiting =
    dir === 1
      ? SlideOutRight.duration(duration)
      : dir === -1
      ? SlideOutLeft.duration(duration)
      : undefined

  return (
    <View style={[styles.container, style]}>
      {/* Key tells React it's a brand new view, triggering enter/exit */}
      <Animated.View
        key={String(currentKey)}
        entering={entering}
        exiting={exiting}
        layout={LinearTransition.duration(duration)}
        style={styles.fill}
      >
        {render(currentKey)}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden', // clips slide movement
  },
  fill: {
    height: '100%',
    width: '100%',
  },
})
