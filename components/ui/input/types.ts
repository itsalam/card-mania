import { StyleProp, TextInputProps, TextStyle, ViewProps, ViewStyle } from 'react-native'
import { TextFieldHandle } from './base-input'

export type Validator =
  | 'number'
  | 'url'
  | 'required'
  | 'email'
  | 'optionalEmail'
  | 'price'
  | ((value?: string | undefined) => boolean)

export type InputProps = Omit<
  {
    // General
    containerProps?: ViewProps
    containerStyle?: StyleProp<ViewStyle>
    floatingPlaceholder?: boolean
    floatingPlaceholderStyle?: StyleProp<TextStyle>
    floatOnFocus?: boolean
    // Label
    // Accessory Buttons
    leadingAccessory?:
      | React.ReactElement<any, string | React.JSXElementConstructor<any>>
      | undefined
    trailingAccessory?:
      | React.ReactElement<any, string | React.JSXElementConstructor<any>>
      | undefined
    bottomAccessory?: React.ReactElement<any, string | React.JSXElementConstructor<any>> | undefined
    showClearButton?: boolean
    // Validation
    enableErrors?: boolean
    // validationMessageStyle,
    // validationMessagePosition = ValidationMessagePosition.BOTTOM,
    // retainValidationSpace = !helperText && !bottomAccessory,
    // Char Counter
    showCharCounter?: boolean
    charCounterStyle?: StyleProp<ViewStyle>
    // Input
    centered?: boolean
    showMandatoryIndication?: boolean
    clearButtonStyle?: StyleProp<ViewStyle>
    forceFloat?: boolean
    onClear?: (() => void) | undefined
    readonly?: boolean
  } & TextInputProps &
    FieldProps,
  'children'
> & {
  children?:
    | React.ReactNode
    | ((props: InputProps, ref: React.ForwardedRef<TextFieldHandle>) => React.ReactNode)
}

export type FieldProps = {
  accentColor?: ColorType | undefined
  validateOnStart?: boolean
  validateOnChange?: boolean
  validationDebounceTime?: number
  validateOnBlur?: boolean
  /**
   * Callback for when field validated and failed
   */
  onValidationFailed?: (failedValidatorIndex: number) => void
  /**
   * A single or multiple validator. Can be a string (required, email) or custom function.
   */
  validate?: Validator | Validator[]
  /**
   * The validation message to display when field is invalid (depends on validate)
   */
  validationMessage?: string | string[]
  /**
   * Callback for when field validity has changed
   */
  onChangeValidity?: (isValid: boolean) => void
} & Omit<TextInputProps, 'children'>

export type ColorType =
  | string
  | {
      default?: string
      focus?: string
      error?: string
      disabled?: string
      readonly?: string
    }
