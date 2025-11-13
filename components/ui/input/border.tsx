import { Canvas, DashPathEffect, RoundedRect } from '@shopify/react-native-skia'
import React, { useContext, useEffect } from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewProps } from 'react-native'
import Animated, {
  Easing,
  measure,
  useAnimatedRef,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { BorderRadiuses } from 'react-native-ui-lib'
import { shouldPlaceholderFloat } from './helpers'
import { FieldContext, useInputColors } from './provider'
import { DURATION, GAP_PADDING, styles } from './styles'

type DynamicBorderBoxProps = ViewProps & {
  label?: string
  labelStyle?: StyleProp<TextStyle>
  forceFloat?: boolean
}

export const DynamicBorderBox = ({
  style,
  children,
  label,
  labelStyle,
  onLayout,
  forceFloat,
  ...props
}: DynamicBorderBoxProps) => {
  const ref = useAnimatedRef<View>()
  const context = useContext(FieldContext)
  const shouldFloat = forceFloat || (!!label && shouldPlaceholderFloat(context))
  const { color, opacity } = useInputColors()
  const size = useSharedValue({ width: 0, height: 0 })
  const {
    borderWidth: strokeWidth,
    backgroundColor,
    ...containerStyle
  } = {
    borderWidth: 1.5,
    fontSize: 16,
    ...StyleSheet.flatten(style),
  }
  const fontSize = StyleSheet.flatten(labelStyle)?.fontSize || 16
  const radius = BorderRadiuses.br40

  const inset = strokeWidth / 2

  const gap = useSharedValue(0)
  const targetGap = useSharedValue(20)
  const rw = useDerivedValue(() => Math.max(0, size.value.width - strokeWidth), [size])
  const rh = useDerivedValue(
    () => Math.max(0, size.value.height - fontSize * 0.5 - strokeWidth),
    [size, fontSize]
  )
  const r = useDerivedValue(() => Math.min(radius, rw.value / 2, rh.value / 2))
  const bgWidth = useDerivedValue(() => rw.value - 2 * inset, [rw])
  const bgHeight = useDerivedValue(() => rh.value - 2 * inset, [rh])

  useDerivedValue(() => {
    const m = measure(ref)
    if (m) {
      // update shared value on the UI thread
      size.value = { width: m.width, height: m.height }
    }
  })

  useEffect(() => {
    const target = shouldFloat ? targetGap.value : 0
    // clamp safely on the UI thread after perimeter is known
    gap.value = withTiming(target, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFloat, targetGap])

  const strokeDasharray = useDerivedValue(() => {
    let P = 2 * (rw.value + rh.value)
    const horizontal = rw.value - 2 * r.value
    const vertical = rh.value - 2 * r.value
    const straight = 2 * (horizontal + vertical)
    const arcs = 2 * Math.PI * r.value
    P = straight + arcs
    const clampedGap = Math.max(0, Math.min(gap.value, P - 0.0001))
    const offset = vertical + arcs / 4
    const dashArray = [offset, clampedGap, P - clampedGap - offset, 0]

    return dashArray
  }, [rw, rh, gap])

  return (
    <Animated.View
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        size.set({ width, height })
        onLayout?.(e)
      }}
      style={[ExtraStyles.container, containerStyle]}
      ref={ref}
      {...props}
    >
      {children}
      {size.value.width > 0 && size.value.height > 0 && (
        <Canvas
          style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
          onSize={size}
          pointerEvents="none"
        >
          <RoundedRect
            opacity={opacity}
            x={inset}
            y={inset + fontSize * 0.5}
            width={rw}
            height={rh}
            r={r}
            color={color}
            strokeWidth={strokeWidth}
            style="stroke"
            //   strokeLinecap="butt"
          >
            <DashPathEffect intervals={strokeDasharray} />
          </RoundedRect>

          {backgroundColor && (
            <RoundedRect
              x={1 + inset}
              y={1 + inset + fontSize * 0.5}
              width={bgWidth}
              height={bgHeight}
              r={r}
              color={backgroundColor as string}
              style="fill"
              //   strokeLinecap="butt"
            />
          )}
        </Canvas>
      )}
      <Text
        style={[styles.floatingPlaceholderTextStyle, ExtraStyles.text, labelStyle]}
        onTextLayout={(e) => {
          const { lines } = e.nativeEvent
          if (lines.length > 0) {
            targetGap.set(lines[0]?.width + GAP_PADDING)
          }
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  )
}

const ExtraStyles = StyleSheet.create({
  text: {
    position: 'absolute',
    left: -99999,
    top: -99999,
    opacity: 0,
    zIndex: -1,
  },
  container: {
    display: 'flex',
    position: 'relative',
    flexDirection: 'row',
    flex: 1,
  },
})
