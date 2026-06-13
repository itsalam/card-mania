import { useCombinedRefs } from '@/components/hooks/useCombinedRefs'
import React, { forwardRef, useContext, useMemo, useState } from 'react'
import { ColorValue, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps } from 'react-native'
import Animated, { DerivedValue, useAnimatedRef } from 'react-native-reanimated'
import { Path, Svg } from 'react-native-svg'
import { BorderRadiuses } from 'react-native-ui-lib'
import { getColorByState } from '../input/helpers'
import { FieldContext, FieldStore } from '../input/provider'
import { DURATION, GAP_PADDING, styles } from '../input/styles'
import { FieldDecoratorContext } from './provider'

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

    const [size, setSize] = useState({ width: 0, height: 0 })
    const [labelWidth, setLabelWidth] = useState(0)

    const fieldCtx = useContext<FieldStore>(FieldContext)
    const strokeColor = getColorByState(fieldCtx) ?? (color.value as string)

    const {
      borderWidth: strokeWidth,
      backgroundColor,
      ...containerStyle
    } = useMemo(
      () => ({
        borderWidth: 1.5,
        fontSize: 16,
        minHeight: 60,
        ...StyleSheet.flatten(style),
      }),
      [style]
    )

    const radius = BorderRadiuses.br40

    // SVG path + dasharray computed from React state — no worklets needed
    const { d, dasharray } = useMemo(() => {
      const { width, height } = size
      if (width === 0 || height === 0) return { d: '', dasharray: '0' }

      const inset = strokeWidth / 2
      const rw = Math.max(0, width - strokeWidth)
      const rh = Math.max(0, height - strokeWidth)
      const r = Math.min(radius, rw / 2, rh / 2)

      // Clockwise path starting at the bottom of the left edge — mirrors Skia's RoundedRect
      const path = [
        `M ${inset} ${inset + rh - r}`,
        `L ${inset} ${inset + r}`,
        `A ${r} ${r} 0 0 1 ${inset + r} ${inset}`,
        `L ${inset + rw - r} ${inset}`,
        `A ${r} ${r} 0 0 1 ${inset + rw} ${inset + r}`,
        `L ${inset + rw} ${inset + rh - r}`,
        `A ${r} ${r} 0 0 1 ${inset + rw - r} ${inset + rh}`,
        `L ${inset + r} ${inset + rh}`,
        `A ${r} ${r} 0 0 1 ${inset} ${inset + rh - r}`,
        'Z',
      ].join(' ')

      const horizontal = Math.max(0, rw - 2 * r)
      const vertical = Math.max(0, rh - 2 * r)
      const arcPerim = 2 * Math.PI * r
      const P = 2 * (horizontal + vertical) + arcPerim

      const gapW = forceFloat ? labelWidth + 2 * GAP_PADDING : 0
      const clampedGap = Math.max(0, Math.min(gapW, P - 0.0001))
      const offset = Math.max(0, vertical + arcPerim / 4 - GAP_PADDING * 2)
      const rest = Math.max(0, P - clampedGap - offset)

      return {
        d: path,
        dasharray: `${offset} ${clampedGap} ${rest} 0`,
      }
    }, [size, strokeWidth, radius, forceFloat, labelWidth])

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
            setSize({ width, height })
            onLayout?.(e)
          }}
          style={[ExtraStyles.container, containerStyle]}
          ref={combinedRef}
          {...props}
        >
          {children}

          <View style={[StyleSheet.absoluteFill, ExtraStyles.svgWrapper]} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Path
                d={d}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dasharray}
                fill={backgroundColor ? (backgroundColor as string) : 'none'}
                style={
                  {
                    transition: `stroke-dasharray ${DURATION}ms cubic-bezier(0.4,0,0.2,1), stroke ${DURATION / 2}ms`,
                  } as any
                }
              />
            </Svg>
          </View>

          {/* hidden label for gap width measurement */}
          <Text
            style={[styles.floatingPlaceholderTextStyle, ExtraStyles.hiddenText, labelStyle]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width
              if (w) setLabelWidth(w)
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
  hiddenText: {
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
  svgWrapper: {
    zIndex: -1,
  },
})
