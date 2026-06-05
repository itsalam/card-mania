import { useCombinedRefs } from '@/components/hooks/useCombinedRefs'
import React, { forwardRef, useEffect, useMemo } from 'react'
import { ColorValue, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps } from 'react-native'
import Animated, {
  DerivedValue,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { BorderRadiuses } from 'react-native-ui-lib'
import { DURATION, GAP_PADDING, styles } from '../input/styles'
import { FieldDecoratorContext } from './provider'

const AnimatedPath = Animated.createAnimatedComponent(Path)

type DynamicBorderBoxProps = ViewProps & {
  label?: string
  labelStyle?: StyleProp<TextStyle>
  forceFloat?: boolean
  color: DerivedValue<ColorValue>
  opacity: DerivedValue<number>
}

export const DynamicBorderBox = forwardRef<View, DynamicBorderBoxProps>(
  ({ style, children, label, labelStyle, onLayout, forceFloat, color, opacity, ...props }, ref) => {
    const animRef = useAnimatedRef<View>()
    const combinedRef = useCombinedRefs(ref, animRef)

    const labelWidthSV = useSharedValue(0)
    const forceFloatSV = useSharedValue(forceFloat ?? false)
    const widthSV = useSharedValue(0)
    const heightSV = useSharedValue(0)

    useEffect(() => {
      console.log(
        '[DynamicBorderBox.web] forceFloat:',
        forceFloat,
        'labelWidth:',
        labelWidthSV.value
      )
      forceFloatSV.value = forceFloat ?? false
    }, [forceFloat])

    const {
      borderWidth: strokeWidth,
      backgroundColor,
      ...containerStyle
    } = useMemo(
      () => ({
        borderWidth: 1.5,
        fontSize: 16,
        ...StyleSheet.flatten(style),
      }),
      [style]
    )
    const radius = BorderRadiuses.br40

    // Animate gap width exactly as native: labelWidth + GAP_PADDING, timed with DURATION
    const gapWidth = useDerivedValue(() =>
      withTiming(forceFloatSV.value ? labelWidthSV.value + GAP_PADDING : 0, { duration: DURATION })
    )

    // SVG equivalent of Skia RoundedRect + DashPathEffect.
    //
    // The path starts at the bottom of the left edge and goes counterclockwise:
    //   up left → top-left corner → across top → top-right corner →
    //   down right → bottom-right corner → across bottom → bottom-left corner
    //
    // This matches the Skia path direction, so the native dasharray offset formula
    //   offset = vertical + arcPerim/4 - GAP_PADDING*2
    // produces the same gap position on the top-left area of the border.
    // Mirror the prior CSS border approach: opacity on the wrapper, color on the stroke.
    const borderStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }))

    const animatedPathProps = useAnimatedProps(() => {
      const sw = strokeWidth // JS closure — constant at runtime
      const R = radius // JS closure — constant at runtime
      const baseReturn = {
        d: '',
        strokeDasharray: '0',
        stroke: color.value as string,
        strokeWidth: sw,
        fill: (backgroundColor as string) ?? 'none',
      }

      const W = widthSV.value
      const H = heightSV.value
      if (W <= 0 || H <= 0) return baseReturn

      const inset = sw / 2
      const rw = Math.max(0, W - sw)
      const rh = Math.max(0, H - sw)
      const r = Math.min(R, rw / 2, rh / 2)
      const x = inset
      const y = inset

      const d = [
        `M ${x} ${y + rh - r}`,
        `L ${x} ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        `L ${x + rw - r} ${y}`,
        `A ${r} ${r} 0 0 1 ${x + rw} ${y + r}`,
        `L ${x + rw} ${y + rh - r}`,
        `A ${r} ${r} 0 0 1 ${x + rw - r} ${y + rh}`,
        `L ${x + r} ${y + rh}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + rh - r}`,
        'Z',
      ].join(' ')

      const horizontal = Math.max(0, rw - 2 * r)
      const vertical = Math.max(0, rh - 2 * r)
      const arcPerim = 2 * Math.PI * r
      const P = 2 * (horizontal + vertical) + arcPerim

      const gap = gapWidth.value
      const clampedGap = Math.max(0, Math.min(gap, P - 0.001))
      const offset = Math.max(0, vertical + arcPerim / 4 - GAP_PADDING * 2)

      const strokeDasharray =
        clampedGap > 0.5
          ? `${offset} ${clampedGap} ${Math.max(0, P - clampedGap - offset)} 0`
          : `${P}`

      return { ...baseReturn, d, strokeDasharray }
    })

    const context = useMemo(
      () => ({
        label,
        accentColor: color,
        opacity,
        floatOnFocus: true,
        forceFloat: forceFloat || false,
      }),
      [label, color, opacity, forceFloat]
    )

    return (
      <FieldDecoratorContext.Provider value={context}>
        <Animated.View
          collapsable={false}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout
            widthSV.value = width
            heightSV.value = height
            onLayout?.(e)
          }}
          style={[ExtraStyles.container, containerStyle]}
          ref={combinedRef}
          {...props}
        >
          {children}
          <Animated.View style={[StyleSheet.absoluteFill, borderStyle]} pointerEvents="none">
            <Svg width="100%" height="100%">
              <AnimatedPath animatedProps={animatedPathProps} />
            </Svg>
          </Animated.View>
          <Text
            style={[styles.floatingPlaceholderTextStyle, ExtraStyles.text, labelStyle]}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width
              console.log('[DynamicBorderBox.web] onLayout label:', label, 'width:', width)
              if (width) labelWidthSV.value = width
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </FieldDecoratorContext.Provider>
    )
  }
)

DynamicBorderBox.displayName = 'DynamicBorderBox'

const ExtraStyles = StyleSheet.create({
  text: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
  container: {
    display: 'flex',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
})
