import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Platform, StyleProp, StyleSheet, TextInputProps, TextProps, TextStyle } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { shouldPlaceholderFloat } from './helpers'
import { FieldContext, FieldStore, useInputColors } from './provider'
import { GAP_PADDING } from './styles'
import { ColorType } from './types'

type FloatingPlaceholderProps = {
  /**
   * The placeholder for the field
   */
  placeholder?: string
  /**
   * The floating placeholder color
   */
  floatingPlaceholderColor?: ColorType
  /**
   * Custom style to pass to the floating placeholder
   */
  floatingPlaceholderStyle?: StyleProp<TextStyle>
  placeHolderStyle?: StyleProp<TextStyle>
  /**
   * Should placeholder float on focus or when start typing
   */
  floatOnFocus?: boolean
  forceFloat?: boolean
  fieldOffset?: {
    x: number
    y: number
  }
  inputOffset?: {
    x: number
    y: number
  }
  defaultValue?: TextInputProps['defaultValue']
  showMandatoryIndication?: boolean
}

const getTextSize = (style: StyleProp<TextStyle>) => {
  return StyleSheet.flatten(style)?.fontSize as number
}

const getOffsetHeight = (style: StyleProp<TextStyle>) => {
  return (
    (StyleSheet.flatten(style)?.lineHeight as number) ||
    (StyleSheet.flatten(style)?.fontSize as number)
  )
}

const FloatingPlaceholder = (props: FloatingPlaceholderProps) => {
  const {
    placeholder,
    floatingPlaceholderStyle,
    placeHolderStyle,
    fieldOffset = { x: 0, y: 0 },
    inputOffset = { x: 0, y: 0 },
    showMandatoryIndication,
    forceFloat,
  } = props
  const context = useContext<FieldStore>(FieldContext)
  const { color } = useInputColors()
  const [placeholderOffset, setPlaceholderOffset] = useState({
    top: 0,
    left: 0,
  })

  const shouldFloat = forceFloat || shouldPlaceholderFloat(context)
  const animation = useDerivedValue(() => {
    return withTiming(Number(shouldFloat), { duration: 200 })
  }, [shouldFloat])
  const shouldRenderIndication = context.isMandatory && showMandatoryIndication

  const textHeightOffset = useMemo(() => {
    return (
      (getOffsetHeight(placeHolderStyle) ??
        getOffsetHeight(floatingPlaceholderStyle) ??
        (14 as number)) / 2
    )
  }, [placeHolderStyle, floatingPlaceholderStyle])

  const placeHolderTextHeightOffset = useMemo(() => {
    return getOffsetHeight(floatingPlaceholderStyle) ?? ((14 as number) * 3) / 4
  }, [floatingPlaceholderStyle])

  const scale = useMemo(() => {
    const floatingSize = getTextSize(floatingPlaceholderStyle) || 14
    const placeHolderSize = getTextSize(placeHolderStyle) || 14
    return floatingSize / placeHolderSize
  }, [floatingPlaceholderStyle, placeHolderStyle])

  const fieldX = useSharedValue(0)
  const fieldY = useSharedValue(0)
  const inputX = useSharedValue(0)
  const inputY = useSharedValue(0)
  const textH = useSharedValue(0)
  const gap = useSharedValue(GAP_PADDING)
  const phTextYOffset = useSharedValue(0)
  const s = useSharedValue(scale)

  // (optional) precompute pieces on the UI thread
  const tx = useDerivedValue(() =>
    interpolate(animation.value, [0, 1], [0, gap.value - fieldX.value - inputX.value])
  )
  const ty = useDerivedValue(
    () =>
      // combine both translateY effects into one to avoid order-dependent jumps
      interpolate(animation.value, [0, 1], [0, -textH.value - fieldY.value - inputY.value]) +
      interpolate(animation.value, [0, 1], [0, phTextYOffset.value])
  )
  const sc = useDerivedValue(() => interpolate(animation.value, [0, 1], [1, s.value]))

  useEffect(() => {
    fieldX.value = fieldOffset?.x ?? 0
    fieldY.value = fieldOffset?.y ?? 0
    inputX.value = inputOffset.x ?? 0
    inputY.value = inputOffset.y ?? 0
    textH.value = textHeightOffset ?? 0
    phTextYOffset.value = placeHolderTextHeightOffset ?? 0
    s.value = scale
    gap.value = GAP_PADDING
  }, [
    fieldOffset?.x,
    fieldOffset?.y,
    inputOffset.x,
    inputOffset.y,
    textHeightOffset,
    placeHolderTextHeightOffset,
    scale,
  ])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      color: color.value,
      transformOrigin: 'left center',
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
    }
  })

  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: inputX.value,
    top: inputY.value,
  }))

  const style = useMemo(
    () => [styles.placeholder, placeHolderStyle, animatedStyle],
    [placeHolderStyle, animatedStyle]
  )

  const onPlaceholderLayout = useCallback<NonNullable<TextProps['onLayout']>>((event) => {
    const { width, height } = event.nativeEvent.layout
    let translate = width / 2 - (width * scale) / 2
    setPlaceholderOffset({
      left: translate,
      top: height,
    })
  }, [])

  return (
    <Animated.View style={containerStyle} pointerEvents={'none'}>
      <Animated.Text style={style} onLayout={onPlaceholderLayout} numberOfLines={1}>
        {shouldRenderIndication ? placeholder?.concat('*') : placeholder}
      </Animated.Text>
    </Animated.View>
  )
}
const styles = StyleSheet.create({
  placeholder: {
    ...Platform.select({
      android: {
        textAlignVertical: 'center',
        flexShrink: 1,
      },
    }),
    flexShrink: 1,
    flex: 0,
  },
  valid: {
    color: Colors.$textSuccess,
  },
  invalid: {
    color: Colors.$textDanger,
  },
})

export default FloatingPlaceholder
