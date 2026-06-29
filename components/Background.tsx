import {
  AnimatedProp,
  Canvas,
  LinearGradient,
  Path,
  Skia,
  SkPoint,
  vec,
} from '@shopify/react-native-skia'
import { BlurView } from 'expo-blur'
import React, { useLayoutEffect, useMemo } from 'react'
import { ColorValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  AnimatedStyle,
  DerivedValue,
  SharedValue,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useBackgroundColors } from './utils'

type ColorValueArray = readonly [ColorValue, ColorValue, ...ColorValue[]]
type OptionalColorValueArray = (string | undefined)[]

export type ShoulderCutoutDescriptor = {
  /** SharedValue driven directly by onCutoutSize — no React re-render needed */
  pillWSv: SharedValue<number>
  /** Height of the pill / header row — where the background becomes full-width below */
  headerHeight: number
  /** Corner radius of the pill's bottom-left corner (and background's matching concave arc) */
  cornerR: number
}

const ABlur = Animated.createAnimatedComponent(BlurView)

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
  shoulderCutout,
  ...props
}: React.ComponentProps<typeof View> & {
  start?: SkPoint
  end?: SkPoint
  colors?: OptionalColorValueArray
  opacity?: AnimatedProp<number | number[]>
  positions?: number[]
  shoulderCutout?: ShoulderCutoutDescriptor
}) {
  const sizeSv = useSharedValue({ width: 0, height: 0 })
  const defaultColors: ColorValueArray = useBackgroundColors()

  const cutoutDescSv = useSharedValue<{ hH: number; CR: number } | null>(null)

  // Static config is only set once (headerHeight/cornerR are constants).
  useLayoutEffect(() => {
    cutoutDescSv.value = shoulderCutout
      ? { hH: shoulderCutout.headerHeight, CR: shoulderCutout.cornerR }
      : null
  }, [!!shoulderCutout, shoulderCutout?.headerHeight, shoulderCutout?.cornerR])

  // useDerivedValue + withSpring: the derived value retargets whenever pillWSv changes
  // and preserves animation state across re-renders (backed by a ref internally).
  // This avoids the useAnimatedReaction teardown/re-setup race that caused animPillW
  // to reset to 0 when BackgroundBase re-rendered (children change) mid-animation.
  const fallbackPillWSv = useSharedValue(0)
  const activePillWSv = shoulderCutout?.pillWSv ?? fallbackPillWSv

  const animPillW = useDerivedValue(() => {
    'worklet'
    return withSpring(activePillWSv.value, { damping: 20, stiffness: 260, mass: 0.9 })
  })

  const cutSkPath = useMemo(() => Skia.Path.Make(), [])
  const cutPath = useDerivedValue(() => {
    'worklet'
    const W = sizeSv.value.width
    const H = sizeSv.value.height
    const pillW = animPillW.value
    const desc = cutoutDescSv.value
    cutSkPath.reset()

    if (!desc || pillW < 2 * desc.CR) {
      // No cutout or pill too narrow for valid arc geometry — fill full rect.
      cutSkPath.moveTo(0, 0)
      cutSkPath.lineTo(W, 0)
      cutSkPath.lineTo(W, H)
      cutSkPath.lineTo(0, H)
      cutSkPath.close()
      return cutSkPath
    }

    const { hH, CR } = desc
    const px = W - pillW

    // L-shape: full rect minus top-right pill void, with 3 matching arcs.
    cutSkPath.moveTo(0, 0)
    cutSkPath.lineTo(px - CR, 0)
    // Convex corner (top-right of gradient notch): CW 90°
    cutSkPath.arcToOval({ x: px - CR, y: -CR, width: 2 * CR, height: 2 * CR }, 180, 90, false)
    cutSkPath.lineTo(px, hH - CR)
    // Concave inner corner: CCW 90°
    cutSkPath.arcToOval({ x: px, y: hH - 2 * CR, width: 2 * CR, height: 2 * CR }, 180, -90, false)
    cutSkPath.lineTo(W - CR, hH)
    // Convex corner at bottom-right: CW 90° → curves up to (W, hH - CR)
    cutSkPath.arcToOval({ x: W - CR, y: hH - CR, width: 2 * CR, height: 2 * CR }, 180, 90, false)
    cutSkPath.lineTo(W, H)
    cutSkPath.lineTo(0, H)
    cutSkPath.close()
    return cutSkPath
  }, [animPillW, sizeSv, cutoutDescSv])

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

  return (
    <View style={[styles.container, style]} {...props}>
      <Canvas style={[StyleSheet.absoluteFill]} pointerEvents="none" onSize={sizeSv}>
        <Path path={cutPath}>
          <LinearGradient
            colors={finalColors}
            start={gradientStart}
            end={gradientEnd}
            positions={positions}
          />
        </Path>
      </Canvas>

      {children}
    </View>
  )
}

export const GradientBackground = React.memo(BackgroundBase, (prev, next) => {
  if (!colorsEq(prev.colors as any, next.colors as any)) return false
  if (!opacityEq(prev.opacity as any, next.opacity as any)) return false
  if (prev.style !== next.style) return false
  if (prev.children !== next.children) return false
  if (prev.shoulderCutout !== next.shoulderCutout) return false
  return true
})

// Blur variant — no callback component; just memoize the wrapper
export const BlurGradientBackground = React.memo(function BlurBackground({
  children,
  intensity = 30,
  opacity,
  backgroundOpacity,
  blurStyle,
  ...props
}: Omit<React.ComponentProps<typeof GradientBackground>, 'opacity'> & {
  intensity?: number
  opacity?: DerivedValue<number>
  backgroundOpacity?: AnimatedProp<number | number[]>
  blurStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
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
    <BackgroundBase {...props} opacity={backgroundOpacity}>
      <ABlur
        style={[blurStyle, StyleSheet.absoluteFill]}
        pointerEvents="none"
        animatedProps={animProps}
      />
      {children}
    </BackgroundBase>
  )
})

export const BlurBackground = React.memo(function BlurBackground({
  children,
  intensity = 30,
  opacity,
  ...props
}: Omit<React.ComponentProps<typeof View>, 'opacity'> & {
  intensity?: number
  opacity?: DerivedValue<number>
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
    <View {...props}>
      <ABlur style={[StyleSheet.absoluteFill]} pointerEvents="none" animatedProps={animProps} />
      {children}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'relative', // required so absoluteFill is relative to this view
    flex: 1,
  },
  animatedBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%' },
})
