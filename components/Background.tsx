import {
  AnimatedProp,
  Canvas,
  LinearGradient,
  Rect,
  SkPoint,
  vec,
} from '@shopify/react-native-skia'
import { BlurView } from 'expo-blur'
import React from 'react'
import { ColorValue, StyleSheet, View } from 'react-native'
import Animated, {
  DerivedValue,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { useBackgroundColors } from './utils'

type ColorValueArray = readonly [ColorValue, ColorValue, ...ColorValue[]]
type OptionalColorValueArray = Array<string | undefined>

const ABlur = Animated.createAnimatedComponent(BlurView)

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
  positions,
  ...props
}: React.ComponentProps<typeof View> & {
  start?: SkPoint
  end?: SkPoint
  colors?: OptionalColorValueArray
  opacity?: AnimatedProp<number | number[]>
  positions?: number[]
}) {
  const sizeSv = useSharedValue({ width: 0, height: 0 })
  const defaultColors: ColorValueArray = useBackgroundColors() // make this hook return a stable array if possible

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
  }, [colors, opacity])

  const gradientStart = useDerivedValue(
    () =>
      start
        ? vec(sizeSv.value.width * start.x, sizeSv.value.height * start.y)
        : vec(0, sizeSv.value.height),
    [start, sizeSv]
  )

  const gradientEnd = useDerivedValue(
    () =>
      end
        ? vec(sizeSv.value.width * end.x, sizeSv.value.height * end.y)
        : vec(sizeSv.value.width, 0),
    [end, sizeSv]
  )

  const width = useDerivedValue(() => sizeSv.value.width, [sizeSv])
  const height = useDerivedValue(() => sizeSv.value.height, [sizeSv])

  return (
    <View style={[styles.container, style]} {...props}>
      <Canvas style={[StyleSheet.absoluteFill]} pointerEvents="none" onSize={sizeSv}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            colors={finalColors}
            start={gradientStart}
            end={gradientEnd}
            positions={positions}
          />
        </Rect>
      </Canvas>

      {children}
    </View>
  )
}

// Pure component with custom equality (prevents rerenders if prop *values* are the same)
export const GradientBackground = React.memo(BackgroundBase, (prev, next) => {
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
}: Omit<React.ComponentProps<typeof GradientBackground>, 'opacity'> & {
  intensity?: number
  opacity?: DerivedValue<number>
  backgroundOpacity?: AnimatedProp<number | number[]>
}) {
  const fallbackOpacity = useSharedValue(1)
  const fOpacity = opacity ?? fallbackOpacity
  const animProps = useAnimatedProps(
    () => ({
      intensity: fOpacity.value * intensity,
    }),
    [opacity]
  )

  return (
    <GradientBackground {...props} opacity={backgroundOpacity}>
      <BlurView
        style={[StyleSheet.absoluteFill]}
        pointerEvents="none"
        intensity={fOpacity.value * intensity}
      />
      {children}
    </GradientBackground>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'relative', // required so absoluteFill is relative to this view
    flex: 1,
  },
  animatedBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%' },
})
