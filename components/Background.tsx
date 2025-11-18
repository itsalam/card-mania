import {
  AnimatedProp,
  Canvas,
  LinearGradient,
  Rect,
  Size,
  SkPoint,
  vec,
} from '@shopify/react-native-skia'
import { BlurView } from 'expo-blur'
import React, { useState } from 'react'
import { ColorValue, LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, { DerivedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
import { useBackgroundColors, useSharedValueLogger } from './utils'

type ColorValueArray = readonly [ColorValue, ColorValue, ...ColorValue[]]
type OptionalColorValueArray = Array<string | undefined>

const ABlur = Animated.createAnimatedComponent(BlurView)

const GRADIENT_START = Object.freeze({ x: 0, y: 1 })
const GRADIENT_END = Object.freeze({ x: 1, y: 0 })

// const S = StyleSheet.create({
//   root: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     width: '100%',
//     height: '100%',
//     opacity: 1,
//   },
// })

// ---- shallow/value equality helpers ----
const arrEq = (a?: readonly any[], b?: readonly any[]) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))

const colorsEq = (a?: OptionalColorValueArray, b?: OptionalColorValueArray) => {
  // compare by value, treating undefined as a value
  return arrEq(a, b)
}

const opacityEq = (a?: number | number[], b?: number | number[]) => {
  if (Array.isArray(a) || Array.isArray(b)) return arrEq(a as any, b as any)
  return a === b
}

// ---- component ----
function BackgroundBase({
  style,
  colors,
  opacity = 1,
  children,
  start,
  end,
  ...props
}: React.ComponentProps<typeof View> & {
  start?: SkPoint
  end?: SkPoint
  colors?: OptionalColorValueArray
  opacity?: AnimatedProp<number | number[]>
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width !== size.width || height !== size.height) {
      setSize({ width, height })
    }
  }

  const ready = size.width > 0 && size.height > 0
  const defaultColors: ColorValueArray = useBackgroundColors() // make this hook return a stable array if possible
  // derive a stable key for defaultColors in case the hook returns a new array with same values
  const defaultKey = React.useMemo(() => defaultColors.join('|'), [defaultColors])

  const resolveOpacity = (o: AnimatedProp<number | number[]>) => {
    'worklet'

    // SharedValue / DerivedValue style
    if (o && typeof o === 'object' && 'value' in o) {
      return o.value as number | number[]
    }

    // Plain number / number[] or undefined
    return (o ?? 1) as number | number[]
  }

  const rgba = (hex: string, alpha: number): string => {
    'worklet'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  const finalColors = useDerivedValue(() => {
    'worklet'
    const src = colors ?? defaultColors
    const filled = src.map((c, i) => c || defaultColors[Math.min(defaultColors.length - 1, i)])
    const resOpacity = resolveOpacity(opacity)
    return filled.map((c, i) =>
      rgba(String(c), (Array.isArray(resOpacity) ? resOpacity[i] : resOpacity)!)
    )
  }, [colors, defaultKey, opacity])

  const gradientStart = start
    ? vec(size.width * start.x, size.height * start.y)
    : vec(0, size.height)

  const gradientEnd = end ? vec(size.width * end.x, size.height * end.y) : vec(size.width, 0)

  return (
    <View style={styles.container} onLayout={onLayout}>
      {ready && (
        <Canvas style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient colors={finalColors} start={gradientStart} end={gradientEnd} />
          </Rect>
        </Canvas>
      )}
      {children}
    </View>
  )
  // return (
  //   <LinearGradient
  //     colors={finalColors}
  //     start={GRADIENT_START}
  //     end={GRADIENT_END}
  //     style={[S.root, style]} // base style is stable; array identity is fine
  //     {...props}
  //   />
  // )
}

// Pure component with custom equality (prevents rerenders if prop *values* are the same)
export const Background = React.memo(BackgroundBase, (prev, next) => {
  if (!colorsEq(prev.colors as any, next.colors as any)) return false
  if (!opacityEq(prev.opacity as any, next.opacity as any)) return false
  // if you often pass inline styles, consider memoizing them at the callsite,
  // otherwise shallow-compare here (RN flattens internally anyway).
  if (prev.style !== next.style) return false
  // compare other props you pass to LinearGradient if any (start/end are constants here)
  return true
})

// Blur variant — no callback component; just memoize the wrapper
export const BlurBackground = React.memo(function BlurBackground({
  children,
  intensity = 30,
  opacity,
  backgroundOpacity,
  ...props
}: Omit<React.ComponentProps<typeof Background>, 'opacity'> & {
  intensity?: number
  opacity: DerivedValue<number>
  backgroundOpacity?: DerivedValue<number[]>
}) {
  const blurOpacity = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
    }),
    [opacity]
  )
  useSharedValueLogger('o', opacity)
  return (
    <Background {...props} opacity={backgroundOpacity}>
      <ABlur intensity={intensity} style={[styles.animatedBlur, blurOpacity]} />
      {children}
    </Background>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'relative', // required so absoluteFill is relative to this view
    flex: 1,
  },
  animatedBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})
