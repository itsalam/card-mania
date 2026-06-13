import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { StyleProp, StyleSheet, Text, TextInputProps, TextStyle, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { getColorByState } from '../input/helpers'
import { FieldContext, FieldStore } from '../input/provider'
import { DURATION, GAP_PADDING } from '../input/styles'
import { FieldDecoratorContext, FieldDecoratorStore } from './provider'

type FloatingPlaceholderProps = {
  placeholder?: string
  floatingPlaceholderStyle?: StyleProp<TextStyle>
  placeHolderStyle?: StyleProp<TextStyle>
  floatOnFocus?: boolean
  forceFloat?: boolean
  fieldOffset?: { x: number; y: number; width?: number }
  inputOffset?: { x: number; y: number; width?: number }
  defaultValue?: TextInputProps['defaultValue']
  showMandatoryIndication?: boolean
}

const getTextSize = (style: StyleProp<TextStyle>) => StyleSheet.flatten(style)?.fontSize as number

const getOffsetHeight = (style: StyleProp<TextStyle>) =>
  (StyleSheet.flatten(style)?.lineHeight as number) ||
  (StyleSheet.flatten(style)?.fontSize as number)

const FloatingPlaceholder = (props: FloatingPlaceholderProps) => {
  useEffectiveColorScheme()

  const {
    placeholder: _placeholder,
    floatingPlaceholderStyle,
    placeHolderStyle,
    fieldOffset,
    inputOffset,
    showMandatoryIndication,
  } = props

  const decoratorCtx = useContext<FieldDecoratorStore>(FieldDecoratorContext)
  const fieldCtx = useContext<FieldStore>(FieldContext)

  const placeholder = _placeholder || decoratorCtx.label
  const shouldFloat = decoratorCtx.forceFloat
  const colorValue = getColorByState(fieldCtx) ?? Colors.$textNeutralLight

  const [layout, setLayout] = useState({ inputX: 0, inputY: 0, ready: false })
  useEffect(() => {
    const fW = fieldOffset?.width ?? 0
    const iW = inputOffset?.width ?? 0
    if (!fW || !iW) return
    setLayout({ inputX: fW - iW, inputY: inputOffset?.y ?? 0, ready: true })
  }, [fieldOffset?.width, inputOffset?.width, inputOffset?.y])

  const textHeightOffset = useMemo(
    () =>
      (getOffsetHeight(placeHolderStyle) ?? getOffsetHeight(floatingPlaceholderStyle) ?? 14) / 2,
    [placeHolderStyle, floatingPlaceholderStyle]
  )

  const scale = useMemo(() => {
    const floatingSize = getTextSize(floatingPlaceholderStyle) || 14
    const placeHolderSize = getTextSize(placeHolderStyle) || 14
    return floatingSize / placeHolderSize
  }, [floatingPlaceholderStyle, placeHolderStyle])

  // Float target: label center should land on the border stroke (y=0 in DynamicBorderBox coords).
  // The FloatingPlaceholder View lives inside the `field` View, which starts GAP_PADDING below
  // the DynamicBorderBox top. So the label must travel up by textHeightOffset + GAP_PADDING +
  // inputY to place its center at the border (y=0 in outer coords).
  const floatTx = -layout.inputX
  const floatTy = -(textHeightOffset * 1.5 + GAP_PADDING + layout.inputY)
  const transformValue = shouldFloat
    ? `translateX(${floatTx}px) translateY(${floatTy}px) scale(${scale})`
    : 'translateX(0px) translateY(0px) scale(1)'

  const flatPlaceholderStyle = useMemo(
    () => StyleSheet.flatten(placeHolderStyle) ?? {},
    [placeHolderStyle]
  )

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: layout.inputX,
        top: layout.inputY,
        opacity: layout.ready ? 1 : 0,
      }}
    >
      <Text
        style={[
          flatPlaceholderStyle,
          { color: colorValue },
          {
            transformOrigin: 'left center',
            transform: transformValue,
            transition: `transform ${Math.round(DURATION / 3)}ms cubic-bezier(0.4,0,0.2,1), color ${DURATION}ms`,
          } as any,
        ]}
        numberOfLines={1}
      >
        {showMandatoryIndication ? placeholder?.concat('*') : placeholder}
      </Text>
    </View>
  )
}

export default FloatingPlaceholder
