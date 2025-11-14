/**
 * Known issues with React Native TextInput component
 * 1. iOS - input inner padding is off in multiline mode
 * 2. Android - input has minHeight that can't be overridden with zero padding (unlike iOS)
 * 3. Passing typography preset that includes lineHeight usually cause alignment issues with
 * other elements (leading/trailing accessories). It usually best to set lineHeight with undefined
 */
import { useCombinedRefs } from '@/components/hooks/useCombinedRefs'
import { useMeasure } from '@/components/hooks/useMeasure'
import React, { cloneElement, forwardRef, useContext, useImperativeHandle, useMemo } from 'react'
import { TextInput, View } from 'react-native'
import { DynamicBorderBox } from '../border-label-decorator/border'
import FloatingPlaceholder from '../border-label-decorator/placeholder'
import ClearButton from './clear-button'
import { shouldPlaceholderFloat } from './helpers'
import useFieldState, { FieldContext, FieldStore, useInputColors } from './provider'
import { styles } from './styles'
import { InputProps } from './types'

export type TextFieldHandle = TextInput & { validate?: () => boolean; clear?: () => void }

export const TextField = forwardRef<TextFieldHandle, InputProps>((props, ref) => {
  const {
    // General
    children,
    floatOnFocus = true,
    forceFloat = false,
    readonly = false,
    defaultValue,
  } = props
  const { onFocus, onBlur, onChangeText, fieldState, validateField, checkValidity } =
    useFieldState(props)

  const context = useMemo(() => {
    return {
      ...fieldState,
      disabled: props.editable === false,
      readonly,
      validateField,
      checkValidity,
      forceFloat,
      floatOnFocus,
      defaultValue,
      onFocus,
      onBlur,
      onChangeText,
    }
  }, [
    fieldState,
    props.editable,
    readonly,
    validateField,
    checkValidity,
    forceFloat,
    floatOnFocus,
    defaultValue,
    onFocus,
    onBlur,
    onChangeText,
  ])

  const inputProps: InputProps = {
    ...props,
  }

  return (
    <FieldContext.Provider value={context}>
      {typeof children === 'function' ? (
        children(inputProps, ref)
      ) : children ? (
        children
      ) : (
        <Input ref={ref} {...inputProps} />
      )}
    </FieldContext.Provider>
  )
})

TextField.displayName = 'TextField'

export const Input = forwardRef<TextInput, InputProps>((props, ref) => {
  const {
    // General
    containerProps,
    containerStyle,
    floatingPlaceholder,
    floatingPlaceholderStyle,
    floatOnFocus = true,
    forceFloat = false,
    placeholderTextColor,
    // Label
    // Accessory Buttons
    leadingAccessory: propsLeadingAccessory,
    trailingAccessory,
    bottomAccessory,
    showClearButton,
    onClear,
    // Validation
    enableErrors,
    // validationMessageStyle,
    // validationMessagePosition = ValidationMessagePosition.BOTTOM,
    // retainValidationSpace = !helperText && !bottomAccessory,
    // Char Counter
    showCharCounter,
    charCounterStyle,
    // Input
    placeholder,
    children,
    centered,
    showMandatoryIndication,
    clearButtonStyle,
    readonly = false,
    defaultValue,
    style,
    onLayout,
    ...others
  } = props
  const { ref: fieldLayoutRef, layout: fieldLayout, onLayout: onFieldLayout } = useMeasure<View>()
  const {
    ref: inputLayoutRef,
    layout: inputLayout,
    onLayout: onInputLayout,
  } = useMeasure<TextInput>()
  const context = useContext<FieldStore>(FieldContext)
  const combinedRefs = useCombinedRefs<TextInput>(ref, inputLayoutRef)

  useImperativeHandle(
    ref,
    () => {
      const node = combinedRefs.current
      return Object.assign({}, node, {
        validate: context.validateField,
        clear: () => {
          context.onChangeText?.('')
          onClear?.()
        },
      }) as TextFieldHandle
    },
    [combinedRefs, context.validateField]
  )

  const leadingAccessoryClone = useMemo(() => {
    const el = propsLeadingAccessory
    if (!el) return null
    if (propsLeadingAccessory) {
      return cloneElement<any>(propsLeadingAccessory)
    }
  }, [propsLeadingAccessory])
  const leadingAccessory = useMemo(() => {
    return floatingPlaceholder ? leadingAccessoryClone : propsLeadingAccessory
  }, [floatingPlaceholder, leadingAccessoryClone, propsLeadingAccessory])

  const inputStyle = useMemo(() => style, [style])

  const onLayoutCombined: InputProps['onLayout'] = (e) => {
    onLayout?.(e)
    onInputLayout(e)
  }

  const { color, opacity } = useInputColors()
  const forceFloatFinal = forceFloat || shouldPlaceholderFloat(context)

  return (
    <DynamicBorderBox
      {...containerProps}
      label={placeholder}
      labelStyle={[floatingPlaceholderStyle]}
      style={[containerStyle, styles.container]}
      color={color}
      opacity={opacity}
      forceFloat={forceFloatFinal}
    >
      <View style={styles.field} ref={fieldLayoutRef} onLayout={onFieldLayout}>
        {leadingAccessory}
        {floatingPlaceholder && (
          <FloatingPlaceholder
            placeholder={placeholder}
            floatingPlaceholderStyle={floatingPlaceholderStyle}
            placeHolderStyle={[styles.inputTextStyle, inputStyle]}
            fieldOffset={fieldLayout ?? undefined}
            inputOffset={inputLayout ?? undefined}
            showMandatoryIndication={showMandatoryIndication}
          />
        )}
        <TextInput
          {...others}
          ref={combinedRefs}
          hitSlop={{
            top: 20,
            bottom: 20,
          }}
          value={context.value}
          style={[styles.inputBody, styles.inputTextStyle, inputStyle]}
          onFocus={context.onFocus}
          onBlur={context.onBlur}
          onChangeText={context.onChangeText}
          onLayout={onLayoutCombined}
        />
      </View>
      {showClearButton && (
        <ClearButton
          onClear={onClear}
          testID={`${props.testID}.clearButton`}
          onChangeText={context.onChangeText}
          clearButtonStyle={clearButtonStyle}
        />
      )}
      {trailingAccessory}
    </DynamicBorderBox>
    //   {others.validationMessage && context.failingValidatorIndex && (
    //     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
    //       <TriangleAlert size={20} color={Colors.$textDanger} />
    //       <Text style={{ color: Colors.$textDanger }}>
    //         {others.validationMessage[context.failingValidatorIndex]}
    //       </Text>
    //     </View>
    //   )}
    // </FieldContext.Provider>
  )
})
Input.displayName = 'TextField'
