import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  DerivedValue,
  StyleProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useBackgroundColors } from './utils'

type OptionalColorValueArray = (string | undefined)[]

export const GradientBackground = React.memo(function GradientBackground({
  style,
  colors,
  opacity,
  children,
  start,
  end,
  positions,
  ...props
}: React.ComponentProps<typeof View> & {
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  colors?: OptionalColorValueArray
  opacity?: any
  positions?: number[]
}) {
  const defaultColors = useBackgroundColors() as string[]
  const resolved = (colors ?? defaultColors).filter(Boolean) as string[]
  const c: [string, string, ...string[]] =
    resolved.length >= 2
      ? (resolved as [string, string, ...string[]])
      : [resolved[0] ?? '#000', resolved[0] ?? '#000']

  return (
    <View style={[styles.container, style]} {...props}>
      <LinearGradient
        colors={c}
        start={start ?? { x: 0, y: 1 }}
        end={end ?? { x: 1, y: 0 }}
        locations={positions as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  )
})

export const BlurGradientBackground = React.memo(function BlurGradientBackground({
  children,
  intensity = 30,
  opacity,
  backgroundOpacity,
  blurStyle,
  ...props
}: React.ComponentProps<typeof GradientBackground> & {
  intensity?: number
  opacity?: DerivedValue<number>
  backgroundOpacity?: any
  blurStyle?: any
}) {
  const fallbackOpacity = useSharedValue(1)
  const fOpacity = opacity ?? fallbackOpacity
  const blurAnimStyle = useAnimatedStyle(
    () =>
      ({
        backdropFilter: `blur(${fOpacity.value * intensity * 0.2}px)`,
      }) as StyleProps
  )

  return (
    <GradientBackground {...props} opacity={backgroundOpacity}>
      <Animated.View
        style={[blurStyle, StyleSheet.absoluteFill, blurAnimStyle]}
        pointerEvents="none"
      />
      {children}
    </GradientBackground>
  )
})

export const BlurBackground = React.memo(function BlurBackground({
  children,
  intensity = 30,
  opacity,
  ...props
}: React.ComponentProps<typeof View> & {
  intensity?: number
  opacity?: DerivedValue<number>
}) {
  const fallbackOpacity = useSharedValue(1)
  const fOpacity = opacity ?? fallbackOpacity
  const blurAnimStyle = useAnimatedStyle(
    () =>
      ({
        backdropFilter: `blur(${fOpacity.value * intensity * 0.2}px)`,
      }) as StyleProps
  )

  return (
    <View {...props}>
      <Animated.View style={[StyleSheet.absoluteFill, blurAnimStyle]} pointerEvents="none" />
      {children}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { position: 'relative', flex: 1 },
})
